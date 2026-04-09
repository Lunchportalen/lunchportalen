import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type CanonicalMonthlyRow = {
  company_id: string;
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at?: string | null;
};

type LegacyMonthlyRow = {
  company_id: string;
  month: string;
  delivered_meals: number;
  canceled_meals: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at?: string | null;
};

type NormalizedMonthlyRow = {
  company_id: string;
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at: string | null;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function serializeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message || error.name || "Error";
  if (typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const errorRecord = error as { code?: unknown; message: string };
    const code = typeof errorRecord.code === "string" ? errorRecord.code : null;
    return [code ? `[${code}]` : null, errorRecord.message].filter(Boolean).join(" ");
  }
  return String(error);
}

function normalizeMonthValue(value: unknown): string {
  const raw = safeStr(value);
  if (!raw) return "";
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return raw;
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  return raw;
}

function monthQueryCandidates(month: string): string[] {
  const normalized = normalizeMonthValue(month);
  if (!normalized) return [];
  const candidates = [normalized];
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    candidates.push(`${normalized}-01`);
  }
  return Array.from(new Set(candidates));
}

function isMissingCanonicalCountColumns(error: unknown): boolean {
  const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "";
  const message = serializeError(error)?.toLowerCase() ?? "";
  if (code !== "42703" && !message.includes("does not exist")) return false;
  return (
    message.includes("delivered_count") ||
    message.includes("cancelled_count") ||
    message.includes("canceled_count")
  );
}

function applyMonthFilter<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  normalizedMonth: string,
): T {
  const candidates = monthQueryCandidates(normalizedMonth);
  return query.in("month", candidates.length > 0 ? candidates : [normalizedMonth]);
}

function mapCanonicalRow(row: Record<string, unknown>): NormalizedMonthlyRow {
  return {
    company_id: safeStr(row.company_id),
    month: normalizeMonthValue(row.month),
    delivered_count: Math.max(0, Math.floor(safeNum(row.delivered_count))),
    cancelled_count: Math.max(0, Math.floor(safeNum(row.cancelled_count))),
    delivery_rate: safeNum(row.delivery_rate),
    waste_estimate_kg: safeNum(row.waste_estimate_kg),
    co2_estimate_kg: safeNum(row.co2_estimate_kg),
    generated_at: safeStr(row.generated_at) || null,
  };
}

function mapLegacyRow(row: Record<string, unknown>): NormalizedMonthlyRow {
  return {
    company_id: safeStr(row.company_id),
    month: normalizeMonthValue(row.month),
    delivered_count: Math.max(0, Math.floor(safeNum(row.delivered_meals))),
    cancelled_count: Math.max(0, Math.floor(safeNum(row.canceled_meals))),
    delivery_rate: safeNum(row.delivery_rate),
    waste_estimate_kg: safeNum(row.waste_estimate_kg),
    co2_estimate_kg: safeNum(row.co2_estimate_kg),
    generated_at: safeStr(row.generated_at) || null,
  };
}

async function resolveMonth(admin: SupabaseClient, monthInput: string): Promise<string> {
  const normalizedInput = normalizeMonthValue(monthInput);
  if (normalizedInput) return normalizedInput;

  const { data, error } = await admin
    .from("esg_monthly")
    .select("month")
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeMonthValue((data as { month?: unknown } | null)?.month);
}

export type LatestMonthlyRollupItem = {
  company: { id: string; name: string };
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
};

export type LatestMonthlyRollupCompanyRecord = {
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at: string | null;
};

export type LatestMonthlyRollupBaseline = {
  status: "ready" | "legacy_column_fallback" | "query_failed";
  columnSet: "count" | "legacy_meals";
  degraded: boolean;
  operatorMessage: string | null;
  operatorAction: string | null;
  detail: string | null;
};

function readyBaseline(): LatestMonthlyRollupBaseline {
  return {
    status: "ready",
    columnSet: "count",
    degraded: false,
    operatorMessage: null,
    operatorAction: null,
    detail: null,
  };
}

function legacyFallbackBaseline(detail: string | null): LatestMonthlyRollupBaseline {
  return {
    status: "legacy_column_fallback",
    columnSet: "legacy_meals",
    degraded: true,
    operatorMessage:
      "ESG latest-monthly bruker legacy kolonnenavn i dette miljøet. API-et mappar dem tilbake til kanonisk count-form i stedet for å returnere feil eller tomme tall.",
    operatorAction:
      "Normaliser esg_monthly til delivered_count/cancelled_count når migrasjonene kan kjøres trygt, og behold denne fallbacken som lesebro til da.",
    detail,
  };
}

function queryFailedBaseline(detail: string | null): LatestMonthlyRollupBaseline {
  return {
    status: "query_failed",
    columnSet: "count",
    degraded: true,
    operatorMessage:
      "ESG latest-monthly kunne ikke bekrefte aggregatet i dette miljøet. Responsen degraderes ærlig i stedet for å returnere misvisende tall.",
    operatorAction:
      "Verifiser tilgang til esg_monthly og companies, og korriger schema/runtime-feilen før denne flaten markeres som frisk igjen.",
    detail,
  };
}

async function loadNormalizedMonthlyRows(
  admin: SupabaseClient,
  normalizedMonth: string,
  companyId?: string,
): Promise<{ rows: NormalizedMonthlyRow[]; baseline: LatestMonthlyRollupBaseline }> {
  let canonicalQuery = admin
    .from("esg_monthly")
    .select("company_id,month,delivered_count,cancelled_count,delivery_rate,waste_estimate_kg,co2_estimate_kg,generated_at");
  if (companyId) canonicalQuery = canonicalQuery.eq("company_id", companyId);
  const canonicalResult = await applyMonthFilter(canonicalQuery, normalizedMonth);

  if (!canonicalResult.error) {
    return {
      rows: (Array.isArray(canonicalResult.data) ? canonicalResult.data : []).map((row) =>
        mapCanonicalRow(row as unknown as Record<string, unknown>),
      ),
      baseline: readyBaseline(),
    };
  }

  if (!isMissingCanonicalCountColumns(canonicalResult.error)) {
    throw canonicalResult.error;
  }

  let legacyQuery = admin
    .from("esg_monthly")
    .select("company_id,month,delivered_meals,canceled_meals,delivery_rate,waste_estimate_kg,co2_estimate_kg,generated_at");
  if (companyId) legacyQuery = legacyQuery.eq("company_id", companyId);
  const legacyResult = await applyMonthFilter(legacyQuery, normalizedMonth);

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return {
    rows: (Array.isArray(legacyResult.data) ? legacyResult.data : []).map((row) =>
        mapLegacyRow(row as unknown as Record<string, unknown>),
      ),
    baseline: legacyFallbackBaseline(serializeError(canonicalResult.error)),
  };
}

/**
 * Leser `esg_monthly` (aggregat/rullering) og kobler firmanavn.
 * Brukes av superadmin og backoffice — samme kilde, ingen ny sannhet.
 */
export async function loadLatestMonthlyRollupList(
  admin: SupabaseClient,
  monthInput: string,
): Promise<{ month: string | null; items: LatestMonthlyRollupItem[]; baseline: LatestMonthlyRollupBaseline }> {
  let resolvedMonth: string | null = null;
  try {
    resolvedMonth = await resolveMonth(admin, monthInput);
    if (!resolvedMonth) {
      return { month: null, items: [], baseline: readyBaseline() };
    }

    const { rows, baseline } = await loadNormalizedMonthlyRows(admin, resolvedMonth);
    const companyIds = Array.from(new Set(rows.map((row) => safeStr(row.company_id)).filter(Boolean)));

    const companyNames = new Map<string, string>();
    for (const part of chunk(companyIds, 200)) {
      const { data: companies, error: companyError } = await admin.from("companies").select("id,name").in("id", part);

      if (companyError) throw companyError;

      for (const company of Array.isArray(companies) ? companies : []) {
        const id = safeStr((company as { id?: string }).id);
        if (!id) continue;
        companyNames.set(id, safeStr((company as { name?: string }).name) || "Ukjent firma");
      }
    }

    const items: LatestMonthlyRollupItem[] = rows.map((row) => {
      const companyId = safeStr(row.company_id);
      return {
        company: {
          id: companyId,
          name: companyNames.get(companyId) ?? "Ukjent firma",
        },
        month: row.month,
        delivered_count: row.delivered_count,
        cancelled_count: row.cancelled_count,
        delivery_rate: row.delivery_rate,
        waste_estimate_kg: row.waste_estimate_kg,
        co2_estimate_kg: row.co2_estimate_kg,
      };
    });

    return { month: resolvedMonth, items, baseline };
  } catch (error) {
    return {
      month: resolvedMonth ?? (normalizeMonthValue(monthInput) || null),
      items: [],
      baseline: queryFailedBaseline(serializeError(error)),
    };
  }
}

export async function loadLatestMonthlyRollupForCompany(
  admin: SupabaseClient,
  companyId: string,
  monthInput: string,
): Promise<{
  companyId: string;
  month: string | null;
  record: LatestMonthlyRollupCompanyRecord | null;
  baseline: LatestMonthlyRollupBaseline;
}> {
  let resolvedMonth: string | null = null;
  try {
    resolvedMonth = await resolveMonth(admin, monthInput);
    if (!resolvedMonth) {
      return {
        companyId,
        month: null,
        record: null,
        baseline: readyBaseline(),
      };
    }

    const { rows, baseline } = await loadNormalizedMonthlyRows(admin, resolvedMonth, companyId);
    const row = rows[0] ?? null;
    return {
      companyId,
      month: resolvedMonth,
      record: row
        ? {
            month: row.month,
            delivered_count: row.delivered_count,
            cancelled_count: row.cancelled_count,
            delivery_rate: row.delivery_rate,
            waste_estimate_kg: row.waste_estimate_kg,
            co2_estimate_kg: row.co2_estimate_kg,
            generated_at: row.generated_at,
          }
        : null,
      baseline,
    };
  } catch (error) {
    return {
      companyId,
      month: resolvedMonth ?? (normalizeMonthValue(monthInput) || null),
      record: null,
      baseline: queryFailedBaseline(serializeError(error)),
    };
  }
}

