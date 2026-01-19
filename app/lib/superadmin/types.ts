// lib/superadmin/types.ts

export type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

export type FirmsSortKey = "created_at" | "name" | "status";
export type SortDir = "asc" | "desc";

/**
 * Query input for firm listing.
 * page is 1-based.
 */
export type FirmsQueryInput = {
  q?: string; // search
  status?: CompanyStatus | "ALL";
  page?: number; // 1-based
  pageSize?: number; // 25/50/100
  sortKey?: FirmsSortKey;
  sortDir?: SortDir;

  /**
   * Optional: used when we enrich rows with derived fields (e.g. binding months left).
   * Keep optional so existing callers don't break.
   */
  todayISO?: string; // YYYY-MM-DD (Europe/Oslo)
};

export type FirmRow = {
  id: string;
  name: string;
  status: CompanyStatus;
  created_at: string | null;

  // Standard "enterprise" fields we often have on companies
  plan?: "BASIS" | "LUXUS" | string | null;
  employees_count?: number | null;
  contract_start?: string | null; // YYYY-MM-DD
  contract_end?: string | null; // YYYY-MM-DD

  /**
   * Derived/enriched field (server computed)
   */
  bindingMonthsLeft?: number | null;

  // Extra optional fields – if they exist in DB
  employee_count?: number | null; // legacy alias (if some views expose it)
  orgnr?: string | null;
};

export type FirmsQueryResult = {
  rows: FirmRow[];
  page: number;
  pageSize: number;
  total: number; // total matching (for pagination)
  totalPages: number;

  q: string;
  status: CompanyStatus | "ALL";
  sortKey: FirmsSortKey;
  sortDir: SortDir;

  /**
   * Optional echo for UI (nice for toolbars)
   */
  todayISO?: string;
};

/* =========================
   Type guards / helpers (optional)
========================= */

export function isCompanyStatus(v: unknown): v is CompanyStatus {
  return v === "ACTIVE" || v === "PAUSED" || v === "CLOSED";
}

export function isSortKey(v: unknown): v is FirmsSortKey {
  return v === "created_at" || v === "name" || v === "status";
}

export function isSortDir(v: unknown): v is SortDir {
  return v === "asc" || v === "desc";
}
