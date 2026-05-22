import "server-only";

/** Actual `invoice_runs` columns used in selects. */
export const INVOICE_RUN_LIST_SELECT = "id, period_start, period_end, status, created_at";
export const INVOICE_RUN_DETAIL_SELECT = INVOICE_RUN_LIST_SELECT;

/** Actual `invoice_lines` columns + company name join. */
export const INVOICE_LINE_RUN_SELECT =
  "id, company_id, quantity, tier, unit_price_nok, amount_nok, unit_price_cents_ex_vat, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat, basis, description, companies(name)";

export const INVOICE_LINE_EXPORT_SELECT =
  "company_id, quantity, tier, unit_price_nok, amount_nok, unit_price_cents_ex_vat, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat, basis, description, companies(name)";

export type InvoiceRunDbRow = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
};

/** Legacy API/UI DTO — maps DB period_start/end to period_from/to. */
export type InvoiceRunDto = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  created_at: string;
  note?: string | null;
};

export type InvoiceLineDbRow = {
  id?: string;
  company_id: string;
  quantity: number | null;
  tier: string | null;
  unit_price_nok: number | null;
  amount_nok: number | null;
  unit_price_cents_ex_vat: number | null;
  line_subtotal_cents_ex_vat: number | null;
  line_vat_cents: number | null;
  line_total_cents_inc_vat: number | null;
  basis: Record<string, unknown> | null;
  description: string | null;
  companies?: { name: string | null } | { name: string | null }[] | null;
};

/** Legacy API/UI row shape for run detail + Tripletex export source. */
export type InvoiceLineDetailDto = {
  id: string;
  company_id: string;
  company_name: string | null;
  plan_tier: string | null;
  price_ex_vat: number | null;
  billable_qty: number;
  cancelled_qty: number;
  cancelled_before_0800_qty: number;
  amount_ex_vat: number | null;
  flags: string | null;
};

export type BillingTaxRate = {
  id: string;
  rate: number;
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function companyNameFromJoin(row: InvoiceLineDbRow): string | null {
  const c = row.companies;
  if (!c) return null;
  if (Array.isArray(c)) return c[0]?.name ?? null;
  return c.name ?? null;
}

function basisQty(row: InvoiceLineDbRow, key: string): number {
  const basis = row.basis;
  if (!basis || typeof basis !== "object") return 0;
  return Math.max(0, Math.floor(safeNum(basis[key])));
}

export function mapInvoiceRunRow(row: InvoiceRunDbRow): InvoiceRunDto {
  return {
    id: row.id,
    period_from: String(row.period_start ?? ""),
    period_to: String(row.period_end ?? ""),
    status: String(row.status ?? ""),
    created_at: String(row.created_at ?? ""),
    note: null,
  };
}

/**
 * Ex-VAT line amount (NOK, whole units unless cents path used).
 * Prefers cent columns; `amount_nok` is qty × unit_price_nok (ex VAT per DB constraint).
 */
export function lineAmountExVat(row: InvoiceLineDbRow, vatRateById?: Map<string, number>, vatCode?: string | null): number | null {
  const subtotalCents = row.line_subtotal_cents_ex_vat;
  if (subtotalCents != null && Number.isFinite(Number(subtotalCents))) {
    return Math.round(Number(subtotalCents) / 100);
  }

  const amountNok = row.amount_nok;
  if (amountNok != null && Number.isFinite(Number(amountNok))) {
    return Math.round(Number(amountNok));
  }

  const unitCents = row.unit_price_cents_ex_vat;
  const qty = Math.max(0, Math.floor(safeNum(row.quantity)));
  if (unitCents != null && qty > 0 && Number.isFinite(Number(unitCents))) {
    return Math.round((Number(unitCents) * qty) / 100);
  }

  const totalIncCents = row.line_total_cents_inc_vat;
  if (totalIncCents != null && vatRateById && vatCode) {
    const rate = vatRateById.get(vatCode);
    if (rate != null && rate >= 0) {
      const inc = Number(totalIncCents) / 100;
      return Math.round(inc / (1 + rate));
    }
  }

  return null;
}

export function lineUnitPriceExVat(row: InvoiceLineDbRow): number | null {
  const unitCents = row.unit_price_cents_ex_vat;
  if (unitCents != null && Number.isFinite(Number(unitCents))) {
    return Math.round(Number(unitCents) / 100);
  }
  const unitNok = row.unit_price_nok;
  if (unitNok != null && Number.isFinite(Number(unitNok))) {
    return Math.round(Number(unitNok));
  }
  return null;
}

export function mapInvoiceLineRow(
  row: InvoiceLineDbRow,
  opts?: { vatRateById?: Map<string, number>; vatCode?: string | null },
): InvoiceLineDetailDto {
  const id = String(row.id ?? "");
  return {
    id,
    company_id: String(row.company_id ?? ""),
    company_name: companyNameFromJoin(row),
    plan_tier: row.tier ?? null,
    price_ex_vat: lineUnitPriceExVat(row),
    billable_qty: Math.max(0, Math.floor(safeNum(row.quantity))),
    cancelled_qty: basisQty(row, "cancelled_qty"),
    cancelled_before_0800_qty: basisQty(row, "cancelled_before_0800_qty"),
    amount_ex_vat: lineAmountExVat(row, opts?.vatRateById, opts?.vatCode ?? null),
    flags: null,
  };
}

export function buildVatRateMap(taxCodes: BillingTaxRate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of taxCodes) {
    if (t.id) map.set(t.id, safeNum(t.rate));
  }
  return map;
}

export async function loadBillingTaxRates(db: { from: (t: string) => any }): Promise<Map<string, number>> {
  const { data, error } = await db.from("billing_tax_codes").select("id, rate");
  if (error) return new Map();
  return buildVatRateMap(Array.isArray(data) ? (data as BillingTaxRate[]) : []);
}
