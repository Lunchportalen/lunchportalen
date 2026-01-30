// app/api/order/window/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabase/server";
import { getMenuForRange } from "@/lib/sanity/queries";
import { normalizeAgreement, resolveTierForDate } from "@/lib/agreements/normalizeAgreement";

// ✅ Dag-3 standard guards (samme mønster som toggle/cancel)
import { scopeOr401 } from "@/lib/http/routeGuard";
import { noStoreHeaders } from "@/lib/http/noStore";

// ✅ Oslo SSoT
import { osloTodayISODate, addDaysISO, isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type CompanyStatusNorm = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

type OrderRow = {
  date: string;
  status: string | null;
  note: string | null;
  updated_at: string | null;
  slot: string | null;
  location_id: string | null;
};

type CompanyPolicy = {
  status: CompanyStatusNorm;
  canEditOrders: boolean;
  lockReason: "PAUSED" | "CLOSED" | "NOT_ACTIVE" | null;
  paused_reason: string | null;
  closed_reason: string | null;
};

type CompanyPolicyResult =
  | { ok: true; policy: CompanyPolicy }
  | { ok: false; status: number; error: string; message: string; detail?: any };

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

function ridFromReq(req: NextRequest) {
  const h = String(req.headers.get("x-rid") ?? "").trim();
  if (h) return h;
  return `window_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

function weekdayKeyFromISO(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, any> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd];
  if (!key) throw new Error("Kun Man–Fre er gyldig.");
  return key;
}

function parseChoiceFromNote(note: string | null): string | null {
  if (!note) return null;
  const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(note);
  return m?.[1] ? m[1] : null;
}

function hhmmFromIso(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/* =========================
   Company policy (service role)
========================= */

function normCompanyStatus(v: any): CompanyStatusNorm {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

async function getCompanyPolicy(supa: SupabaseClient<any, any, any>, companyId: string): Promise<CompanyPolicyResult> {
  const { data, error } = await (supa as any)
    .from("companies")
    .select("id,status,paused_reason,closed_reason")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      status: 500,
      error: "COMPANY_LOOKUP_FAILED",
      message: "Kunne ikke hente firmastatus.",
      detail: error?.message ?? "Company lookup failed",
    };
  }

  const status = normCompanyStatus((data as any).status);
  const paused_reason = ((data as any).paused_reason as string | null) ?? null;
  const closed_reason = ((data as any).closed_reason as string | null) ?? null;

  if (status === "ACTIVE") {
    return { ok: true as const, policy: { status, canEditOrders: true, lockReason: null, paused_reason, closed_reason } };
  }
  if (status === "PAUSED") {
    return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "PAUSED", paused_reason, closed_reason } };
  }
  if (status === "CLOSED") {
    return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "CLOSED", paused_reason, closed_reason } };
  }
  return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "NOT_ACTIVE", paused_reason, closed_reason } };
}

/* =========================
   Agreement unwrap + choices
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

const PRICE_PER_TIER: Record<Tier, number> = { BASIS: 90, LUXUS: 130 };

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

function getChoicesForTier(agreement: any, tier: Tier): Choice[] {
  if (!agreement) return [];
  if (agreement.choicesByTier && Array.isArray(agreement.choicesByTier[tier])) return agreement.choicesByTier[tier] as Choice[];
  if (agreement.choices && Array.isArray(agreement.choices[tier])) return agreement.choices[tier] as Choice[];
  if (agreement.tiers?.[tier] && Array.isArray(agreement.tiers[tier].choices)) return agreement.tiers[tier].choices as Choice[];
  if (agreement.weekplan?.tiers?.[tier] && Array.isArray(agreement.weekplan.tiers[tier].choices))
    return agreement.weekplan.tiers[tier].choices as Choice[];
  return [];
}

function statusNorm(v: any): "ACTIVE" | "CANCELLED" | "NONE" | "OTHER" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  if (!s) return "NONE";
  return "OTHER";
}

/* =========================
   Date window (Mon–Fri only)
========================= */

function isWeekdayISO(iso: string): boolean {
  // 1=Mon ... 7=Sun
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function getNextWorkdays(startISO: string, count: number) {
  const out: string[] = [];
  let cur = startISO;

  // failsafe: max 21 dager scanning for å samle count arbeidsdager
  for (let i = 0; i < 21 && out.length < count; i++) {
    if (isIsoDate(cur) && isWeekdayISO(cur)) out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

/* =========================================================
   Route
========================================================= */

export async function GET(req: NextRequest) {
  const rid = ridFromReq(req);

  // ✅ scope gate (én sannhetskilde)
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { scope } = a.ctx;

  // Window gjelder kun ansatte/company_admin (kitchen/driver/superadmin skal ikke bruke denne)
  if (scope.role !== "employee" && scope.role !== "company_admin") {
    return NextResponse.json(
      { ok: false, rid, error: "FORBIDDEN_ROLE", message: "Ingen tilgang." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!company_id || !location_id) {
    return NextResponse.json(
      { ok: false, rid, error: "PROFILE_MISSING_SCOPE", message: "Fant ikke profil/scope." },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  try {
    // ✅ Service role client (kun for companies + agreement)
    const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = assertEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "lunchportalen-order-window" } },
    });

    // Company policy
    const polRes = await getCompanyPolicy(admin as any, company_id);
    if (polRes.ok === false) {
      return NextResponse.json(
        { ok: false, rid, error: polRes.error, message: polRes.message, detail: polRes.detail },
        { status: polRes.status, headers: noStoreHeaders() }
      );
    }

    const policy = polRes.policy;

    const company = {
      id: company_id,
      status: policy.status,
      canEditOrders: policy.canEditOrders,
      lockReason: policy.lockReason,
      paused_reason: policy.paused_reason,
      closed_reason: policy.closed_reason,
      name: undefined as any,
      policy: policy.lockReason
        ? policy.lockReason === "PAUSED"
          ? "Bestilling/avbestilling er midlertidig pauset."
          : policy.lockReason === "CLOSED"
            ? "Firma er stengt. Bestilling/avbestilling er låst."
            : "Firma er ikke aktivt. Bestilling/avbestilling er låst."
        : undefined,
    };

    // Agreement (service role)
    const { data: agreementRow, error: aErr } = await (admin as any)
      .from("company_current_agreement")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (aErr) {
      return NextResponse.json(
        { ok: false, rid, error: "AGREEMENT_FETCH_FAILED", message: "Kunne ikke hente avtale.", detail: aErr?.message },
        { status: 500, headers: noStoreHeaders() }
      );
    }

    // Dates (10 arbeidsdager fra i dag)
    const today = osloTodayISODate();
    const dates = getNextWorkdays(today, 10);
    const fromISO = dates[0] ?? today;
    const toISO = dates[dates.length - 1] ?? today;

    // Menu (Sanity)
    const menuItems = await getMenuForRange(fromISO, toISO).catch(() => []);
    const menuByDate = new Map<string, any>();
    for (const it of menuItems || []) if (it?.date) menuByDate.set(it.date, it);

    // Orders (RLS-klient) – tenant-sikkert
    const sb = await supabaseServer();
    const { data: ordersRaw, error: oErr } = await (sb as any)
      .from("orders")
      .select("date,status,note,updated_at,slot,location_id")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .in("date", dates);

    if (oErr) {
      return NextResponse.json(
        { ok: false, rid, error: "ORDERS_FETCH_FAILED", message: "Kunne ikke hente bestilling.", detail: oErr.message },
        { status: 500, headers: noStoreHeaders() }
      );
    }

    const byDate = new Map<string, OrderRow>();
    for (const o of (ordersRaw ?? []) as OrderRow[]) {
      const dISO = asDateISO(o?.date);
      if (!dISO) continue;
      byDate.set(dISO, o);
    }

    // Normalize agreement
    const normRes = agreementRow ? normalizeAgreement(agreementRow) : null;
    const unwrapped = unwrapAgreement(normRes);
    const agreement = unwrapped.ok ? unwrapped.agreement : null;

    const days = dates.map((date) => {
      const menu = menuByDate.get(date);

      const resolved = agreement ? resolveTierForDate(agreement, date) : null;
      const { tier, unit_price } = extractTierAndPrice(resolved);

      const isEnabled = !!tier;
      const allowedChoices: Choice[] = tier ? getChoicesForTier(agreement, tier) : [];

      const saved = byDate.get(date);
      const sNorm = statusNorm(saved?.status);
      const wantsLunch = sNorm === "ACTIVE";

      const selectedChoiceKey = parseChoiceFromNote(saved?.note ?? null);
      const selectedOk = selectedChoiceKey && allowedChoices.some((c) => c.key === selectedChoiceKey);
      const safeSelected = selectedOk ? selectedChoiceKey : null;

      const cutoff = cutoffStatusForDate(date);
      const dateLocked = cutoff === "PAST" || cutoff === "TODAY_LOCKED";

      return {
        date,
        weekday: weekdayKeyFromISO(date),

        // ✅ dag-lås + firmalås
        isLocked: dateLocked || !company.canEditOrders,
        isEnabled,

        // stabil default hvis !isEnabled
        tier: (tier ?? "BASIS") as Tier,
        allowedChoices,

        wantsLunch,
        selectedChoiceKey: wantsLunch ? safeSelected : null,

        menuTitle: menu?.title ?? null,
        menuDescription: menu?.description ?? null,
        allergens: (menu?.allergens ?? []) as string[],

        lastSavedAt: hhmmFromIso(saved?.updated_at) ?? null,

        // fremtidig bruk i UI
        unit_price: unit_price ?? (tier ? PRICE_PER_TIER[tier] : null),
      };
    });

    return NextResponse.json(
      {
        ok: true,
        rid,
        scope: { company_id, location_id, user_id },
        company,
        range: { from: fromISO, to: toISO },
        days,
      },
      { status: 200, headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, rid, error: "SERVER_ERROR", detail: String(e?.message ?? e) },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
