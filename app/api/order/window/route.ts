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
import { scopeOr401 } from "@/lib/http/routeGuard";
import { osloTodayISODate, addDaysISO, isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { canSeeNextWeek, weekStartMon } from "@/lib/week/availability";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type AgreementStatusOut = "ACTIVE" | "PENDING_COMPANY" | "STARTS_LATER" | "NOT_READY";
type CompanyStatusNorm = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

type OrderRow = {
  date: string;
  status: string | null; // DB enum: active | canceled
  note: string | null; // legacy: used to store choice_key
  updated_at: string | null;
  created_at: string | null;
  slot: string | null;
  location_id: string | null;
  company_id?: string | null;
  user_id?: string | null;
};

type DayChoiceRow = {
  date: string;
  choice_key: string;
  note: string | null;
  status: string | null; // "ACTIVE"/"CANCELLED" (our model)
  updated_at: string | null;
};

type CompanyPolicy = {
  status: CompanyStatusNorm;
  canEditOrders: boolean;
  lockReason: "PAUSED" | "CLOSED" | "NOT_ACTIVE" | null;
  paused_reason: string | null;
  closed_reason: string | null;
  name: string | null;
};

type CompanyPolicyResult =
  | { ok: true; policy: demonstratingPolicy }
  | { ok: false; status: number; error: string; message: string; detail?: any };

// TS helper: keep object literal in one place
type demonstratingPolicy = CompanyPolicy;

function envOrNull(v: string | undefined) {
  const s = String(v ?? "").trim();
  return s ? s : null;
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

function weekdayKeyFromISO(dateISO: string): DayKey {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
  const map: Record<string, DayKey> = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri" };
  const key = map[wd];
  if (!key) throw new Error("Kun Man–Fre er gyldig.");
  return key;
}

/**
 * ✅ Note parsing:
 * - legacy: "choice:varmmat"
 * - legacy: "varmmat"
 */
function parseChoiceKeyFromNote(note: string | null): string | null {
  if (!note) return null;
  const raw = String(note).trim().toLowerCase();
  const m = /(?:^|\s)choice:([a-z0-9_\-]+)/i.exec(raw);
  if (m?.[1]) return m[1].toLowerCase();
  if (/^[a-z0-9_\-]{2,}$/.test(raw)) return raw;
  return null;
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
    .select("id,status,paused_reason,closed_reason,name")
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
  const name = ((data as any).name as string | null) ?? null;

  if (status === "ACTIVE") {
    return { ok: true as const, policy: { status, canEditOrders: true, lockReason: null, paused_reason, closed_reason, name } };
  }
  if (status === "PAUSED") {
    return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "PAUSED", paused_reason, closed_reason, name } };
  }
  if (status === "CLOSED") {
    return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "CLOSED", paused_reason, closed_reason, name } };
  }
  return { ok: true as const, policy: { status, canEditOrders: false, lockReason: "NOT_ACTIVE", paused_reason, closed_reason, name } };
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

const PRICE_PER_TIER_EX_VAT: Record<Tier, number> = { BASIS: 90, LUXUS: 130 };

const FIXED_CHOICES_BY_TIER: Record<Tier, Choice[]> = {
  BASIS: [
    { key: "salatbar", label: "Salatbar" },
    { key: "paasmurt", label: "Påsmurt" },
    { key: "varmmat", label: "Varmmat" },
  ],
  LUXUS: [
    { key: "salatbar", label: "Salatbar" },
    { key: "paasmurt", label: "Påsmurt" },
    { key: "varmmat", label: "Varmmat" },
    { key: "sushi", label: "Sushi" },
    { key: "pokebowl", label: "Pokébowl" },
    { key: "thaimat", label: "Thaimat" },
  ],
};

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
  const raw = String(v ?? "").trim();
  if (!raw) return "NONE";
  const s = raw.toLowerCase();
  if (s === "active") return "ACTIVE";
  if (s === "canceled" || s === "cancelled") return "CANCELLED";
  return "OTHER";
}

/* =========================
   Strict fallback helpers
========================= */

function normTierStrict(v: any): Tier | null {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "BASIS" || s === "LUXUS" ? (s as Tier) : null;
}

function normDayKeyStrict(v: any): DayKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "mon" || s === "tue" || s === "wed" || s === "thu" || s === "fri") return s as DayKey;
  return null;
}

/* =========================
   Date window helpers (Mon–Fri only) + week rules
========================= */

function isoFromDateOsloWall(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const m = pick("month");
  const day = pick("day");
  return `${y}-${m}-${day}`;
}

function getWeekdaysMonFri(startISO: string) {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(startISO, i));
}

function normalizeScopeIds(scope: any) {
  const sc: any = scope ?? {};
  const user_id = String(sc.user_id ?? sc.userId ?? sc.userID ?? "").trim();
  const company_id = String(sc.company_id ?? sc.companyId ?? sc.companyID ?? "").trim();
  const location_id = String(sc.location_id ?? sc.locationId ?? sc.locationID ?? "").trim();
  const role = String(sc.role ?? "").trim();
  return { user_id, company_id, location_id, role };
}

/* =========================
   Sanity menu helpers
========================= */

function menuDateKey(it: any): string | null {
  const key =
    (typeof it?.date === "string" && it.date.slice(0, 10)) ||
    (typeof it?.dateISO === "string" && it.dateISO.slice(0, 10)) ||
    (typeof it?.date_iso === "string" && it.date_iso.slice(0, 10)) ||
    (typeof it?.day === "string" && it.day.slice(0, 10)) ||
    (typeof it?.dateTime === "string" && it.dateTime.slice(0, 10)) ||
    (typeof it?.datetime === "string" && it.datetime.slice(0, 10)) ||
    null;

  return key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function pickMenuForChoice(menu: any, choiceKey: string | null) {
  const fallback = {
    title: menu?.title ?? null,
    description: menu?.description ?? null,
    allergens: Array.isArray(menu?.allergens) ? menu.allergens : [],
  };

  const k = String(choiceKey ?? "").trim().toLowerCase();
  if (!menu || !k) return fallback;

  const node =
    menu?.[k] ||
    menu?.choices?.[k] ||
    menu?.menu?.[k] ||
    (Array.isArray(menu?.choices) ? menu.choices.find((x: any) => String(x?.key ?? "").toLowerCase() === k) : null) ||
    (Array.isArray(menu?.items) ? menu.items.find((x: any) => String(x?.key ?? "").toLowerCase() === k) : null) ||
    null;

  if (!node) return fallback;

  return {
    title: node?.title ?? node?.name ?? fallback.title,
    description: node?.description ?? node?.text ?? fallback.description,
    allergens: Array.isArray(node?.allergens) ? node.allergens : fallback.allergens,
  };
}

/* =========================================================
   Route
========================================================= */

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { getMenuForRange } = await import("@/lib/sanity/queries");

  const rid = ridFromReq(req);

  // scope gate
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { scope } = a.ctx;
  const sc = normalizeScopeIds(scope);

  if (sc.role !== "employee" && sc.role !== "company_admin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN_ROLE");
  }
  if (!sc.user_id || !sc.company_id || !sc.location_id) {
    return jsonErr(rid, "Fant ikke profil/scope.", 403, "PROFILE_MISSING_SCOPE");
  }

  try {
    // service role client
    const url = envOrNull(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const service = envOrNull(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!url || !service) {
      return jsonErr(rid, "Mangler service role konfigurasjon for firmastatus/avtale.", 500, {
        code: "CONFIG_ERROR",
        detail: { missing: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"] },
      });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "lunchportalen-order-window" } },
    });

    // policy
    const polRes = await getCompanyPolicy(admin as any, sc.company_id);
    if (polRes.ok === false) return jsonErr(rid, polRes.message, polRes.status ?? 400, polRes.error);

    const policy = polRes.policy;

    const company = {
      id: sc.company_id,
      name: policy.name ?? undefined,
      status: policy.status,
      canEditOrders: policy.canEditOrders,
      lockReason: policy.lockReason,
      paused_reason: policy.paused_reason,
      closed_reason: policy.closed_reason,
      policy: policy.lockReason
        ? policy.lockReason === "PAUSED"
          ? "Bestilling/avbestilling er midlertidig pauset."
          : policy.lockReason === "CLOSED"
            ? "Firma er stengt. Bestilling/avbestilling er låst."
            : "Firma er ikke aktivt. Bestilling/avbestilling er låst."
        : undefined,
    };

    // dates
    const now = new Date();
    const today = osloTodayISODate();

    const openNextWeek = canSeeNextWeek(now);
    const thisWeekStartDate = weekStartMon(now);
    const thisWeekStartISO = isoFromDateOsloWall(thisWeekStartDate);
    const nextWeekStartISO = addDaysISO(thisWeekStartISO, 7);

    const thisWeekDatesAll = getWeekdaysMonFri(thisWeekStartISO);
    const nextWeekDatesAll = getWeekdaysMonFri(nextWeekStartISO);

    const thisWeekDatesFiltered = thisWeekDatesAll.filter((d) => d >= today);
    const thisWeekHead = thisWeekDatesFiltered.length ? thisWeekDatesFiltered : thisWeekDatesAll;

    let dates: string[] = [];
    if (openNextWeek) dates = [...thisWeekHead.slice(0, 5), ...nextWeekDatesAll.slice(0, 5)];
    else dates = thisWeekHead.slice(0, 5);
    dates = dates.slice(0, 10);

    const fromISO = dates[0] ?? today;
    const toISO = dates[dates.length - 1] ?? today;

    // sanity menu
    const menuItems = await getMenuForRange(fromISO, toISO).catch(() => []);
    const menuByDate = new Map<string, any>();
    for (const it of menuItems || []) {
      const key = menuDateKey(it);
      if (key) menuByDate.set(key, it);
    }

    // optional debug to kill "Meny: Kommer" fast
    // opsLog("window.menu.debug", { rid, count: (menuItems as any[])?.length ?? 0, first: (menuItems as any[])?.[0] ?? null });

    // orders (RLS)
    const sb = await supabaseServer();
    const { data: ordersRaw, error: oErr } = await (sb as any)
      .from("orders")
      .select("date,status,note,updated_at,created_at,slot,location_id,company_id,user_id")
      .eq("user_id", sc.user_id)
      .eq("company_id", sc.company_id)
      .eq("location_id", sc.location_id)
      .eq("slot", "lunch")
      .in("date", dates);

    if (oErr) return jsonErr(rid, "Kunne ikke hente bestilling.", 500, "ORDERS_FETCH_FAILED");

    const ordersByDate = new Map<string, OrderRow>();
    for (const o of (ordersRaw ?? []) as OrderRow[]) {
      const dISO = asDateISO((o as any)?.date);
      if (!dISO) continue;
      ordersByDate.set(dISO, o);
    }

    // day choices (service role)
    const { data: dcRaw, error: dcErr } = await (admin as any)
      .from("day_choices")
      .select("date,choice_key,note,status,updated_at")
      .eq("user_id", sc.user_id)
      .eq("company_id", sc.company_id)
      .eq("location_id", sc.location_id)
      .in("date", dates);

    if (dcErr) {
      opsLog("window.day_choices.failed", { rid, company_id: sc.company_id, detail: String(dcErr?.message ?? dcErr) });
    }

    const dayChoicesByDate = new Map<string, DayChoiceRow>();
    for (const r of (dcRaw ?? []) as DayChoiceRow[]) {
      const dISO = asDateISO((r as any)?.date);
      if (!dISO) continue;

      const prev = dayChoicesByDate.get(dISO);
      const prevT = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
      const nextT = r?.updated_at ? new Date(r.updated_at).getTime() : 0;
      if (!prev || nextT >= prevT) dayChoicesByDate.set(dISO, r);
    }

    // agreement
    let startDateISO: string | null = null;
    let deliveryDays: DayKey[] = [];
    let dayTiers: Record<DayKey, Tier> = {} as any;

    let agreementMessage: string | null = null;
    let agreementStatus: AgreementStatusOut = "NOT_READY";

    try {
      const agreementState = await getCurrentAgreementState({ rid });
      if (agreementState?.ok) {
        startDateISO = asDateISO((agreementState as any).startDate);
        deliveryDays = Array.isArray((agreementState as any).deliveryDays) ? ((agreementState as any).deliveryDays as DayKey[]) : [];
        dayTiers = ((agreementState as any).dayTiers as any) ?? ({} as any);

        const statusRaw = String((agreementState as any).status ?? "").trim().toUpperCase();
        const startsLater = Boolean(startDateISO && isIsoDate(startDateISO) && startDateISO > today);

        if (policy.status === "PENDING") {
          agreementStatus = "PENDING_COMPANY";
          agreementMessage = "Firmaet er ikke aktivert ennå. Kontakt firma-admin.";
        } else if (startsLater) {
          agreementStatus = "STARTS_LATER";
        } else if (statusRaw === "ACTIVE" || (Object.keys(dayTiers).length && deliveryDays.length)) {
          agreementStatus = "ACTIVE";
        } else {
          agreementStatus = "NOT_READY";
        }
      }
    } catch (e: any) {
      opsLog("window.agreement.primary_failed", { rid, company_id: sc.company_id, detail: String(e?.message ?? e) });
    }

    // fallback days
    const needsDaysFallback = !deliveryDays.length || !Object.keys(dayTiers).length;
    if (needsDaysFallback) {
      const { data: dayRows, error: dErr } = await (admin as any)
        .from("company_current_agreement_days")
        .select("day_key,tier")
        .eq("company_id", sc.company_id);

      if (dErr) {
        opsLog("window.days_fallback.failed", { rid, company_id: sc.company_id, detail: String(dErr?.message ?? dErr) });
      } else if (Array.isArray(dayRows) && dayRows.length) {
        const next: Record<DayKey, Tier> = {} as any;
        for (const r of dayRows) {
          const dk = normDayKeyStrict((r as any).day_key);
          const tr = normTierStrict((r as any).tier);
          if (!dk || !tr) continue;
          next[dk] = tr;
        }
        dayTiers = next;
        deliveryDays = Object.keys(next) as DayKey[];
        if (agreementStatus === "NOT_READY" && Object.keys(dayTiers).length && deliveryDays.length) agreementStatus = "ACTIVE";
      }
    }

    const agreementUsable = agreementStatus === "ACTIVE";

    // normalize agreement choices (best effort)
    let agreementForChoices: any = null;
    if (agreementUsable) {
      try {
        const { data: agreementRow, error: aErr } = await (admin as any)
          .from("company_current_agreement")
          .select("*")
          .eq("company_id", sc.company_id)
          .in("status", ["ACTIVE", "active"])
          .maybeSingle();

        if (!aErr && agreementRow) {
          const normRes = normalizeAgreement(agreementRow);
          const unwrapped = unwrapAgreement(normRes);
          agreementForChoices = unwrapped.ok ? unwrapped.agreement : null;
        }
      } catch {
        agreementForChoices = null;
      }
    }

    const days = dates.map((date) => {
      const dayKey = weekdayKeyFromISO(date);

      const tier: Tier | null = (dayTiers as any)[dayKey] ?? null;
      const isDeliveryDay = deliveryDays.includes(dayKey);

      const isEnabled = Boolean(agreementUsable && isDeliveryDay && tier);

      const agreementChoices = isEnabled && tier ? getChoicesForTier(agreementForChoices, tier) : [];
      const allowedChoices: Choice[] =
        agreementChoices.length ? agreementChoices : isEnabled && tier ? FIXED_CHOICES_BY_TIER[tier] : [];

      const savedOrder = ordersByDate.get(date);
      const sNorm = statusNorm(savedOrder?.status);

      const wantsLunch = sNorm === "ACTIVE";

      // choice source
      const dc = dayChoicesByDate.get(date);
      const dcChoice = dc?.choice_key ? String(dc.choice_key).trim().toLowerCase() : null;
      const legacyChoice = parseChoiceKeyFromNote(savedOrder?.note ?? null);

      const rawSelected = dcChoice || legacyChoice || null;
      const selectedOk = rawSelected ? allowedChoices.some((c) => c.key === rawSelected) : false;
      const safeSelected = selectedOk ? rawSelected : null;

      const dcNote = dc?.note ?? null;
      const legacyNote = (() => {
        const n = String(savedOrder?.note ?? "").trim();
        if (!n) return null;
        if (/^[a-z0-9_\-]{2,}$/i.test(n) || /choice:[a-z0-9_\-]+/i.test(n)) return null;
        return n;
      })();

      const cutoff = cutoffStatusForDate(date);
      const dateLocked = cutoff === "PAST" || cutoff === "TODAY_LOCKED";
      const lockReason = dateLocked ? "CUTOFF" : !company.canEditOrders ? "COMPANY" : null;

      const menu = menuByDate.get(date) ?? null;
      const picked = pickMenuForChoice(menu, safeSelected);

      return {
        date,
        weekday: dayKey,

        isLocked: dateLocked || !company.canEditOrders,
        isEnabled,
        lockReason,

        tier,
        allowedChoices,

        wantsLunch,
        orderStatus: sNorm === "ACTIVE" ? "ACTIVE" : sNorm === "CANCELLED" ? "CANCELLED" : null,
        selectedChoiceKey: wantsLunch ? safeSelected : null,

        note: dcNote ?? legacyNote ?? null,

        menuTitle: picked.title ?? null,
        menuDescription: picked.description ?? null,
        allergens: (picked.allergens ?? []) as string[],

        lastSavedAt:
          hhmmFromIso(dc?.updated_at) ??
          hhmmFromIso(savedOrder?.updated_at) ??
          hhmmFromIso(savedOrder?.created_at) ??
          null,

        unit_price: tier ? PRICE_PER_TIER_EX_VAT[tier] : null,
      };
    });

    return jsonOk(
      rid,
      {
        ok: true,
        scope: { company_id: sc.company_id, location_id: sc.location_id, user_id: sc.user_id },
        company,
        agreement: {
          status: agreementStatus,
          message: agreementMessage,
          start_date: startDateISO,
          delivery_days: deliveryDays,
        },
        range: { from: fromISO, to: toISO },
        days,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
