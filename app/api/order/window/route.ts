// app/api/order/window/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMenuForRange } from "@/lib/sanity/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "PREMIUM";
type Choice = { key: string; label?: string };

type CompanyStatus = "active" | "paused" | "closed";

type ProfileRow = {
  company_id: string | null;
  location_id: string | null;
};

type CompanyRow = {
  contract_week_tier: Record<string, Tier> | null;
  contract_basis_choices: Choice[] | null;
  contract_premium_choices: Choice[] | null;
  status?: CompanyStatus | null;
  paused_reason?: string | null;
  closed_reason?: string | null;
};

type DayOrderRow = {
  date: string; // YYYY-MM-DD or timestamptz-ish
  wants_lunch: boolean | null;
  choice_key: string | null;
  status: string | null; // ACTIVE/CANCELLED/etc.
  updated_at: string | null;
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

function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";

  const locked =
    dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;

  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function isLocked(dateISO: string) {
  return cutoffState(dateISO).locked;
}

function weekdayKeyOslo(dateISO: string): DayKey {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd as keyof typeof map];
  if (!key) throw new Error("Kun Man–Fre er gyldig.");
  return key;
}

function weekdayLabelNO(dateISO: string): "Man" | "Tir" | "Ons" | "Tor" | "Fre" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, any> = { Mon: "Man", Tue: "Tir", Wed: "Ons", Thu: "Tor", Fri: "Fre" };
  const label = map[wd];
  if (!label) throw new Error("Kun Man–Fre er gyldig.");
  return label;
}

function getNextWeekdays(startISO: string, days: number) {
  const out: string[] = [];
  let d = new Date(`${startISO}T00:00:00Z`);
  while (out.length < days) {
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function asDateISO(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return null;
  }
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

/** ✅ Premium inkluderer alltid Basis (union uten duplikater) */
function mergeChoices(basis: Choice[] = [], premium: Choice[] = []) {
  const seen = new Set<string>();
  const out: Choice[] = [];
  for (const c of basis) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  for (const c of premium) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

/* =========================
   Company status gate (PAUSED/CLOSED)
   - Bruk SupabaseClient<any, any, any> for å unngå TS "public vs never"
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

export async function GET() {
  const rid = `window_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const user_id = await getAuthedUserId();
    if (!user_id) {
      return NextResponse.json({ ok: false, rid, error: "UNAUTH", message: "Ikke innlogget." }, { status: 401 });
    }

    const supa = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "lunchportalen-order-window" } },
    });

    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr || !profile?.company_id || !profile?.location_id) {
      return NextResponse.json(
        { ok: false, rid, error: "PROFILE_MISSING_SCOPE", message: "Fant ikke profil/scope.", detail: pErr?.message },
        { status: 403 }
      );
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    // ✅ Company status gate (PAUSED/CLOSED)
    const gate = await assertCompanyActive(supa as any, company_id);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, rid, error: gate.error, message: gate.reason }, { status: gate.status });
    }

    // Firma-kontrakt: tier-plan + valg
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("contract_week_tier, contract_basis_choices, contract_premium_choices, status, paused_reason, closed_reason")
      .eq("id", company_id)
      .single();

    const company = (companyRaw ?? null) as CompanyRow | null;

    if (cErr || !company) {
      return NextResponse.json(
        { ok: false, rid, error: "COMPANY_CONTRACT_NOT_FOUND", message: "Fant ikke kontrakt.", detail: cErr?.message },
        { status: 403 }
      );
    }

    const weekTier = (company.contract_week_tier ?? {}) as Record<string, Tier>;
    const basisChoices = (Array.isArray(company.contract_basis_choices) ? company.contract_basis_choices : []) as Choice[];
    const premiumRaw = (Array.isArray(company.contract_premium_choices) ? company.contract_premium_choices : []) as Choice[];
    const premiumChoices = mergeChoices(basisChoices, premiumRaw);

    const today = osloNowParts().dateISO;
    const dates = getNextWeekdays(today, 10);

    // Les day_orders (wants + choice_key)
    const { data: ordersRaw, error: oErr } = await (supa as any)
      .from("day_orders")
      .select("date, wants_lunch, choice_key, status, updated_at")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .in("date", dates);

    if (oErr) {
      return NextResponse.json(
        { ok: false, rid, error: "DAYORDERS_FETCH_FAILED", message: "Kunne ikke hente bestilling.", detail: oErr.message },
        { status: 500 }
      );
    }

    const byDate = new Map<string, DayOrderRow>();
    for (const o of (ordersRaw ?? []) as DayOrderRow[]) {
      const dISO = asDateISO(o?.date);
      if (!dISO) continue;
      // Vi tar siste (hvis flere – skal ikke skje, men defensivt)
      byDate.set(dISO, o);
    }

    // Menytekst fra Sanity
    const fromISO = dates[0];
    const toISO = dates[dates.length - 1];

    const menuItems = await getMenuForRange(fromISO, toISO).catch(() => []);
    const menuByDate = new Map<string, any>();
    for (const it of menuItems || []) {
      if (it?.date) menuByDate.set(it.date, it);
    }

    const now = osloNowParts();

    const days = dates.map((date) => {
      const dayKey = weekdayKeyOslo(date);
      const weekdayNO = weekdayLabelNO(date);

      const tier = weekTier[dayKey] ?? null; // BASIS | PREMIUM | null
      const isEnabled = !!tier;

      const allowedChoices: Choice[] = !isEnabled ? [] : tier === "BASIS" ? basisChoices : premiumChoices;

      const menu = menuByDate.get(date);
      const menuDescription = menu?.description ?? null;
      const menuTitle = menu?.title ?? null;
      const allergens = (menu?.allergens ?? []) as string[];

      const saved = byDate.get(date);
      const statusRaw = (saved?.status ?? "").toString().toUpperCase();
      const isActive = statusRaw ? statusRaw === "ACTIVE" : true; // hvis status mangler, anta aktiv

      const wantsLunch = !!saved?.wants_lunch && isActive;
      const selectedChoiceKey = typeof saved?.choice_key === "string" ? saved.choice_key : null;

      // Hvis lagret valg ikke er tillatt (kontrakt endret), nullstill
      const selectedOk = selectedChoiceKey && allowedChoices.some((c) => c.key === selectedChoiceKey);
      const safeSelected = selectedOk ? selectedChoiceKey : null;

      const cutoff = cutoffState(date);

      return {
        date,
        weekday: dayKey,
        weekdayLabel: weekdayNO,
        isLocked: cutoff.locked,
        cutoffTime: cutoff.cutoffTime,
        now: `${now.dateISO}T${now.timeHM}`,
        isEnabled,
        tier, // styrt av firma
        allowedChoices,
        wantsLunch,
        selectedChoiceKey: wantsLunch ? safeSelected : null,
        menuTitle,
        menuDescription,
        allergens,
        lastSavedAt: saved?.updated_at ?? null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rid,
        scope: { company_id, location_id, user_id },
        range: { from: dates[0], to: dates[dates.length - 1] },
        days,
      },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("GET /api/order/window failed", e, { rid });
    return NextResponse.json(
      { ok: false, rid, error: "SERVER_ERROR", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
