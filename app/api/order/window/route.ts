// app/api/order/window/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAgreement } from "@/lib/agreements/normalizeAgreement";
import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { formatTimeNO } from "@/lib/date/format";

// ✅ Dag-3 standard guards (samme mønster som toggle/cancel)
import { scopeOr401 } from "@/lib/http/routeGuard";

// ✅ Oslo SSoT
import { osloTodayISODate, addDaysISO, isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";


type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type CompanyStatusNorm = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

type OrderRow = {
  date: string;
  status: string | null;
  note: string | null;
  updated_at: string | null;
  created_at: string | null;
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
  const t = formatTimeNO(iso);
  return t || null;
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
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { getMenuForRange } = await import("@/lib/sanity/queries");
  const rid = ridFromReq(req);

  // ✅ scope gate (én sannhetskilde)
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { scope } = a.ctx;

  // Window gjelder kun ansatte/company_admin (kitchen/driver/superadmin skal ikke bruke denne)
  if (scope.role !== "employee" && scope.role !== "company_admin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN_ROLE");
  }

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!company_id || !location_id) {
    return jsonErr(rid, "Fant ikke profil/scope.", 403, "PROFILE_MISSING_SCOPE");
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
      return jsonErr(rid, polRes.message, polRes.status ?? 400, polRes.error);
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
      .select("date,status,note,updated_at,created_at,slot,location_id")
      .eq("user_id", user_id)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .in("date", dates);

    if (oErr) {
      return jsonErr(rid, "Kunne ikke hente bestilling.", 500, "ORDERS_FETCH_FAILED");
    }

    const byDate = new Map<string, OrderRow>();
    for (const o of (ordersRaw ?? []) as OrderRow[]) {
      const dISO = asDateISO(o?.date);
      if (!dISO) continue;
      byDate.set(dISO, o);
    }

    const agreementState = await getCurrentAgreementState({ rid });
    if (!agreementState.ok) {
      const err = agreementState as { status: number; error: string; message: string };
      return jsonErr(rid, err.message, err.status ?? 400, err.error);
    }

    if (agreementState.companyId !== company_id) {
      return jsonErr(rid, "Avtale matcher ikke firmatilknytning.", 403, "AGREEMENT_SCOPE_MISMATCH");
    }

    const agreementUsable = agreementState.status === "ACTIVE";
    const deliveryDays = agreementState.deliveryDays ?? [];
    const dayTiers = agreementState.dayTiers ?? {};

    let agreementMessage: string | null = null;
    if (!agreementUsable) {
      if (agreementState.statusReason === "MISSING_DAYMAP") agreementMessage = "Avtalen mangler dagoppsett.";
      else if (agreementState.statusReason === "MISSING_DELIVERY_DAYS") agreementMessage = "Avtalen mangler gyldige leveringsdager.";
      else agreementMessage = "Ingen aktiv avtale for firma.";
    }

    let agreementForChoices: any = null;
    if (agreementUsable) {
      const { data: agreementRow, error: aErr } = await (admin as any)
        .from("company_current_agreement")
        .select("*")
        .eq("company_id", company_id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (aErr) {
        return jsonErr(rid, "Kunne ikke hente avtale.", 500, "AGREEMENT_FETCH_FAILED");
      }

      try {
        const normRes = agreementRow ? normalizeAgreement(agreementRow) : null;
        const unwrapped = unwrapAgreement(normRes);
        agreementForChoices = unwrapped.ok ? unwrapped.agreement : null;
      } catch {
        agreementForChoices = null;
      }
    }

    const days = dates.map((date) => {
      const menu = menuByDate.get(date);

      const dayKey = weekdayKeyFromISO(date);
      const isDeliveryDay = deliveryDays.includes(dayKey);
      const tier: Tier | null = dayTiers[dayKey] ?? null;
      const isEnabled = Boolean(agreementUsable && isDeliveryDay && tier);
      const allowedChoices: Choice[] = isEnabled && tier ? getChoicesForTier(agreementForChoices, tier) : [];

      const saved = byDate.get(date);
      const sNorm = statusNorm(saved?.status);
      const wantsLunch = sNorm === "ACTIVE";

      const selectedChoiceKey = parseChoiceFromNote(saved?.note ?? null);
      const selectedOk = selectedChoiceKey && allowedChoices.some((c) => c.key === selectedChoiceKey);
      const safeSelected = selectedOk ? selectedChoiceKey : null;

      const cutoff = cutoffStatusForDate(date);
      const dateLocked = cutoff === "PAST" || cutoff === "TODAY_LOCKED";
      const lockReason = dateLocked ? "CUTOFF" : !company.canEditOrders ? "COMPANY" : null;

      return {
        date,
        weekday: dayKey,

        // ✅ dag-lås + firmalås
        isLocked: dateLocked || !company.canEditOrders,
        isEnabled,
        lockReason,

        tier,
        allowedChoices,

        wantsLunch,
        orderStatus: sNorm === "ACTIVE" ? "ACTIVE" : sNorm === "CANCELLED" ? "CANCELLED" : null,
        selectedChoiceKey: wantsLunch ? safeSelected : null,

        menuTitle: menu?.title ?? null,
        menuDescription: menu?.description ?? null,
        allergens: (menu?.allergens ?? []) as string[],

        lastSavedAt: hhmmFromIso(saved?.updated_at) ?? hhmmFromIso(saved?.created_at) ?? null,

        unit_price:
          typeof agreementState.pricePerCuvertNok === "number"
            ? agreementState.pricePerCuvertNok
            : tier
              ? PRICE_PER_TIER[tier]
              : null,
      };
    });

    return jsonOk(rid, {
        scope: { company_id, location_id, user_id },
        company,
        agreement: {
          status: agreementUsable ? "ACTIVE" : "MISSING",
          message: agreementMessage,
          delivery_days: deliveryDays,
        },
        range: { from: fromISO, to: toISO },
        days,
      }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
