// app/api/order/window/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMenuForRange } from "@/lib/sanity/queries";

import { normalizeAgreement, resolveTierForDate } from "@/lib/agreements/normalizeAgreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type CompanyStatus = "active" | "paused" | "closed";

type ProfileRow = {
  company_id: string | null;
  location_id: string | null;
};

type OrderRow = {
  date: string; // YYYY-MM-DD or timestamptz-ish
  status: string | null; // ACTIVE/CANCELLED/etc.
  note: string | null;
  updated_at: string | null;
  slot: string | null;
  location_id: string | null;
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
  const locked = dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;
  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
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

/** ✅ choice lagres som note "choice:<key>" */
function parseChoiceFromNote(note: string | null): string | null {
  if (!note) return null;
  const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(note);
  return m?.[1] ? m[1] : null;
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
    return { ok: false as const, status: 500, error: "COMPANY_LOOKUP_FAILED", reason: error?.message ?? "Company lookup failed" };
  }

  const status = (data.status ?? "active") as CompanyStatus;

  if (status === "paused") {
    return { ok: false as const, status: 403, error: "COMPANY_PAUSED", reason: (data.paused_reason as string | null) ?? "Firma er pauset." };
  }

  if (status === "closed") {
    return { ok: false as const, status: 403, error: "COMPANY_CLOSED", reason: (data.closed_reason as string | null) ?? "Firma er stengt." };
  }

  return { ok: true as const };
}

/* =========================
   ✅ Unwrap normalizeAgreement-result (AgreementResult)
========================= */
type AgreementNormalized = any;

function unwrapAgreement(res: any): { ok: true; agreement: AgreementNormalized } | { ok: false } {
  if (!res) return { ok: false };

  if (typeof res === "object" && "ok" in res) {
    if ((res as any).ok === true && (res as any).agreement) return { ok: true, agreement: (res as any).agreement };
    return { ok: false };
  }

  if (typeof res === "object") return { ok: true, agreement: res };

  return { ok: false };
}

/* =========================
   ✅ Prices (API source of truth)
========================= */
const PRICE_PER_TIER: Record<Tier, number> = {
  BASIS: 90,
  LUXUS: 130,
};

/**
 * resolveTierForDate() hos dere returnerer ELLER:
 *  - "BASIS"/"LUXUS"
 *  - { tier: "BASIS"/"LUXUS", price: number }
 */
function extractTierAndPrice(res: any): { tier: Tier | null; unit_price: number | null } {
  if (typeof res === "string") {
    const t = res.toUpperCase().trim();
    if (t === "BASIS" || t === "LUXUS") return { tier: t as Tier, unit_price: PRICE_PER_TIER[t as Tier] };
    return { tier: null, unit_price: null };
  }

  if (res && typeof res === "object") {
    const rawTier = String((res as any).tier ?? "").toUpperCase().trim();
    const price = (res as any).price;

    const tier = rawTier === "BASIS" || rawTier === "LUXUS" ? (rawTier as Tier) : null;
    const unit_price = typeof price === "number" ? price : tier ? PRICE_PER_TIER[tier] : null;

    return { tier, unit_price };
  }

  return { tier: null, unit_price: null };
}

/**
 * ✅ Choices fra avtalen (defensiv for shape)
 */
function getChoicesForTier(agreement: any, tier: Tier): Choice[] {
  if (!agreement) return [];

  if (agreement.choicesByTier && Array.isArray(agreement.choicesByTier[tier])) return agreement.choicesByTier[tier] as Choice[];
  if (agreement.choices && Array.isArray(agreement.choices[tier])) return agreement.choices[tier] as Choice[];
  if (agreement.tiers?.[tier] && Array.isArray(agreement.tiers[tier].choices)) return agreement.tiers[tier].choices as Choice[];
  if (agreement.weekplan?.tiers?.[tier] && Array.isArray(agreement.weekplan.tiers[tier].choices)) return agreement.weekplan.tiers[tier].choices as Choice[];

  return [];
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

    // profiles (FASIT: profiles.user_id)
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

    // Company status gate (kun status)
    const gate = await assertCompanyActive(supa as any, company_id);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, rid, error: gate.error, message: gate.reason }, { status: gate.status });
    }

    // ✅ Én sannhet: company_current_agreement
    const { data: agreementRow, error: aErr } = await (supa as any)
      .from("company_current_agreement")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (aErr) {
      return NextResponse.json(
        { ok: false, rid, error: "AGREEMENT_FETCH_FAILED", message: "Kunne ikke hente avtale.", detail: aErr?.message },
        { status: 500 }
      );
    }

    const today = osloNowParts().dateISO;
    const dates = getNextWeekdays(today, 10);
    const fromISO = dates[0];
    const toISO = dates[dates.length - 1];

    // Menytekst fra Sanity
    const menuItems = await getMenuForRange(fromISO, toISO).catch(() => []);
    const menuByDate = new Map<string, any>();
    for (const it of menuItems || []) if (it?.date) menuByDate.set(it.date, it);

    // ✅ Les orders (fasit)
    const { data: ordersRaw, error: oErr } = await (supa as any)
      .from("orders")
      .select("date,status,note,updated_at,slot,location_id")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .in("date", dates);

    if (oErr) {
      return NextResponse.json(
        { ok: false, rid, error: "ORDERS_FETCH_FAILED", message: "Kunne ikke hente bestilling.", detail: oErr.message },
        { status: 500 }
      );
    }

    const byDate = new Map<string, OrderRow>();
    for (const o of (ordersRaw ?? []) as OrderRow[]) {
      const dISO = asDateISO(o?.date);
      if (!dISO) continue;
      byDate.set(dISO, o);
    }

    // ✅ Normalize agreement (kan være ugyldig)
    const normRes = agreementRow ? normalizeAgreement(agreementRow) : null;
    const unwrapped = unwrapAgreement(normRes);
    const agreement = unwrapped.ok ? unwrapped.agreement : null;

    const now = osloNowParts();

    const days = dates.map((date) => {
      const weekdayNO = weekdayLabelNO(date);
      const cutoff = cutoffState(date);
      const menu = menuByDate.get(date);

      // ✅ Per dag: resolveTierForDate(agreement, date) -> støtter både string og {tier,price}
      const resolved = agreement ? resolveTierForDate(agreement, date) : null;
      const { tier, unit_price } = extractTierAndPrice(resolved);

      const isEnabled = !!tier;

      // ✅ choices fra avtalen (ikke companies.*)
      const allowedChoices: Choice[] = tier ? getChoicesForTier(agreement, tier) : [];

      const saved = byDate.get(date);
      const statusRaw = String(saved?.status ?? "").toUpperCase().trim();
      const wantsLunch = statusRaw === "ACTIVE";

      const selectedChoiceKey = parseChoiceFromNote(saved?.note ?? null);

      // Hvis lagret valg ikke er tillatt (avtale endret), nullstill
      const selectedOk = selectedChoiceKey && allowedChoices.some((c) => c.key === selectedChoiceKey);
      const safeSelected = selectedOk ? selectedChoiceKey : null;

      return {
        date,
        weekdayLabel: weekdayNO,
        isLocked: cutoff.locked,
        cutoffTime: cutoff.cutoffTime,
        now: `${now.dateISO}T${now.timeHM}`,

        // ✅ Window (avtale = sannhet)
        isEnabled,
        tier,
        unit_price,
        allowedChoices,

        // ✅ Orders (faktisk status/valg)
        wantsLunch,
        selectedChoiceKey: wantsLunch ? safeSelected : null,

        // Meny
        menuTitle: menu?.title ?? null,
        menuDescription: menu?.description ?? null,
        allergens: (menu?.allergens ?? []) as string[],

        lastSavedAt: saved?.updated_at ?? null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rid,
        scope: { company_id, location_id, user_id },
        range: { from: fromISO, to: toISO },
        days,
      },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("GET /api/order/window failed", e, { rid });
    return NextResponse.json({ ok: false, rid, error: "SERVER_ERROR", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
