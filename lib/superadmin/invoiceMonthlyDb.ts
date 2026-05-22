import "server-only";

/** Run period overlapping a calendar month. */
export type MonthBounds = {
  month: string;
  monthStart: string;
  monthEnd: string;
  nextMonthStart: string;
};

export type InvoiceRunPeriodRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
};

export type InvoiceLineMonthRow = {
  id: string;
  company_id: string;
  run_id: string;
  quantity: number | null;
  tier: string | null;
  unit_price_nok: number | null;
  amount_nok: number | null;
  service_date: string | null;
  description: string | null;
};

export type TripletexInvoiceRow = {
  id: string;
  run_id: string;
  company_id: string;
  external_invoice_id: string | null;
  status: string;
  last_error: string | null;
  updated_at: string;
};

export const INVOICE_RUN_PERIOD_SELECT = "id, period_start, period_end, status";
export const RECONCILE_LINE_SELECT =
  "id, company_id, run_id, quantity, tier, unit_price_nok, amount_nok, service_date, description";
export const EXPORT_LINE_SELECT = RECONCILE_LINE_SELECT;

export function parseMonth(raw: string): MonthBounds | null {
  const month = String(raw ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mm = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(mm)) return null;

  const monthStart = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  const nextMonthStart = new Date(Date.UTC(year, mm, 1)).toISOString().slice(0, 10);

  return { month, monthStart, monthEnd, nextMonthStart };
}

export function normalizeTripletexExportStatus(value: unknown): "PENDING_EXPORT" | "EXPORTED" | "FAILED" {
  const s = String(value ?? "").toUpperCase();
  if (s === "EXPORTED" || s === "SUCCESS" || s === "SENT") return "EXPORTED";
  if (s === "FAILED" || s === "ERROR" || s === "FAILED_PERMANENT") return "FAILED";
  return "PENDING_EXPORT";
}

export function isRunPeriodLocked(runStatus: unknown, externalInvoiceId: string | null): boolean {
  if (externalInvoiceId) return true;
  const s = String(runStatus ?? "").toUpperCase();
  return s === "FINALIZED" || s === "CLOSED" || s === "EXPORTED";
}

export async function loadRunsOverlappingMonth(
  admin: { from: (t: string) => any },
  bounds: MonthBounds,
): Promise<InvoiceRunPeriodRow[]> {
  const { data, error } = await admin
    .from("invoice_runs")
    .select(INVOICE_RUN_PERIOD_SELECT)
    .lte("period_start", bounds.monthEnd)
    .gte("period_end", bounds.monthStart);

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as InvoiceRunPeriodRow[];
}

export async function loadLinesForRuns(
  admin: { from: (t: string) => any },
  runIds: string[],
  companyIds?: string[],
): Promise<InvoiceLineMonthRow[]> {
  if (!runIds.length) return [];

  const out: InvoiceLineMonthRow[] = [];
  const chunkSize = 200;

  for (let i = 0; i < runIds.length; i += chunkSize) {
    const chunk = runIds.slice(i, i + chunkSize);
    let q = admin.from("invoice_lines").select(EXPORT_LINE_SELECT).in("run_id", chunk);
    if (companyIds?.length) q = q.in("company_id", companyIds);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((Array.isArray(data) ? data : []) as InvoiceLineMonthRow[]));
  }

  return out;
}

export async function loadTripletexInvoicesForRuns(
  admin: { from: (t: string) => any },
  runIds: string[],
  companyIds?: string[],
): Promise<TripletexInvoiceRow[]> {
  if (!runIds.length) return [];

  const out: TripletexInvoiceRow[] = [];
  const chunkSize = 200;

  for (let i = 0; i < runIds.length; i += chunkSize) {
    const chunk = runIds.slice(i, i + chunkSize);
    let q = admin
      .from("tripletex_invoices")
      .select("id, run_id, company_id, external_invoice_id, status, last_error, updated_at")
      .in("run_id", chunk);
    if (companyIds?.length) q = q.in("company_id", companyIds);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((Array.isArray(data) ? data : []) as TripletexInvoiceRow[]));
  }

  return out;
}

export function aggregateLinesByCompany(
  lines: InvoiceLineMonthRow[],
  runsById: Map<string, InvoiceRunPeriodRow>,
  tripletexByKey: Map<string, TripletexInvoiceRow>,
): Map<
  string,
  {
    qty: number;
    locked: boolean;
    references: string[];
    statuses: string[];
  }
> {
  const out = new Map<
    string,
    { qty: number; locked: boolean; references: string[]; statuses: string[] }
  >();

  for (const line of lines) {
    const companyId = String(line.company_id ?? "");
    if (!companyId) continue;

    const bucket = out.get(companyId) ?? { qty: 0, locked: false, references: [], statuses: [] };
    bucket.qty += Math.max(0, Math.floor(Number(line.quantity ?? 0)));

    const run = runsById.get(String(line.run_id ?? ""));
    const tx = tripletexByKey.get(`${line.run_id}:${companyId}`);
    bucket.locked = bucket.locked || isRunPeriodLocked(run?.status, tx?.external_invoice_id ?? null);

    if (line.id) bucket.references.push(String(line.id));
    bucket.statuses.push(normalizeTripletexExportStatus(tx?.status));

    out.set(companyId, bucket);
  }

  return out;
}

export function tripletexKey(runId: string, companyId: string): string {
  return `${runId}:${companyId}`;
}
