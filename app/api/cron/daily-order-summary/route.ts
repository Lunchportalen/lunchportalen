export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildDailySummaryDispatchPlan,
  groupOrdersByProvider,
  type DailySummaryOrderRow,
} from "@/lib/orders/dailySummaryProviderRouting";
import { CRON_DAILY_ORDER_SUMMARY_COLUMNS } from "@/lib/orders/projection";
import {
  getProviderNotificationRecipients,
  type ProviderNotificationRecipients,
} from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

const ORDER_TO = "ordre@lunchportalen.no";
const KITCHEN_TO = "kitchen@lunchportalen.no";

type OrderRow = DailySummaryOrderRow;

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function osloParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    weekday: pick("weekday"),
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

function isWeekday(weekday: string) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
}

function formatDateNO(dateISO: string) {
  const parts = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(`${dateISO}T12:00:00+01:00`));

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")} ${pick("day")}.${pick("month")}.${pick("year")}`;
}

async function enqueueOutboxOnce(
  admin: ReturnType<typeof supabaseAdmin>,
  eventKey: string,
  payload: Record<string, unknown>
) {
  const { error } = await admin
    .from("outbox")
    .insert({
      event_key: eventKey,
      payload,
      status: "PENDING",
      attempts: 0,
    });

  if (!error) return { inserted: true };
  if (String((error as any).code ?? "") === "23505") return { inserted: false };
  throw error;
}

function line(value: string) {
  return value ? value : "-";
}

export async function POST(req: NextRequest) {
  const rid = makeRid("cron_daily_order_summary");

  try {
    requireCronAuth(req);
  } catch (error: any) {
    const code = safeStr(error?.code ?? error?.message);
    if (code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    return jsonErr(rid, "Ugyldig eller manglende cron secret.", 403, "forbidden");
  }

  const oslo = osloParts();
  if (!isWeekday(oslo.weekday)) {
    return jsonOk(rid, { skipped: true, reason: "not_weekday", oslo }, 200);
  }
  if (!(oslo.hour === 8 && oslo.minute >= 5 && oslo.minute < 20)) {
    return jsonOk(rid, { skipped: true, reason: "outside_0805_window", oslo }, 200);
  }

  try {
    const admin = supabaseAdmin();
    const date = oslo.date;
    const prettyDate = formatDateNO(date);
    const from = safeStr(process.env.LP_RESEND_FROM) || `Lunchportalen <${ORDER_EMAIL}>`;

    // Service-role context, prices not needed (cron e-postsammendrag).
    const { data: orderRows, error: orderErr } = await admin
      .from("orders")
      .select(CRON_DAILY_ORDER_SUMMARY_COLUMNS)
      .eq("date", date)
      .eq("status", "ACTIVE");

    if (orderErr) {
      return jsonErr(rid, "Kunne ikke hente dagens ordre.", 500, "ORDERS_FETCH_FAILED", {
        message: orderErr.message,
        code: (orderErr as any).code ?? null,
      });
    }

    const orders = (orderRows ?? []) as OrderRow[];
    const companyIds = Array.from(new Set(orders.map((row) => safeStr(row.company_id)).filter(Boolean)));
    const locationIds = Array.from(new Set(orders.map((row) => safeStr(row.location_id)).filter(Boolean)));
    const userIds = Array.from(new Set(orders.map((row) => safeStr(row.user_id)).filter(Boolean)));

    const [companiesRes, locationsRes, profilesRes] = await Promise.all([
      companyIds.length
        ? admin.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [], error: null }),
      locationIds.length
        ? admin
            .from("company_locations")
            .select("id, name, company_id, delivery_window_from, delivery_window_to")
            .in("id", locationIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (companiesRes.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, "COMPANIES_FETCH_FAILED");
    if (locationsRes.error) return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, "LOCATIONS_FETCH_FAILED");
    if (profilesRes.error) return jsonErr(rid, "Kunne ikke hente profiler.", 500, "PROFILES_FETCH_FAILED");

    const companies = new Map((companiesRes.data ?? []).map((row: any) => [String(row.id), safeStr(row.name) || "Ukjent firma"]));
    const locations = new Map((locationsRes.data ?? []).map((row: any) => [String(row.id), row]));
    const profiles = new Map(
      (profilesRes.data ?? []).map((row: any) => [String(row.id), safeStr(row.full_name) || safeStr(row.email) || "Ukjent"])
    );

    // Aggregat + e-postinnhold for et vilkårlig ordresubsett (plattform = alle, provider = egne).
    const buildBodies = (subset: OrderRow[]) => {
      const byCompany = new Map<string, { name: string; count: number; employees: Set<string> }>();
      const byDelivery = new Map<
        string,
        { company: string; location: string; slot: string; window: string; count: number; employees: string[] }
      >();

      for (const order of subset) {
        const companyId = safeStr(order.company_id);
        const locationId = safeStr(order.location_id);
        const userId = safeStr(order.user_id);
        const slot = safeStr(order.slot) || "lunch";
        const companyName = companies.get(companyId) ?? "Ukjent firma";
        const employeeName = profiles.get(userId) ?? "Ukjent";

        const company = byCompany.get(companyId) ?? { name: companyName, count: 0, employees: new Set<string>() };
        company.count += 1;
        company.employees.add(employeeName);
        byCompany.set(companyId, company);

        const loc = locations.get(locationId) as any;
        const locationName = safeStr(loc?.name) || "Lokasjon";
        const windowLabel =
          safeStr(loc?.delivery_window_from) && safeStr(loc?.delivery_window_to)
            ? `${safeStr(loc.delivery_window_from)} – ${safeStr(loc.delivery_window_to)}`
            : slot;
        const key = `${slot}|${companyId}|${locationId}`;
        const delivery = byDelivery.get(key) ?? {
          company: companyName,
          location: locationName,
          slot,
          window: windowLabel,
          count: 0,
          employees: [],
        };
        delivery.count += 1;
        delivery.employees.push(employeeName);
        byDelivery.set(key, delivery);
      }

      const total = subset.length;
      const companyCount = byCompany.size;

      const orderBody =
        total === 0
          ? [
              `Bestillinger ${prettyDate} – Lunchportalen`,
              "",
              "Ingen bestillinger i dag.",
              "",
              "Bestillingsfristen var 08:00.",
              "Kjøkken kan starte produksjon fra 08:05.",
              "",
              "Med vennlig hilsen,",
              "Lunchportalen",
            ].join("\n")
          : [
              `Bestillinger ${prettyDate} – Lunchportalen`,
              "",
              "Her er en oversikt over dagens bestillinger:",
              "",
              `Totalt: ${total} bestillinger fordelt på ${companyCount} firmaer`,
              "",
              ...Array.from(byCompany.values())
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nb"))
                .map((item) => `${item.name}: ${item.count} bestillinger`),
              "",
              "Bestillingsfristen var 08:00.",
              "Kjøkken kan starte produksjon fra 08:05.",
              "",
              "Med vennlig hilsen,",
              "Lunchportalen",
            ].join("\n");

      const kitchenBody =
        total === 0
          ? [
              `Produksjonsliste ${prettyDate} – Lunchportalen`,
              "",
              "Ingen bestillinger i dag.",
              "",
              "Med vennlig hilsen,",
              "Lunchportalen",
            ].join("\n")
          : [
              `Produksjonsliste ${prettyDate} – Lunchportalen`,
              "",
              `Totalt: ${total} porsjoner`,
              "",
              ...Array.from(byDelivery.values())
                .sort(
                  (a, b) =>
                    a.slot.localeCompare(b.slot, "nb") ||
                    a.company.localeCompare(b.company, "nb") ||
                    a.location.localeCompare(b.location, "nb")
                )
                .flatMap((item) => [
                  `${item.company}, ${item.location}`,
                  `Leveringsvindu: ${line(item.window)}`,
                  `Antall: ${item.count}`,
                  `Ansatte: ${item.employees.sort((a, b) => a.localeCompare(b, "nb")).join(", ")}`,
                  "",
                ]),
              "Med vennlig hilsen,",
              "Lunchportalen",
            ].join("\n");

      return { orderBody, kitchenBody, total, companyCount, deliveryCount: byDelivery.size };
    };

    // Resolve provider-mottakere (orders.provider_id er sannheten — aldri kryssing).
    // Resolver-feil for én provider blokkerer aldri plattformkopi eller andre providere.
    const providerIds = Array.from(groupOrdersByProvider(orders).keys()).filter((key) => key !== "");
    const resolvedByProvider = new Map<string, ProviderNotificationRecipients | null>();
    for (const providerId of providerIds) {
      try {
        resolvedByProvider.set(providerId, await getProviderNotificationRecipients(providerId));
      } catch {
        resolvedByProvider.set(providerId, null);
      }
    }

    const plan = buildDailySummaryDispatchPlan({
      date,
      orders,
      resolvedByProvider,
      platformOrderTo: ORDER_TO,
      platformKitchenTo: KITCHEN_TO,
    });

    const dispatched: Array<Record<string, unknown>> = [];
    const providerFailures: Array<{ providerId: string | null; eventKey: string; message: string }> = [];
    let platformTotal = orders.length;
    let platformCompanies = 0;
    let platformDeliveries = 0;

    for (const entry of plan.entries) {
      const bodies = buildBodies(entry.orders);
      const isOrderSummary = entry.kind === "order_summary";

      if (entry.scope === "platform") {
        platformTotal = bodies.total;
        if (isOrderSummary) platformCompanies = bodies.companyCount;
        else platformDeliveries = bodies.deliveryCount;
      }

      const payload = {
        eventType: isOrderSummary ? "DAILY_ORDER_SUMMARY" : "DAILY_KITCHEN_PRODUCTION",
        eventKey: entry.eventKey,
        rid,
        from,
        to: entry.to,
        subject: isOrderSummary
          ? `Bestillinger ${prettyDate} – Lunchportalen`
          : `Produksjonsliste ${prettyDate} – Lunchportalen`,
        bodyText: isOrderSummary ? bodies.orderBody : bodies.kitchenBody,
        timestampISO: new Date().toISOString(),
        extra: {
          date,
          total: bodies.total,
          companyCount: bodies.companyCount,
          deliveryCount: bodies.deliveryCount,
          kind: isOrderSummary ? "daily_order_summary" : "daily_kitchen_production",
          scope: entry.scope,
          providerId: entry.providerId,
          recipientSource: entry.recipientSource,
        },
      };

      if (entry.scope === "platform") {
        // Plattformbackup er kritisk: feil her skal feile cron-kjøringen (som før).
        const result = await enqueueOutboxOnce(admin, entry.eventKey, payload);
        dispatched.push({ eventKey: entry.eventKey, scope: entry.scope, kind: entry.kind, ...result });
        continue;
      }

      // Provider-entries: én providers feil blokkerer aldri de andre (idempotent retry neste kjøring).
      try {
        const result = await enqueueOutboxOnce(admin, entry.eventKey, payload);
        dispatched.push({
          eventKey: entry.eventKey,
          scope: entry.scope,
          kind: entry.kind,
          providerId: entry.providerId,
          ...result,
        });
      } catch (error: any) {
        providerFailures.push({
          providerId: entry.providerId,
          eventKey: entry.eventKey,
          message: safeStr(error?.message ?? error) || "unknown_error",
        });
      }
    }

    return jsonOk(
      rid,
      {
        date,
        displayDate: prettyDate,
        total: platformTotal,
        companies: platformCompanies,
        deliveries: platformDeliveries,
        providers: {
          withOrders: providerIds.length,
          dispatchedEntries: dispatched.filter((d) => d.scope === "provider").length,
          unresolved: plan.unresolvedProviderIds,
          failures: providerFailures,
        },
        outbox: { dispatched },
      },
      200
    );
  } catch (error: any) {
    captureCronHandlerError("/api/cron/daily-order-summary", rid, error);
    return jsonErr(rid, "Daglig ordreoppsummering feilet.", 500, "DAILY_ORDER_SUMMARY_FAILED", {
      message: safeStr(error?.message ?? error),
    });
  }
}
