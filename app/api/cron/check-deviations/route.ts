export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function displayDate(dateISO: string) {
  const [year, month, day] = dateISO.split("-");
  if (!year || !month || !day) return dateISO;
  return `${day}.${month}.${year}`;
}

function osloNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    weekday: pick("weekday"),
    hour: Number(pick("hour")),
  };
}

function isWeekday(weekday: string) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);
}

async function enqueueOutboxOnce(admin: any, eventKey: string, payload: Record<string, unknown>) {
  const { error } = await admin.from("outbox").insert({
    event_key: eventKey,
    payload,
    status: "PENDING",
    attempts: 0,
  });

  if (error && String(error.code ?? "") !== "23505") throw error;
}

async function getDeviationCounts(admin: any, date: string) {
  const [ordersRes, packedRes, deliveredRes] = await Promise.all([
    admin.from("orders").select("id, company_id, location_id").eq("date", date).eq("status", "ACTIVE"),
    admin
      .from("kitchen_batches")
      .select("company_location_id, status, packed_at")
      .eq("delivery_date", date)
      .in("status", ["PACKED", "DELIVERED"]),
    admin
      .from("kitchen_batches")
      .select("id, company_location_id, packed_at")
      .eq("delivery_date", date)
      .eq("status", "PACKED"),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (packedRes.error) throw packedRes.error;
  if (deliveredRes.error) throw deliveredRes.error;

  const packedLocationIds = new Set(
    (packedRes.data ?? []).map((row: any) => safeStr(row.company_location_id)).filter(Boolean)
  );
  const upakket = (ordersRes.data ?? []).filter((order: any) => !packedLocationIds.has(safeStr(order.location_id))).length;

  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const uleverte = (deliveredRes.data ?? []).filter((batch: any) => {
    const packedAt = batch?.packed_at ? new Date(batch.packed_at).getTime() : 0;
    return Number.isFinite(packedAt) && packedAt > 0 && packedAt < twoHoursAgo;
  }).length;

  return { upakket, uleverte };
}

async function handler(req: NextRequest) {
  const rid = makeRid("cron_deviations");

  try {
    requireCronAuth(req);
  } catch (error: any) {
    const code = safeStr(error?.code ?? error?.message);
    if (code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    return jsonErr(rid, "Ugyldig eller manglende cron secret.", 403, "forbidden");
  }

  const now = osloNow();
  if (!isWeekday(now.weekday)) return jsonOk(rid, { skipped: true, reason: "not_weekday", now }, 200);
  if (now.hour !== 10 && now.hour !== 14) {
    return jsonOk(rid, { skipped: true, reason: "outside_deviation_windows", now }, 200);
  }

  try {
    const admin = supabaseAdmin();
    const counts = await getDeviationCounts(admin, now.date);
    const from = safeStr(process.env.LP_RESEND_FROM) || `Lunchportalen <${ORDER_EMAIL}>`;
    const dateLabel = displayDate(now.date);

    if (now.hour === 10 && counts.upakket > 0) {
      const eventKey = `deviation:unpacked:${now.date}`;
      await enqueueOutboxOnce(admin, eventKey, {
        eventType: "DEVIATION_UNPACKED",
        eventKey,
        rid,
        from,
        to: "superadmin@lunchportalen.no",
        subject: `AVVIK – ${counts.upakket} upakkede ordre ${dateLabel}`,
        bodyText: [
          `AVVIK ${dateLabel}`,
          "",
          `${counts.upakket} ordre er ikke pakket innen kl. 10:00.`,
          "",
          "Sjekk kjøkkenstatus i Lunchportalen.",
        ].join("\n"),
        timestampISO: new Date().toISOString(),
        extra: { date: now.date, count: counts.upakket },
      });
    }

    if (now.hour === 14 && counts.uleverte > 0) {
      const eventKey = `deviation:undelivered:${now.date}`;
      await enqueueOutboxOnce(admin, eventKey, {
        eventType: "DEVIATION_UNDELIVERED",
        eventKey,
        rid,
        from,
        to: "superadmin@lunchportalen.no",
        subject: `AVVIK – ${counts.uleverte} uleverte leveranser ${dateLabel}`,
        bodyText: [
          `AVVIK ${dateLabel}`,
          "",
          `${counts.uleverte} pakkede leveranser er ikke levert innen frist.`,
          "",
          "Sjekk sjåførstatus i Lunchportalen.",
        ].join("\n"),
        timestampISO: new Date().toISOString(),
        extra: { date: now.date, count: counts.uleverte },
      });
    }

    return jsonOk(rid, { date: now.date, hour: now.hour, ...counts }, 200);
  } catch (error: any) {
    return jsonErr(rid, "Avvikssjekk feilet.", 500, "DEVIATION_CHECK_FAILED", {
      message: safeStr(error?.message ?? error),
    });
  }
}

export const GET = handler;
export const POST = handler;
