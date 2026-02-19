// app/api/order/bulk-set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { getScope, ScopeError } from "@/lib/auth/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* =========================================================
   Types
========================================================= */

type Body = {
  tier?: "BASIS" | "LUXUS";
  weekIndex?: 0 | 1;
  choice_key: string;
};

type Choice = { key: string; label?: string };
type CompanyStatus = "active" | "paused" | "closed" | string;

type CompanyRow = {
  id: string;
  status?: CompanyStatus | null;
  paused_reason?: string | null;
  closed_reason?: string | null;
  contract_week_tier: Record<string, "BASIS" | "LUXUS"> | null;
  contract_basis_choices: Choice[] | null;
  contract_luxus_choices: Choice[] | null;
};

type ReceiptRow = {
  id: string;
  date: string;
  status: string | null;
  updated_at: string | null;
  choice_key: string | null;
};

/* =========================================================
   Utils
========================================================= */

function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    // eslint-disable-next-line no-console
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[${scope}]`, err?.message || err);
  }
}

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toLowerCase();
  return s || "active";
}

/** Europe/Oslo "nÃƒÂ¥" -> (YYYY-MM-DD, HH:MM) */
function osloNowParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    timeHM: `${get("hour")}:${get("minute")}`,
  };
}

/** LÃƒÂ¥s etter 08:00 Europe/Oslo samme dag */
function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";
  const locked = dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;
  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);

  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  const key = map[wd];
  if (!key) throw new Error("Kun ManÃ¢â‚¬â€œFre er gyldig.");
  return key;
}

/** Finn 10 neste hverdager fra startISO (inkl start hvis den er hverdag) */
function getNextWeekdays(startISO: string, days: number) {
  const out: string[] = [];
  const d = new Date(`${startISO}T00:00:00Z`);

  while (out.length < days) {
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return out;
}

/* =========================
   Company status gate (PAUSED/CLOSED)
========================= */
async function assertCompanyActive(supa: SupabaseClient<any, any, any>, companyId: string) {
  const { data, error } = await (supa as any)
    .from("companies")
    .select("status, paused_reason, closed_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      status: 500,
      error: "COMPANY_LOOKUP_FAILED",
      reason: error?.message ?? "Company lookup failed",
    };
  }

  const status = normStatus(data.status);

  if (status === "paused") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_PAUSED",
      reason: (data.paused_reason as string | null) ?? "Firma er pauset.",
    };
  }

  if (status === "closed") {
    return {
      ok: false as const,
      status: 403,
      error: "COMPANY_CLOSED",
      reason: (data.closed_reason as string | null) ?? "Firma er stengt.",
    };
  }

  return { ok: true as const };
}

/* =========================================================
   Handler
========================================================= */

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    // Ã¢Å“â€¦ Tenant scope (single source of truth)
    let scope: any;
    try {
      scope = await getScope(req);
    } catch (e: any) {
      if (e instanceof ScopeError) {
        return jsonErr(rid, e.message ?? "Forbidden.", e.status ?? 403, e.code ?? "FORBIDDEN");
      }
      return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED");
    }

    const company_id = String(scope?.company_id ?? scope?.companyId ?? "").trim();
    const location_id = String(scope?.location_id ?? scope?.locationId ?? "").trim();
    const user_id = String(scope?.user_id ?? scope?.userId ?? "").trim();
    const role = String(scope?.role ?? "").trim();

    if (!company_id || !location_id || !user_id) {
      return jsonErr(rid, "Profil mangler company_id/location_id.", 403, "SCOPE_MISSING");
    }

    // Body
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const choice_key = String(body?.choice_key ?? "").trim();
    const tierFilter = body?.tier;
    const weekIndex = body?.weekIndex;

    if (!choice_key) return jsonErr(rid, "choice_key mangler.", 400, "MISSING_CHOICE_KEY");
    if (tierFilter && tierFilter !== "BASIS" && tierFilter !== "LUXUS") {
      return jsonErr(rid, "Ugyldig tier.", 400, "BAD_TIER");
    }
    if (weekIndex !== undefined && weekIndex !== 0 && weekIndex !== 1) {
      return jsonErr(rid, "Ugyldig weekIndex.", 400, "BAD_WEEK_INDEX");
    }

    const supa = supabaseAdmin();

    // Ã¢Å“â€¦ Company status gate (PAUSED/CLOSED)
    const gate = await assertCompanyActive(supa as any, company_id);
    if (!gate.ok) return jsonErr(rid, gate.reason, gate.status ?? 400, gate.error);

    // Kontrakt
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("id, contract_week_tier, contract_basis_choices, contract_luxus_choices")
      .eq("id", company_id)
      .single();

    const company = (companyRaw ?? null) as CompanyRow | null;

    if (cErr || !company) {
      logApiError("POST /api/order/bulk-set company failed", cErr, { rid, company_id });
      return jsonErr(rid, "Fant ikke kontrakt.", 403, "COMPANY_CONTRACT_NOT_FOUND");
    }

    const weekTier = company.contract_week_tier;
    const basisChoices = company.contract_basis_choices;
    const luxusChoices = company.contract_luxus_choices;

    if (!weekTier) {
      return jsonErr(rid, "Kontrakt mangler contract_week_tier.", 400, "CONTRACT_MISSING_WEEK_TIER");
    }

    // Bygg 2 uker (10 hverdager) og filtrer pÃƒÂ¥ uke hvis ÃƒÂ¸nsket
    const today = osloNowParts().dateISO;
    const datesAll = getNextWeekdays(today, 10);
    const dates = weekIndex === undefined ? datesAll : datesAll.slice(weekIndex * 5, weekIndex * 5 + 5);

    const skippedLocked: string[] = [];
    const skippedTierMismatch: string[] = [];
    const skippedNotAllowed: string[] = [];
    const targets: string[] = [];

    for (const date of dates) {
      const cutoff = cutoffState(date);
      if (cutoff.locked) {
        skippedLocked.push(date);
        continue;
      }

      let dayKey: "mon" | "tue" | "wed" | "thu" | "fri";
      try {
        dayKey = weekdayKeyOslo(date);
      } catch {
        skippedNotAllowed.push(date);
        continue;
      }

      const tier = (weekTier as any)[dayKey] as "BASIS" | "LUXUS" | undefined;
      if (!tier) {
        skippedNotAllowed.push(date);
        continue;
      }

      if (tierFilter && tier !== tierFilter) {
        skippedTierMismatch.push(date);
        continue;
      }

      const allowed = tier === "BASIS" ? basisChoices : luxusChoices;
      const okChoice = Array.isArray(allowed) && allowed.some((x) => x?.key === choice_key);
      if (!okChoice) {
        skippedNotAllowed.push(date);
        continue;
      }

      targets.push(date);
    }

    if (targets.length === 0) {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          updated: 0,
          dates: [],
          receipts: [],
          skippedLocked,
          skippedTierMismatch,
          skippedNotAllowed,
          message: "Ingen dager ÃƒÂ¥ oppdatere (enten lÃƒÂ¥st eller ikke tillatt).",
          actor: { role, user_id, company_id, location_id },
        },
        200
      );
    }

    // Upsert batch (day_choices)
    const rows = targets.map((date) => ({
      company_id,
      location_id,
      user_id, // day_choices.user_id = auth.users.id
      date,
      choice_key,
      note: null,
      status: "ACTIVE",
    }));

    const { data: savedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .upsert(rows, { onConflict: "company_id,location_id,user_id,date" })
      .select("id, date, status, updated_at, choice_key");

    if (uErr) {
      logApiError("POST /api/order/bulk-set upsert failed", uErr, { rid, company_id, location_id, user_id });
      return jsonErr(rid, "Kunne ikke lagre bulk-valg.", 500, { code: "SAVE_FAILED", detail: uErr.message });
    }

    const receipts = ((savedRaw ?? []) as ReceiptRow[])
      .filter((r) => !!r?.id && !!r?.date)
      .map((r) => ({
        orderId: r.id,
        date: r.date,
        status: "ACTIVE" as const,
        updatedAt: r.updated_at ?? null,
      }));

    const receiptByDate = new Map(receipts.map((r) => [r.date, r]));
    const receiptsOrdered = targets.map((d) => receiptByDate.get(d)).filter(Boolean);

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        updated: targets.length,
        dates: targets,
        choice_key,
        receiptMode: "MULTI",
        receipts: receiptsOrdered,
        filters: { tier: tierFilter ?? null, weekIndex: weekIndex ?? null },
        skippedLocked,
        skippedTierMismatch,
        skippedNotAllowed,
        actor: { role, user_id, company_id, location_id },
      },
      200
    );
  } catch (e: any) {
    logApiError("POST /api/order/bulk-set failed", e, { rid });
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
