// app/api/order/bulk-set/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  // hvis tier settes, gjelder det bare dager med denne tier
  tier?: "BASIS" | "LUXUS";
  // hvis weekIndex settes: 0 = første uke (5 dager), 1 = andre uke (5 dager)
  weekIndex?: 0 | 1;
  choice_key: string;
};

type Choice = { key: string; label?: string };
type CompanyStatus = "active" | "paused" | "closed";

type ProfileRow = {
  company_id: string | null;
  location_id: string | null;
  role?: string | null;
};

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

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

/** Europe/Oslo "nå" -> (YYYY-MM-DD, HH:MM) */
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

/** Lås etter 08:00 Europe/Oslo samme dag */
function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";

  const locked = dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;
  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);

  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  const key = map[wd];
  if (!key) throw new Error("Kun Man–Fre er gyldig.");
  return key;
}

/** Finn 10 neste hverdager fra startISO (inkl start hvis den er hverdag) */
function getNextWeekdays(startISO: string, days: number) {
  const out: string[] = [];

  // ✅ prefer-const: binding reassignes ikke (Date-objektet muteres)
  const d = new Date(`${startISO}T00:00:00Z`);

  while (out.length < days) {
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return out;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const cookieStore = await cookies();
  const supa = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
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

  const status = (data.status ?? "active") as CompanyStatus;

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

export async function POST(req: Request) {
  const rid = `bulkset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json({ ok: false, rid, error: "UNAUTH", message: "Ikke innlogget." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const choice_key = (body?.choice_key ?? "").trim();
    const tierFilter = body?.tier;
    const weekIndex = body?.weekIndex;

    if (!choice_key) {
      return NextResponse.json({ ok: false, rid, error: "MISSING_CHOICE_KEY", message: "choice_key mangler." }, { status: 400 });
    }
    if (tierFilter && tierFilter !== "BASIS" && tierFilter !== "LUXUS") {
      return NextResponse.json({ ok: false, rid, error: "BAD_TIER", message: "Ugyldig tier." }, { status: 400 });
    }
    if (weekIndex !== undefined && weekIndex !== 0 && weekIndex !== 1) {
      return NextResponse.json({ ok: false, rid, error: "BAD_WEEK_INDEX", message: "Ugyldig weekIndex." }, { status: 400 });
    }

    // Service role client (ingen RLS)
    const supa = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "lunchportalen-order-bulk-set" } },
    });

    // ✅ profiles.id === auth.users.id (IKKE user_id)
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("company_id, location_id, role")
      .eq("id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr) {
      logApiError("POST /api/order/bulk-set profile failed", pErr, { rid, user_id });
      return NextResponse.json(
        { ok: false, rid, error: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke hente profil.", detail: pErr.message },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json({ ok: false, rid, error: "PROFILE_NOT_FOUND", message: "Fant ikke profil." }, { status: 403 });
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    if (!company_id || !location_id) {
      return NextResponse.json(
        { ok: false, rid, error: "PROFILE_MISSING_SCOPE", message: "Profil mangler company_id/location_id." },
        { status: 403 }
      );
    }

    // ✅ Company status gate (PAUSED/CLOSED)
    const gate = await assertCompanyActive(supa as any, company_id);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, rid, error: gate.error, message: gate.reason }, { status: gate.status });
    }

    // kontrakt
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("id, contract_week_tier, contract_basis_choices, contract_luxus_choices")
      .eq("id", company_id)
      .single();

    const company = (companyRaw ?? null) as CompanyRow | null;

    if (cErr || !company) {
      logApiError("POST /api/order/bulk-set company failed", cErr, { rid, company_id });
      return NextResponse.json(
        { ok: false, rid, error: "COMPANY_CONTRACT_NOT_FOUND", message: "Fant ikke kontrakt." },
        { status: 403 }
      );
    }

    const weekTier = company.contract_week_tier;
    const basisChoices = company.contract_basis_choices;
    const luxusChoices = company.contract_luxus_choices;

    if (!weekTier) {
      return NextResponse.json(
        { ok: false, rid, error: "CONTRACT_MISSING_WEEK_TIER", message: "Kontrakt mangler contract_week_tier." },
        { status: 400 }
      );
    }

    // bygg 2 uker (10 hverdager) og filtrer på uke hvis ønsket
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
      return NextResponse.json(
        {
          ok: true,
          rid,
          updated: 0,
          dates: [],
          receipts: [],
          skippedLocked,
          skippedTierMismatch,
          skippedNotAllowed,
          message: "Ingen dager å oppdatere (enten låst eller ikke tillatt).",
        },
        { status: 200 }
      );
    }

    // upsert batch
    const rows = targets.map((date) => ({
      company_id,
      location_id,
      user_id, // day_choices.user_id = auth.users.id (bruker-id)
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
      return NextResponse.json(
        { ok: false, rid, error: "SAVE_FAILED", message: "Kunne ikke lagre bulk-valg.", detail: uErr.message },
        { status: 500 }
      );
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

    return NextResponse.json(
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
      },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("POST /api/order/bulk-set failed", e, { rid });
    return NextResponse.json(
      { ok: false, rid, error: "SERVER_ERROR", message: "Uventet feil.", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
