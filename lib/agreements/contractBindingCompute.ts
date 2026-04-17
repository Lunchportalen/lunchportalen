/**
 * Deterministisk bindingsslutt og gjenstående binding (kalendermåneder) for avtalegrunnlag.
 * Brukes server-side; ingen I/O.
 */
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function parseLocalNoon(iso: string | null): Date | null {
  if (!iso || !isIsoDate(iso)) return null;
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function addCalendarMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toIsoDate(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Slutt på bindingsperiode: eksplisitt end_date, ellers start + binding_months. */
export function effectiveBindingEndIso(
  start_date: string | null,
  end_date: string | null,
  binding_months: number | null
): string | null {
  const endStored = safeStr(end_date) || null;
  if (endStored && isIsoDate(endStored)) return endStored;

  const start = parseLocalNoon(safeStr(start_date) || null);
  const bm = Number(binding_months ?? 0);
  if (!start || !Number.isFinite(bm) || bm <= 0) return null;

  return toIsoDate(addCalendarMonths(start, bm));
}

/** Hele kalendermåneder fra ref (YYYY-MM-DD) til end (ikke inkl. måned etter siste dag). */
export function wholeMonthsBetweenInclusive(fromIso: string, toIso: string): number {
  const a = parseLocalNoon(fromIso);
  const b = parseLocalNoon(toIso);
  if (!a || !b) return 0;
  if (b.getTime() <= a.getTime()) return 0;

  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

export type LedgerAgreementLike = {
  id?: unknown;
  status?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  binding_months?: unknown;
  notice_months?: unknown;
};

export type ContractOverview = {
  agreement_id: string;
  status: string;
  plan_tier: string | null;
  start_date: string | null;
  end_date: string | null;
  binding_months: number | null;
  notice_months: number | null;
  effective_binding_end_date: string | null;
  binding_months_remaining: number | null;
  reference_date: string;
};

export function buildContractOverviewFromLedger(
  row: LedgerAgreementLike | null | undefined,
  referenceDateIso: string | null | undefined
): ContractOverview | null {
  if (!row || typeof row !== "object") return null;

  const id = safeStr(row.id);
  if (!id) return null;

  const status = safeStr(row.status).toUpperCase() || "UNKNOWN";
  const planRaw = safeStr((row as { plan_tier?: unknown }).plan_tier).toUpperCase();
  const plan_tier = planRaw === "BASIS" || planRaw === "LUXUS" ? planRaw : null;
  const start_date = safeStr(row.start_date) || null;
  const end_date = safeStr(row.end_date) || null;
  const bmRaw = Number(row.binding_months);
  const binding_months = Number.isFinite(bmRaw) && bmRaw > 0 ? Math.floor(bmRaw) : null;
  const nmRaw = Number(row.notice_months);
  const notice_months = Number.isFinite(nmRaw) && nmRaw >= 0 ? Math.floor(nmRaw) : null;

  const rawRef = String(referenceDateIso ?? "").trim();
  const ref = isIsoDate(rawRef) ? rawRef : osloTodayISODate();

  const effective = effectiveBindingEndIso(start_date, end_date, binding_months);

  if (status === "TERMINATED") {
    return {
      agreement_id: id,
      status,
      plan_tier,
      start_date: start_date && isIsoDate(start_date) ? start_date : null,
      end_date: end_date && isIsoDate(end_date) ? end_date : null,
      binding_months,
      notice_months,
      effective_binding_end_date: effective,
      binding_months_remaining: 0,
      reference_date: ref,
    };
  }

  if (!effective) {
    return {
      agreement_id: id,
      status,
      plan_tier,
      start_date: start_date && isIsoDate(start_date) ? start_date : null,
      end_date: end_date && isIsoDate(end_date) ? end_date : null,
      binding_months,
      notice_months,
      effective_binding_end_date: null,
      binding_months_remaining: null,
      reference_date: ref,
    };
  }

  const remaining = wholeMonthsBetweenInclusive(ref, effective);

  return {
    agreement_id: id,
    status,
    plan_tier,
    start_date: start_date && isIsoDate(start_date) ? start_date : null,
    end_date: end_date && isIsoDate(end_date) ? end_date : null,
    binding_months,
    notice_months,
    effective_binding_end_date: effective,
    binding_months_remaining: remaining,
    reference_date: ref,
  };
}

function rankAgreementLedgerStatus(v: unknown): number {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return 3;
  if (s === "PENDING") return 2;
  if (s === "TERMINATED") return 1;
  return 0;
}

/**
 * Velg «beste» operative avtalerad (ACTIVE > PENDING > TERMINATED, deretter nyeste updated_at).
 * Gjelder både `agreements` og `company_agreements` der samme ranking brukes.
 */
export function pickBestAgreementLedgerRow(rows: unknown): any | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let best: any = null;
  let bestRank = -1;
  let bestTs = 0;

  for (const row of rows) {
    const r = rankAgreementLedgerStatus((row as any)?.status);
    const ts = (row as any)?.updated_at ? Date.parse(String((row as any).updated_at)) : 0;
    if (r > bestRank || (r === bestRank && ts >= bestTs)) {
      best = row;
      bestRank = r;
      bestTs = ts;
    }
  }

  return best;
}
