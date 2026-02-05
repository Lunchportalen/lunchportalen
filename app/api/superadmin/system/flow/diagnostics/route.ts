export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { osloTodayISODate } from "@/lib/date/oslo";

type CheckStatus = "OK" | "WARN" | "FAIL";

type FlowCheck = {
  key: string;
  status: CheckStatus;
  message: string;
  evidence: Record<string, any>;
  suggested_action: string;
};

type OpsEventInput = {
  level: "info" | "warn" | "error";
  event: string;
  data?: Record<string, any>;
  rid?: string | null;
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingRelation(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isISODate(d: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function nextDeliveryDateISO() {
  const today = osloTodayISODate();
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 7; i += 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) {
      return d.toISOString().slice(0, 10);
    }
  }
  return new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10);
}

function normalizeOrderStatus(raw: any): { normalized: string | null } {
  const s = safeStr(raw);
  if (!s) return { normalized: null };
  const upper = s.toUpperCase();
  if (upper === "ACTIVE") return { normalized: "ACTIVE" };
  if (upper === "CANCELED" || upper === "CANCELLED") return { normalized: "CANCELED" };
  if (upper === "DELIVERED") return { normalized: "DELIVERED" };
  return { normalized: null };
}

function orderIncidentTypeFromKey(key: string) {
  const short = key.replace(/^order_/, "").toUpperCase();
  return `ORDER_${short}`;
}

async function writeOpsEvent(admin: any, input: OpsEventInput) {
  try {
    const { error } = await admin.from("ops_events").insert({
      level: input.level,
      event: input.event,
      data: input.data ?? {},
      rid: input.rid ?? null,
    });
    if (error) throw error;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      opsLog("ops_events.missing", { rid: input.rid ?? null, event: input.event });
      return;
    }
    opsLog("ops_events.insert_failed", {
      rid: input.rid ?? null,
      message: String(e?.message ?? e),
      event: input.event,
    });
  }
}

async function upsertIncident(admin: any, input: { rid: string; type: string; severity: "warn" | "crit"; check: FlowCheck }) {
  const type = input.type;

  try {
    const existing = await admin
      .from("system_incidents")
      .select("id,count,details")
      .eq("type", type)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;

    const now = nowIso();
    const details = {
      ...(existing.data?.details ?? {}),
      check_key: input.check.key,
      message: input.check.message,
      evidence: input.check.evidence ?? {},
      suggested_action: input.check.suggested_action,
      rid: input.rid,
    };

    if (existing.data?.id) {
      const count = Number(existing.data?.count ?? 0) + 1;
      const { error } = await admin
        .from("system_incidents")
        .update({
          severity: input.severity,
          status: "open",
          last_seen: now,
          count,
          details,
          rid: input.rid,
        })
        .eq("id", existing.data.id);
      if (error) throw error;
      return;
    }

    const { error } = await admin.from("system_incidents").insert({
      severity: input.severity,
      type,
      scope_company_id: null,
      scope_user_id: null,
      scope_order_id: null,
      first_seen: now,
      last_seen: now,
      count: 1,
      status: "open",
      details,
      rid: input.rid,
    });

    if (error) throw error;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await writeOpsEvent(admin, {
        level: "error",
        event: "flow.incident.missing",
        data: { type, message: input.check.message },
        rid: input.rid,
      });
      return;
    }
    opsLog("flow.incident.upsert_failed", { rid: input.rid, type, message: String(e?.message ?? e) });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.flow.diagnostics.GET", ["superadmin"]);
  if (deny) return deny;

  const admin = supabaseAdmin();
  const checks: FlowCheck[] = [];

  const addCheck = (check: FlowCheck) => {
    checks.push(check);
  };

  const addFail = (key: string, message: string, evidence: Record<string, any>, suggested_action: string) => {
    addCheck({ key, status: "FAIL", message, evidence, suggested_action });
  };

  const addWarn = (key: string, message: string, evidence: Record<string, any>, suggested_action: string) => {
    addCheck({ key, status: "WARN", message, evidence, suggested_action });
  };

  const addOk = (key: string, message: string, evidence: Record<string, any>, suggested_action: string) => {
    addCheck({ key, status: "OK", message, evidence, suggested_action });
  };

  const today = osloTodayISODate();
  const nextDay = nextDeliveryDateISO();
  const last7 = daysAgoIso(6);
  const last30 = daysAgoIso(29);

  const repro = "Reproduser: Kjør flytsjekk i Superadmin -> System. Sjekk oppførte ID-er i databasen.";

  // Registration intake: pending too long
  try {
    const threshold = new Date();
    threshold.setUTCDate(threshold.getUTCDate() - 14);
    const { data, error } = await admin
      .from("companies")
      .select("id,name,orgnr,status,created_at")
      .eq("status", "PENDING")
      .lt("created_at", threshold.toISOString())
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    if (rows.length) {
      addWarn(
        "registration_pending_too_long",
        `Fant ${rows.length} firma i PENDING eldre enn 14 dager.`,
        {
          ids: rows.map((r) => r.id).filter(Boolean),
          sample: rows.map((r) => ({ id: r.id, created_at: r.created_at, name: r.name ?? null, orgnr: r.orgnr ?? null })),
        },
        `${repro} Vurder oppfølging av registrering.`
      );
    } else {
      addOk(
        "registration_pending_too_long",
        "Ingen firma i PENDING eldre enn 14 dager.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "registration_pending_too_long",
      "Kunne ikke lese PENDING-firmaer (registrering).",
      { error: errMessage(e) },
      `${repro} Sjekk tabell companies.`
    );
  }

  // Registration intake: missing name/orgnr
  try {
    const { data, error } = await admin
      .from("companies")
      .select("id,name,orgnr,status,created_at")
      .limit(500);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const missing = rows.filter((r) => !safeStr(r?.name) || !safeStr(r?.orgnr));
    const activeMissing = missing.filter((r) => safeStr(r?.status).toUpperCase() === "ACTIVE");
    const pendingMissing = missing.filter((r) => safeStr(r?.status).toUpperCase() !== "ACTIVE");

    if (activeMissing.length) {
      addFail(
        "registration_missing_core_fields",
        `Fant ${activeMissing.length} aktive firma med manglende navn/orgnr.`,
        {
          ids: activeMissing.map((r) => r.id).filter(Boolean),
          sample: activeMissing.map((r) => ({ id: r.id, status: r.status, name: r.name ?? null, orgnr: r.orgnr ?? null })),
        },
        `${repro} Fyll ut navn/orgnr for aktive firma.`
      );
    } else if (pendingMissing.length) {
      addWarn(
        "registration_missing_core_fields",
        `Fant ${pendingMissing.length} firma med manglende navn/orgnr (ikke aktive).`,
        {
          ids: pendingMissing.map((r) => r.id).filter(Boolean),
          sample: pendingMissing.map((r) => ({ id: r.id, status: r.status, name: r.name ?? null, orgnr: r.orgnr ?? null })),
        },
        `${repro} Fyll ut navn/orgnr før aktivering.`
      );
    } else {
      addOk(
        "registration_missing_core_fields",
        "Alle firma har navn og orgnr.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "registration_missing_core_fields",
      "Kunne ikke lese firmafelt (navn/orgnr).",
      { error: errMessage(e) },
      `${repro} Sjekk tabell companies.`
    );
  }

  // Agreement readiness: active company missing agreement
  let activeCompanyIds: string[] = [];
  try {
    const { data, error } = await admin
      .from("companies")
      .select("id,status")
      .eq("status", "ACTIVE")
      .limit(2000);

    if (error) throw error;

    activeCompanyIds = (data ?? []).map((r: any) => safeStr(r?.id)).filter(Boolean);
  } catch (e: any) {
    addFail(
      "agreement_missing_for_active",
      "Kunne ikke lese aktive firma (avtale).",
      { error: errMessage(e) },
      `${repro} Sjekk tabell companies.`
    );
  }

  try {
    if (activeCompanyIds.length) {
      const { data, error } = await admin
        .from("company_current_agreement")
        .select("company_id,status,delivery_days")
        .in("company_id", activeCompanyIds);

      if (error) throw error;

      const rows = (data ?? []) as any[];
      const withAgreement = new Set(rows.map((r) => safeStr(r?.company_id)).filter(Boolean));
      const missing = activeCompanyIds.filter((id) => !withAgreement.has(id));

      if (missing.length) {
        addFail(
          "agreement_missing_for_active",
          `Fant ${missing.length} aktive firma uten avtale.`,
          { ids: missing.slice(0, 50) },
          `${repro} Opprett avtale for aktive firma.`
        );
      } else {
        addOk(
          "agreement_missing_for_active",
          "Alle aktive firma har avtale.",
          { ids: [] },
          "Ingen handling nødvendig."
        );
      }

      const emptyDays = rows.filter((r) => normalizeDeliveryDaysStrict(r?.delivery_days).days.length === 0);
      if (emptyDays.length) {
        addFail(
          "agreement_delivery_days_empty",
          `Fant ${emptyDays.length} avtaler uten leveringsdager.`,
          {
            ids: emptyDays.map((r) => r.company_id).filter(Boolean),
            sample: emptyDays.map((r) => ({ company_id: r.company_id, status: r.status ?? null, delivery_days: r.delivery_days ?? null })),
          },
          `${repro} Sett leveringsdager på avtalen.`
        );
      } else {
        addOk(
          "agreement_delivery_days_empty",
          "Alle avtaler har leveringsdager.",
          { ids: [] },
          "Ingen handling nødvendig."
        );
      }
    } else {
      addOk(
        "agreement_missing_for_active",
        "Ingen aktive firma å kontrollere for avtale.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
      addOk(
        "agreement_delivery_days_empty",
        "Ingen avtaler å kontrollere for leveringsdager.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "agreement_missing_for_active",
      "Kunne ikke lese avtaler (company_current_agreement).",
      { error: errMessage(e) },
      `${repro} Sjekk view company_current_agreement.`
    );
    addFail(
      "agreement_delivery_days_empty",
      "Kunne ikke lese leveringsdager (company_current_agreement).",
      { error: errMessage(e) },
      `${repro} Sjekk view company_current_agreement.`
    );
  }

  // Employees integrity: active agreement but 0 active employees
  try {
    const { data: agreements, error: aErr } = await admin
      .from("company_current_agreement")
      .select("company_id,status")
      .eq("status", "ACTIVE")
      .limit(2000);

    if (aErr) throw aErr;

    const companyIds = (agreements ?? []).map((r: any) => safeStr(r?.company_id)).filter(Boolean);

    if (companyIds.length) {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id,company_id,is_active,disabled_at,role")
        .in("company_id", companyIds)
        .eq("role", "employee");

      if (pErr) throw pErr;

      const counts = new Map<string, number>();
      for (const p of profiles ?? []) {
        const cid = safeStr((p as any)?.company_id);
        if (!cid) continue;
        const active = (p as any)?.is_active !== false && !(p as any)?.disabled_at;
        if (!active) continue;
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }

      const noEmployees = companyIds.filter((id) => (counts.get(id) ?? 0) === 0);

      if (noEmployees.length) {
        addWarn(
          "employees_no_active_for_active_agreement",
          `Fant ${noEmployees.length} firma med aktiv avtale men 0 aktive ansatte.`,
          { ids: noEmployees.slice(0, 50) },
          `${repro} Legg til ansatte eller sjekk aktivering.`
        );
      } else {
        addOk(
          "employees_no_active_for_active_agreement",
          "Alle aktive avtaler har minst én aktiv ansatt.",
          { ids: [] },
          "Ingen handling nødvendig."
        );
      }
    } else {
      addOk(
        "employees_no_active_for_active_agreement",
        "Ingen aktive avtaler å kontrollere for ansatte.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "employees_no_active_for_active_agreement",
      "Kunne ikke kontrollere ansatte mot aktive avtaler.",
      { error: errMessage(e) },
      `${repro} Sjekk tabell profiles.`
    );
  }

  // Employees integrity: employees missing company_id but have orders
  try {
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("user_id,company_id,role")
      .eq("role", "employee")
      .is("company_id", null)
      .limit(200);

    if (pErr) throw pErr;

    const userIds = (profiles ?? []).map((p: any) => safeStr(p?.user_id)).filter(Boolean);

    if (userIds.length) {
      const from = daysAgoIso(30);
      const { data: orders, error: oErr } = await admin
        .from("orders")
        .select("id,user_id,date,company_id,location_id")
        .in("user_id", userIds)
        .gte("date", from)
        .limit(200);

      if (oErr) throw oErr;

      const rows = (orders ?? []) as any[];
      if (rows.length) {
        addFail(
          "employees_missing_company_with_orders",
          `Fant ${rows.length} ordre fra ansatte uten firmatilknytning.`,
          {
            ids: Array.from(new Set(rows.map((r) => r.id))).slice(0, 50),
            users: Array.from(new Set(rows.map((r) => r.user_id))).slice(0, 50),
            sample: rows.map((r) => ({ id: r.id, user_id: r.user_id, date: r.date }))
          },
          `${repro} Knytt ansatte til firma eller stans ordre for disse brukerne.`
        );
      } else {
        addOk(
          "employees_missing_company_with_orders",
          "Ingen ordre fra ansatte uten firmatilknytning.",
          { ids: [] },
          "Ingen handling nødvendig."
        );
      }
    } else {
      addOk(
        "employees_missing_company_with_orders",
        "Ingen ansatte uten firmatilknytning funnet.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "employees_missing_company_with_orders",
      "Kunne ikke sjekke ansatte uten firmatilknytning.",
      { error: errMessage(e) },
      `${repro} Sjekk tabell profiles/orders.`
    );
  }

  // Order integrity (last 30 days)
  let orders30: Array<{ id: string; user_id: string | null; date: string | null; status: string | null; company_id: string | null; location_id: string | null; slot: string | null }> = [];
  try {
    const { data, error } = await admin
      .from("orders")
      .select("id,user_id,date,status,company_id,location_id,slot")
      .gte("date", last30)
      .limit(5000);

    if (error) throw error;
    orders30 = (data ?? []) as any[];

    const { data: nullDates, error: nullErr } = await admin
      .from("orders")
      .select("id,user_id,date,status,company_id,location_id,slot")
      .is("date", null)
      .limit(200);

    if (nullErr) throw nullErr;
    orders30 = orders30.concat((nullDates ?? []) as any[]);
  } catch (e: any) {
    const err = { error: errMessage(e) };
    addFail("order_missing_scope", "Kunne ikke lese ordre for scope-sjekk (30 dager).", err, `${repro} Sjekk tabell orders.`);
    addFail("order_invalid_status", "Kunne ikke lese ordrestatus (30 dager).", err, `${repro} Sjekk tabell orders.`);
    addFail("order_duplicate_user_date", "Kunne ikke lese ordre for duplikatkontroll (30 dager).", err, `${repro} Sjekk tabell orders.`);
    addFail("order_delivery_inconsistent", "Kunne ikke sjekke leveringskonsistens (30 dager).", err, `${repro} Sjekk tabell orders/delivery_confirmations.`);
    addFail("order_slot_missing", "Kunne ikke sjekke slot på ordre (30 dager).", err, `${repro} Sjekk tabell orders.`);
  }

  if (orders30.length) {
    const missingScope = orders30.filter((o) => !safeStr(o.company_id) || !safeStr(o.location_id) || !safeStr(o.date) || !isISODate(o.date));
    if (missingScope.length) {
      addFail(
        "order_missing_scope",
        `Fant ${missingScope.length} ordre uten firmatilknytning/lokasjon/gyldig dato (30 dager).`,
        {
          ids: missingScope.map((o) => o.id).slice(0, 50),
          sample: missingScope.map((o) => ({ id: o.id, company_id: o.company_id ?? null, location_id: o.location_id ?? null, date: o.date ?? null }))
        },
        `${repro} Sett korrekt company_id/location_id/dato eller karantenér ordre.`
      );
    } else {
      addOk("order_missing_scope", "Ingen ordre mangler scope (30 dager).", { ids: [] }, "Ingen handling nødvendig.");
    }

    const invalidStatus = orders30.filter((o) => {
      const info = normalizeOrderStatus(o.status);
      if (!info.normalized) return true;
      return safeStr(o.status).toUpperCase() !== info.normalized;
    });
    if (invalidStatus.length) {
      addFail(
        "order_invalid_status",
        `Fant ${invalidStatus.length} ordre med ugyldig status (30 dager).`,
        {
          ids: invalidStatus.map((o) => o.id).slice(0, 50),
          sample: invalidStatus.map((o) => ({ id: o.id, status: o.status, date: o.date }))
        },
        `${repro} Normaliser status eller karantenér ordre.`
      );
    } else {
      addOk("order_invalid_status", "Ingen ordre med ugyldig status (30 dager).", { ids: [] }, "Ingen handling nødvendig.");
    }

    const byKey = new Map<string, string[]>();
    for (const o of orders30) {
      const userId = safeStr(o.user_id);
      const date = safeStr(o.date);
      if (!userId || !date) continue;
      const key = `${userId}|${date}`;
      const list = byKey.get(key) ?? [];
      list.push(o.id);
      byKey.set(key, list);
    }
    const dupes = Array.from(byKey.entries()).filter(([, ids]) => ids.length > 1);
    if (dupes.length) {
      addWarn(
        "order_duplicate_user_date",
        `Fant ${dupes.length} duplikate ordre per bruker/dato (30 dager).`,
        {
          ids: dupes.flatMap(([, ids]) => ids).slice(0, 50),
          sample: dupes.slice(0, 20).map(([key, ids]) => ({ key, ids }))
        },
        `${repro} Kjør deterministisk deduplisering.`
      );
    } else {
      addOk("order_duplicate_user_date", "Ingen duplikate ordre per bruker/dato (30 dager).", { ids: [] }, "Ingen handling nødvendig.");
    }

    const missingSlot = orders30.filter((o) => !safeStr(o.slot));
    if (missingSlot.length) {
      addFail(
        "order_slot_missing",
        `Fant ${missingSlot.length} ordre uten slot (30 dager).`,
        {
          ids: missingSlot.map((o) => o.id).slice(0, 50),
          sample: missingSlot.map((o) => ({ id: o.id, date: o.date, company_id: o.company_id, location_id: o.location_id }))
        },
        `${repro} Sett slot eller karantenér ordre.`
      );
    } else {
      addOk("order_slot_missing", "Ingen ordre uten slot (30 dager).", { ids: [] }, "Ingen handling nødvendig.");
    }

    try {
      const { data: confirmations, error: confErr } = await admin
        .from("delivery_confirmations")
        .select("delivery_date,slot,company_id,location_id,confirmed_at,confirmed_by")
        .gte("delivery_date", last30)
        .limit(5000);

      if (confErr) throw confErr;

      const confMap = new Map<string, { at: string | null; by: string | null }>();
      for (const c of confirmations ?? []) {
        const date = safeStr((c as any)?.delivery_date);
        const slot = safeStr((c as any)?.slot);
        const companyId = safeStr((c as any)?.company_id);
        const locationId = safeStr((c as any)?.location_id);
        if (!date || !slot || !companyId || !locationId) continue;
        const key = `${date}|${slot}|${companyId}|${locationId}`;
        confMap.set(key, {
          at: safeStr((c as any)?.confirmed_at) || null,
          by: safeStr((c as any)?.confirmed_by) || null,
        });
      }

      const delivered = orders30.filter((o) => normalizeOrderStatus(o.status).normalized === "DELIVERED");
      const inconsistent = delivered.filter((o) => {
        const date = safeStr(o.date);
        const slot = safeStr(o.slot);
        const companyId = safeStr(o.company_id);
        const locationId = safeStr(o.location_id);
        if (!date || !slot || !companyId || !locationId) return true;
        const key = `${date}|${slot}|${companyId}|${locationId}`;
        const conf = confMap.get(key);
        return !conf || !conf.at || !conf.by;
      });

      if (inconsistent.length) {
        addFail(
          "order_delivery_inconsistent",
          `Fant ${inconsistent.length} leverte ordre uten bekreftet levering (30 dager).`,
          {
            ids: inconsistent.map((o) => o.id).slice(0, 50),
            sample: inconsistent.map((o) => ({ id: o.id, date: o.date, company_id: o.company_id, location_id: o.location_id }))
          },
          `${repro} Bekreft levering eller karantenér ordre.`
        );
      } else {
        addOk("order_delivery_inconsistent", "Ingen leveringsinkonsistens i ordre (30 dager).", { ids: [] }, "Ingen handling nødvendig.");
      }
    } catch (e: any) {
      addFail(
        "order_delivery_inconsistent",
        "Kunne ikke verifisere leveringskonsistens (delivery_confirmations).",
        { error: errMessage(e) },
        `${repro} Sjekk tabell delivery_confirmations.`
      );
    }
  }

  // Kitchen readiness: today + next delivery day
  try {
    const dates = Array.from(new Set([today, nextDay]));
    const { data, error } = await admin
      .from("orders")
      .select("id,date,slot,status,company_id,location_id")
      .in("date", dates)
      .limit(2000);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const withOrders = dates.filter((d) => rows.some((r) => r.date === d));

    const missingSlot = rows.filter((r) => !safeStr(r?.slot));
    if (missingSlot.length) {
      addFail(
        "kitchen_missing_slot",
        `Fant ${missingSlot.length} ordre uten slot (i dag/neste leveringsdag).`,
        {
          ids: missingSlot.map((r) => r.id).slice(0, 50),
          sample: missingSlot.map((r) => ({ id: r.id, date: r.date, company_id: r.company_id, location_id: r.location_id }))
        },
        `${repro} Sett slot på ordrene før kjøkkenkjøring.`
      );
    } else {
      addOk(
        "kitchen_missing_slot",
        "Ingen ordre uten slot (i dag/neste leveringsdag).",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }

    const failures: Array<{ date: string; error: string }> = [];
    for (const d of withOrders) {
      const { error: kErr } = await admin
        .from("kitchen_batch")
        .select("id", { head: true, count: "exact" })
        .eq("delivery_date", d)
        .limit(1);

      if (kErr) {
        failures.push({ date: d, error: errMessage(kErr) });
      }
    }

    if (failures.length) {
      addFail(
        "kitchen_grouping_query",
        "Kjøkkenbatch kunne ikke leses for dager med ordre.",
        {
          ids: failures.map((f) => f.date),
          sample: failures,
        },
        `${repro} Sjekk tabell kitchen_batch og tilhørende data.`
      );
    } else {
      addOk(
        "kitchen_grouping_query",
        "Kjøkkenbatch er lesbar for dager med ordre.",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "kitchen_grouping_query",
      "Kunne ikke verifisere kjøkkenbatch for aktive dager.",
      { error: errMessage(e) },
      `${repro} Sjekk tabell orders/kitchen_batch.`
    );
    addFail(
      "kitchen_missing_slot",
      "Kunne ikke lese ordre for slot-kontroll.",
      { error: errMessage(e) },
      `${repro} Sjekk tabell orders.`
    );
  }

  // Driver stops readiness: inconsistent delivery flags
  try {
    const { data: batchRows, error } = await admin
      .from("kitchen_batch")
      .select("delivery_date,status,delivered_at,company_location_id")
      .eq("delivery_date", today)
      .limit(1000);

    if (error) throw error;

    const rawRows = (batchRows ?? []) as any[];
    const locationIds = Array.from(new Set(rawRows.map((r) => safeStr(r?.company_location_id)).filter(Boolean)));

    let locationMap = new Map<string, string | null>();
    if (locationIds.length) {
      const { data: locations, error: locErr } = await admin
        .from("company_locations")
        .select("id,company_id")
        .in("id", locationIds);

      if (locErr) throw locErr;

      locationMap = new Map((locations ?? []).map((l: any) => [safeStr(l.id), safeStr(l.company_id) || null]));
    }

    const rows = rawRows.map((r) => {
      const locationId = safeStr(r?.company_location_id);
      return {
        date: r?.delivery_date ?? null,
        status: r?.status ?? null,
        delivered_at: r?.delivered_at ?? null,
        company_id: locationMap.get(locationId) ?? null,
        location_id: locationId || null,
      };
    });

    const invalid = rows.filter((r) => r.delivered_at && !["DELIVERED", "delivered"].includes(String(r.status ?? "")));

    if (invalid.length) {
      let orderIds: string[] = [];
      let orderError: string | null = null;
      let orderSample: Array<{ key: string; order_ids: string[] }> = [];
      try {
        const { data: orders, error: oErr } = await admin
          .from("orders")
          .select("id,date,company_id,location_id")
          .eq("date", today)
          .limit(5000);

        if (oErr) throw oErr;

        const byKey = new Map<string, string[]>();
        for (const o of orders ?? []) {
          const date = safeStr((o as any).date);
          const companyId = safeStr((o as any).company_id);
          const locationId = safeStr((o as any).location_id);
          const id = safeStr((o as any).id);
          if (!date || !companyId || !locationId || !id) continue;
          const key = `${date}|${companyId}|${locationId}`;
          const list = byKey.get(key) ?? [];
          list.push(id);
          byKey.set(key, list);
        }

        const ids: string[] = [];
        orderSample = invalid.map((r) => {
          const key = `${safeStr(r.date)}|${safeStr(r.company_id)}|${safeStr(r.location_id)}`;
          const list = (byKey.get(key) ?? []).slice(0, 10);
          ids.push(...list);
          return { key, order_ids: list };
        });
        orderIds = Array.from(new Set(ids)).slice(0, 50);
      } catch (e: any) {
        orderError = errMessage(e);
      }

      addFail(
        "driver_inconsistent_delivery_flags",
        `Fant ${invalid.length} leveranser med delivered_at uten status DELIVERED (i dag).`,
        {
            ids: orderIds,
            sample: orderSample.length
              ? orderSample
              : invalid.map((r) => ({
                key: `${safeStr(r.date)}|${safeStr(r.company_id)}|${safeStr(r.location_id)}`,
                status: r.status,
                delivered_at: r.delivered_at,
              })),
          ...(orderError ? { error: orderError } : {}),
        },
        `${repro} Oppdater leveransestatus til DELIVERED når delivered_at er satt.`
      );
    } else {
      addOk(
        "driver_inconsistent_delivery_flags",
        "Ingen inkonsistente leveranser (i dag).",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "driver_inconsistent_delivery_flags",
      "Kunne ikke lese leveranser for sjåførkontroll.",
      { error: errMessage(e) },
      `${repro} Sjekk tabell kitchen_batch og company_locations.`
    );
  }

  // Delivery confirmation (last 7 days)
  try {
    const { data, error } = await admin
      .from("delivery_confirmations")
      .select("id,delivery_date,slot,company_id,location_id,confirmed_at,confirmed_by")
      .gte("delivery_date", last7)
      .limit(500);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const incomplete = rows.filter((r) => !r.confirmed_at || !r.confirmed_by);

    if (incomplete.length) {
      addFail(
        "delivery_missing_confirm_fields",
        `Fant ${incomplete.length} leveringsbekreftelser uten confirmed_at/confirmed_by (siste 7 dager).`,
        {
          ids: incomplete.map((r) => r.id).slice(0, 50),
          sample: incomplete.map((r) => ({ id: r.id, delivery_date: r.delivery_date, slot: r.slot }))
        },
        `${repro} Fyll inn confirmed_at/confirmed_by ved levering.`
      );
    } else {
      addOk(
        "delivery_missing_confirm_fields",
        "Alle leveringsbekreftelser har confirmed_at/confirmed_by (siste 7 dager).",
        { ids: [] },
        "Ingen handling nødvendig."
      );
    }
  } catch (e: any) {
    addFail(
      "delivery_missing_confirm_fields",
      "Kunne ikke lese leveringsbekreftelser (siste 7 dager).",
      { error: errMessage(e) },
      `${repro} Sjekk tabell delivery_confirmations.`
    );
  }

  // Write incidents for FAIL
  for (const check of checks) {
    if (check.status !== "FAIL") continue;

    if (check.key.startsWith("order_")) {
      await upsertIncident(admin, {
        rid: ctx.rid,
        type: orderIncidentTypeFromKey(check.key),
        severity: "crit",
        check,
      });
    } else {
      await upsertIncident(admin, {
        rid: ctx.rid,
        type: `FLOW_${check.key.toUpperCase()}`,
        severity: "crit",
        check,
      });
    }
  }

  const status = checks.some((c) => c.status === "FAIL") ? "degraded" : "normal";

  return jsonOk(ctx.rid, { status, checks }, 200);
}






