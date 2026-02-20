// app/api/order/window/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAgreement } from "@/lib/agreements/normalizeAgreement";
import { getCurrentAgreementState } from "@/lib/agreement/currentAgreement";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401 } from "@/lib/http/routeGuard";
import { formatTimeNO } from "@/lib/date/format";
import { osloTodayISODate, addDaysISO, isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { canSeeNextWeek, weekStartMon } from "@/lib/week/availability";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* =========================================================
   Types
========================================================= */

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "LUXUS";
type Choice = { key: string; label?: string };

type AgreementStatusOut = "ACTIVE" | "PENDING_COMPANY" | "STARTS_LATER" | "NOT_READY" | "MISSING";
type CompanyStatusNorm = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

type OrderRow = {
  date: string;
  status: string | null; // active | canceled
  note: string | null;
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
  status: string | null;
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
  | { ok: true; policy: CompanyPolicy }
  | { ok: false; status: number; error: string; message: string; detail?: any };

/* =========================================================
   Small utils
========================================================= */

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
  if (!key) throw new Error(`Ugyldig weekday for ${dateISO} (${wd}). Kun Man–Fre er gyldig.`);
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

function normalizeScopeIds(scope: any) {
  const sc: any = scope ?? {};
  const user_id = String(sc.user_id ?? sc.userId ?? sc.userID ?? "").trim();
  const company_id = String(sc.company_id ?? sc.companyId ?? sc.companyID ?? "").trim();
  const location_id = String(sc.location_id ?? sc.locationId ?? sc.locationID ?? "").trim();
  const role = String(sc.role ?? "").trim();
  return { user_id, company_id, location_id, role };
}

function statusNorm(v: any): "ACTIVE" | "CANCELLED" | "NONE" | "OTHER" {
  const raw = String(v ?? "").trim();
  if (!raw) return "NONE";
  const s = raw.toLowerCase();
  if (s === "active") return "ACTIVE";
  if (s === "canceled" || s === "cancelled") return "CANCELLED";
  return "OTHER";
}

function normTierStrict(v: any): Tier | null {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "BASIS" || s === "LUXUS" ? (s as Tier) : null;
}

function normDayKeyStrict(v: any): DayKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "mon" || s === "tue" || s === "wed" || s === "thu" || s === "fri") return s as DayKey;
  return null;
}

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

/* =========================================================
   Company policy (service role)
========================================================= */

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

/* =========================================================
   Agreement unwrap + choices
========================================================= */

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

/* =========================================================
   Sanity menu helpers
========================================================= */

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

  // role gate
  if (sc.role !== "employee" && sc.role !== "company_admin") {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN_ROLE");
  }
  if (!sc.user_id || !sc.company_id || !sc.location_id) {
    return jsonErr(rid, "Fant ikke profil/scope.", 403, "PROFILE_MISSING_SCOPE");
  }

  try {
    const admin = supabaseAdmin();

    // company policy
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

    const now = new Date();
    const today = osloTodayISODate();

    // weeks
    const weeksParam = Number(new URL(req.url).searchParams.get("weeks") ?? "");
    const wantsWeeks: 1 | 2 = weeksParam === 2 ? 2 : 1;

    const openNextWeek = canSeeNextWeek(now);
    const thisWeekStartISO = isoFromDateOsloWall(weekStartMon(now));
    const nextWeekStartISO = addDaysISO(thisWeekStartISO, 7);

    const thisWeekDatesAll = getWeekdaysMonFri(thisWeekStartISO);
    const nextWeekDatesAll = getWeekdaysMonFri(nextWeekStartISO);

    const thisWeekDatesFiltered = thisWeekDatesAll.filter((d) => d >= today);
    const thisWeekHead = thisWeekDatesFiltered.length ? thisWeekDatesFiltered : thisWeekDatesAll;

    let dates: string[] = [];
    if (wantsWeeks === 2 && openNextWeek) dates = [...thisWeekHead.slice(0, 5), ...nextWeekDatesAll.slice(0, 5)];
    else dates = thisWeekHead.slice(0, 5);

    dates = dates.slice(0, wantsWeeks === 2 ? 10 : 5);

    const fromISO = dates[0] ?? today;
    const toISO = dates[dates.length - 1] ?? today;

    // sanity menu
    const menuItems = await getMenuForRange(fromISO, toISO).catch(() => []);
    const menuByDate = new Map<string, any>();
    for (const it of menuItems || []) {
      const key = menuDateKey(it);
      if (key) menuByDate.set(key, it);
    }

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

    // day choices (service role) — best effort
    const dayChoicesByDate = new Map<string, DayChoiceRow>();
    try {
      const dcBase = (admin as any)
        .from("day_choices")
        .select("date,choice_key,note,status,updated_at")
        .eq("user_id", sc.user_id)
        .eq("company_id", sc.company_id)
        .eq("location_id", sc.location_id);

      if (typeof (dcBase as any).in === "function") {
        const { data: dcRaw0, error: dcErr } = await (dcBase as any).in("date", dates);
        if (dcErr) {
          opsLog("window.day_choices.failed", { rid, company_id: sc.company_id, detail: String(dcErr?.message ?? dcErr) });
        }
        const dcRaw = (dcRaw0 ?? []) as DayChoiceRow[];
        for (const r of dcRaw) {
          const dISO = asDateISO((r as any)?.date);
          if (!dISO) continue;

          const prev = dayChoicesByDate.get(dISO);
          const prevT = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
          const nextT = r?.updated_at ? new Date(r.updated_at).getTime() : 0;
          if (!prev || nextT >= prevT) dayChoicesByDate.set(dISO, r);
        }
      } else {
        opsLog("window.day_choices.skipped", { rid, reason: "query_builder_missing_in()", company_id: sc.company_id });
      }
    } catch (e: any) {
      opsLog("window.day_choices.exception", { rid, company_id: sc.company_id, detail: String(e?.stack || e?.message || e) });
    }

    // =========================================================
    // agreement (uses lib/agreement/currentAgreement.ts as-is)
    // =========================================================
    let startDateISO: string | null = null;
    let deliveryDays: DayKey[] = [];
    let dayTiers: Record<DayKey, Tier> = {} as any;

    let agreementMessage: string | null = null;
    let agreementStatus: AgreementStatusOut = "NOT_READY";
    let agreementRawStatus: string | null = null;

    try {
      const st = await getCurrentAgreementState({ rid });

      if ((st as any)?.ok === false) {
        const e = st as any;
        const msg = String(e?.message ?? "Ingen aktiv avtale.");
        const err = String(e?.error ?? "AGREEMENT_ERROR");
        const status = Number(e?.status ?? 500);

        if (status === 403 && err === "PROFILE_MISSING_SCOPE") {
          return jsonErr(rid, msg, 403, "AGREEMENT_SCOPE_MISMATCH");
        }

        agreementStatus = "MISSING";
        agreementMessage = msg;
      } else {
        const state = st as any;

        const stateCompanyId = String(state.companyId ?? "").trim();
        const stateLocationId = state.locationId ? String(state.locationId).trim() : "";

        if (stateCompanyId && stateCompanyId !== sc.company_id) {
          return jsonErr(rid, "Avtalen tilhører et annet firma.", 403, "AGREEMENT_SCOPE_MISMATCH");
        }
        if (sc.location_id && stateLocationId && stateLocationId !== sc.location_id) {
          return jsonErr(rid, "Avtalen tilhører en annen lokasjon.", 403, "AGREEMENT_SCOPE_MISMATCH");
        }

        startDateISO = state.startDate ? String(state.startDate).slice(0, 10) : null;
        deliveryDays = Array.isArray(state.deliveryDays) ? (state.deliveryDays as DayKey[]) : [];
        dayTiers = (state.dayTiers ?? {}) as Record<DayKey, Tier>;

        agreementRawStatus = String(state.status ?? "").trim().toUpperCase() || null;

        const startsLater = Boolean(startDateISO && isIsoDate(startDateISO) && startDateISO > today);

        if (policy.status === "PENDING") {
          agreementStatus = "PENDING_COMPANY";
          agreementMessage = "Firmaet er ikke aktivert ennå. Kontakt firma-admin.";
        } else if (startsLater) {
          agreementStatus = "STARTS_LATER";
        } else if (agreementRawStatus === "ACTIVE" || (Object.keys(dayTiers).length && deliveryDays.length)) {
          agreementStatus = "ACTIVE";
        } else if (agreementRawStatus === "MISSING") {
          agreementStatus = "MISSING";
          agreementMessage = "Ingen aktiv avtale.";
        } else {
          agreementStatus = "NOT_READY";
          agreementMessage = "Ingen aktiv avtale.";
        }

        if (agreementStatus === "ACTIVE" && state.statusReason === "NO_ACTIVE_AGREEMENT") {
          agreementMessage = "Avtalegrunnlag er aktivt (dagmap), men avtale-status er ikke ACTIVE.";
        }
        if (agreementStatus === "MISSING" && state.statusReason === "MISSING_DAYMAP") {
          agreementMessage = "Avtale mangler dagskart (daymap).";
        }
        if (agreementStatus === "MISSING" && state.statusReason === "MISSING_DELIVERY_DAYS") {
          agreementMessage = "Avtale mangler leveringsdager.";
        }
      }
    } catch (e: any) {
      opsLog("window.agreement.exception", { rid, company_id: sc.company_id, detail: String(e?.stack || e?.message || e) });
      agreementStatus = "NOT_READY";
      agreementMessage = "Ingen aktiv avtale.";
    }

    const agreementUsable = agreementStatus === "ACTIVE";

    // Best-effort choices normalization for tier choices
    let agreementForChoices: any = null;
    if (agreementUsable) {
      try {
        const q = (admin as any).from("company_current_agreement").select("*").eq("company_id", sc.company_id);
        const { data: agreementRow, error } = await (q as any).maybeSingle();
        if (!error && agreementRow) {
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
      const isDeliveryDay = Array.isArray(deliveryDays) ? deliveryDays.includes(dayKey) : false;

      const isEnabled = Boolean(agreementUsable && isDeliveryDay && tier);

      const agreementChoices = isEnabled && tier ? getChoicesForTier(agreementForChoices, tier) : [];
      const allowedChoices: Choice[] = agreementChoices.length ? agreementChoices : isEnabled && tier ? FIXED_CHOICES_BY_TIER[tier] : [];

      const savedOrder = ordersByDate.get(date);
      const sNorm = statusNorm(savedOrder?.status);
      const wantsLunch = sNorm === "ACTIVE";

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

      const lockReason =
        dateLocked ? "CUTOFF" :
        !company.canEditOrders ? "COMPANY" :
        !agreementUsable ? "COMPANY" :
        null;

      const menu = menuByDate.get(date) ?? null;
      const picked = pickMenuForChoice(menu, wantsLunch ? safeSelected : null);

      return {
        date,
        weekday: dayKey,

        isLocked: dateLocked || !company.canEditOrders || !agreementUsable,
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
        rid,
        scope: { company_id: sc.company_id, location_id: sc.location_id, user_id: sc.user_id },

        company,

        agreement: {
          status: agreementStatus,
          raw_status: agreementRawStatus,
          message: agreementMessage,
          start_date: startDateISO,
          delivery_days: deliveryDays,
        },

        range: { from: fromISO, to: toISO },

        serverNow: now.toISOString(),
        serverTimeLabel: `${formatTimeNO(now.toISOString())} (Oslo)`,

        week: {
          thisWeekStart: thisWeekStartISO,
          nextWeekStart: nextWeekStartISO,
          canSeeNextWeek: openNextWeek,
        },

        days,
      },
      200
    );
  } catch (e: any) {
    const detail = String(e?.stack || e?.message || e);
    opsLog("incident", { rid, status: 500, message: "Uventet feil.", error: "SERVER_ERROR", detail });
    // eslint-disable-next-line no-console
    console.error("[order/window] rid=", rid, "\n", detail);
    return jsonErr(rid, "Uventet feil.", 500, "SERVER_ERROR");
  }
}


