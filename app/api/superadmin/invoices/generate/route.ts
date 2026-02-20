export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SkipReason =
  | "NO_ACTIVE_AGREEMENT"
  | "PRICE_MISSING"
  | "ZERO_QUANTITY"
  | "PRODUCT_MAPPING_MISSING"
  | "TAX_CODE_MISSING"
  | "LOCKED_PERIOD";

type QuantitySource = "daily_company_rollup" | "orders";
type AgreementTier = "BASIS" | "LUXUS";
type PriceColumn = "unit_price" | "price_per_employee" | "price_nok";

type ParsedMonth = {
  month: string;
  monthStart: string;
  nextMonthStart: string;
};

type ActiveAgreement = {
  agreementId: string;
  tier: AgreementTier | null;
  updatedAtMs: number;
  priceRaw: number;
};

type BillingProduct = {
  tier: AgreementTier;
  productName: string;
  taxCodeId: string;
  unit: string;
  revenueAccount: string | null;
};

type BillingTaxCode = {
  id: string;
  tripletexVatCode: string;
};

type InvoiceLineUpsert = {
  reference: string;
  company_id: string;
  month: string;
  agreement_id: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  currency: "NOK";
  status: "PENDING";
  tax_code_id: string;
  tripletex_vat_code: string;
  product_tier: AgreementTier;
  product_name: string;
  revenue_account: string | null;
  unit: string;
  locked: false;
  exported_at: null;
  export_status: "PENDING_EXPORT";
  export_last_error: null;
  updated_at: string;
};

type ExistingInvoiceLine = {
  reference: string;
  locked: boolean | null;
  export_status: string | null;
};

type UpsertedInvoiceLine = {
  id: string;
  reference: string;
  company_id: string;
  month: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
  locked: boolean | null;
  export_status: string | null;
};

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 200;

const PRICE_PER_TIER: Record<AgreementTier, number> = {
  BASIS: 90,
  LUXUS: 130,
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTier(v: unknown): AgreementTier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function normalizeStatus(v: unknown): string {
  return safeStr(v).toUpperCase();
}

function parseMonth(raw: string): ParsedMonth | null {
  const month = safeStr(raw);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;

  const parts = month.split("-");
  const year = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(mm)) return null;

  const monthStart = `${month}-01`;
  const nextMonthStart = new Date(Date.UTC(year, mm, 1)).toISOString().slice(0, 10);

  return { month, monthStart, nextMonthStart };
}

function isMissingRelationOrColumn(err: any): boolean {
  const code = safeStr(err?.code).toLowerCase();
  const msg = safeStr(err?.message || err?.details || err?.hint).toLowerCase();

  return (
    code === "42p01" ||
    code === "42703" ||
    code === "pgrst205" ||
    msg.includes("relation") ||
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("schema cache")
  );
}

function chunksOf<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function listActiveCompanyIds(admin: any): Promise<string[]> {
  const { data, error } = await admin.from("companies").select("id").eq("status", "ACTIVE");
  if (error) throw error;

  const ids = (Array.isArray(data) ? data : [])
    .map((r: any) => safeStr(r?.id))
    .filter(Boolean);

  return Array.from(new Set(ids));
}

async function fetchAgreementRows(admin: any, companyChunk: string[], selectCols: string): Promise<any[]> {
  const out: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("agreements")
      .select(selectCols)
      .in("company_id", companyChunk)
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    out.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return out;
}

async function loadActiveAgreements(
  admin: any,
  companyIds: string[]
): Promise<{ byCompany: Map<string, ActiveAgreement>; priceColumn: PriceColumn | null }> {
  const candidates: PriceColumn[] = ["unit_price", "price_per_employee", "price_nok"];

  for (const col of candidates) {
    try {
      const byCompany = new Map<string, ActiveAgreement>();

      for (const chunk of chunksOf(companyIds, CHUNK_SIZE)) {
        const rows = await fetchAgreementRows(admin, chunk, `id,company_id,tier,updated_at,${col}`);
        for (const row of rows) {
          const companyId = safeStr((row as any)?.company_id);
          const agreementId = safeStr((row as any)?.id);
          if (!companyId || !agreementId) continue;

          const tsRaw = safeStr((row as any)?.updated_at);
          const ts = Number.isFinite(Date.parse(tsRaw)) ? Date.parse(tsRaw) : 0;
          const prev = byCompany.get(companyId);

          if (!prev || ts >= prev.updatedAtMs) {
            byCompany.set(companyId, {
              agreementId,
              tier: normalizeTier((row as any)?.tier),
              updatedAtMs: ts,
              priceRaw: safeNum((row as any)?.[col]),
            });
          }
        }
      }

      return { byCompany, priceColumn: col };
    } catch (err: any) {
      if (!isMissingRelationOrColumn(err)) throw err;
    }
  }

  const fallback = new Map<string, ActiveAgreement>();

  for (const chunk of chunksOf(companyIds, CHUNK_SIZE)) {
    const rows = await fetchAgreementRows(admin, chunk, "id,company_id,tier,updated_at");
    for (const row of rows) {
      const companyId = safeStr((row as any)?.company_id);
      const agreementId = safeStr((row as any)?.id);
      if (!companyId || !agreementId) continue;

      const tsRaw = safeStr((row as any)?.updated_at);
      const ts = Number.isFinite(Date.parse(tsRaw)) ? Date.parse(tsRaw) : 0;
      const prev = fallback.get(companyId);

      if (!prev || ts >= prev.updatedAtMs) {
        fallback.set(companyId, {
          agreementId,
          tier: normalizeTier((row as any)?.tier),
          updatedAtMs: ts,
          priceRaw: 0,
        });
      }
    }
  }

  return { byCompany: fallback, priceColumn: null };
}

async function loadQuantitiesFromRollup(admin: any, companyIds: string[], monthStart: string, nextMonthStart: string) {
  const qty = new Map<string, number>();

  for (const chunk of chunksOf(companyIds, CHUNK_SIZE)) {
    let offset = 0;

    while (true) {
      const { data, error } = await admin
        .from("daily_company_rollup")
        .select("company_id,ordered_count")
        .in("company_id", chunk)
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const companyId = safeStr((row as any)?.company_id);
        if (!companyId) continue;

        const next = (qty.get(companyId) ?? 0) + Math.max(0, Math.floor(safeNum((row as any)?.ordered_count)));
        qty.set(companyId, next);
      }

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return qty;
}

async function loadQuantitiesFromOrders(admin: any, companyIds: string[], monthStart: string, nextMonthStart: string) {
  const qty = new Map<string, number>();

  for (const chunk of chunksOf(companyIds, CHUNK_SIZE)) {
    let offset = 0;

    while (true) {
      const { data, error } = await admin
        .from("orders")
        .select("company_id,status")
        .in("company_id", chunk)
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const companyId = safeStr((row as any)?.company_id);
        if (!companyId) continue;

        const status = normalizeStatus((row as any)?.status);
        if (status !== "ORDERED" && status !== "ACTIVE") continue;

        qty.set(companyId, (qty.get(companyId) ?? 0) + 1);
      }

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return qty;
}

async function loadQuantities(
  admin: any,
  companyIds: string[],
  monthStart: string,
  nextMonthStart: string
): Promise<{ quantities: Map<string, number>; source: QuantitySource }> {
  try {
    const quantities = await loadQuantitiesFromRollup(admin, companyIds, monthStart, nextMonthStart);
    return { quantities, source: "daily_company_rollup" };
  } catch (err: any) {
    if (!isMissingRelationOrColumn(err)) throw err;
  }

  const quantities = await loadQuantitiesFromOrders(admin, companyIds, monthStart, nextMonthStart);
  return { quantities, source: "orders" };
}

async function loadBillingProducts(admin: any): Promise<Map<AgreementTier, BillingProduct>> {
  const { data, error } = await admin
    .from("billing_products")
    .select("tier,product_name,tax_code_id,unit,revenue_account");
  if (error) throw error;

  const map = new Map<AgreementTier, BillingProduct>();
  for (const row of Array.isArray(data) ? data : []) {
    const tier = normalizeTier((row as any)?.tier);
    if (!tier) continue;

    map.set(tier, {
      tier,
      productName: safeStr((row as any)?.product_name),
      taxCodeId: safeStr((row as any)?.tax_code_id),
      unit: safeStr((row as any)?.unit) || "stk",
      revenueAccount: safeStr((row as any)?.revenue_account) || null,
    });
  }

  return map;
}

async function loadBillingTaxCodes(admin: any): Promise<Map<string, BillingTaxCode>> {
  const { data, error } = await admin.from("billing_tax_codes").select("id,tripletex_vat_code");
  if (error) throw error;

  const map = new Map<string, BillingTaxCode>();
  for (const row of Array.isArray(data) ? data : []) {
    const id = safeStr((row as any)?.id);
    if (!id) continue;

    map.set(id, {
      id,
      tripletexVatCode: safeStr((row as any)?.tripletex_vat_code),
    });
  }

  return map;
}

async function loadExistingInvoiceLines(admin: any, references: string[]): Promise<Map<string, ExistingInvoiceLine>> {
  const out = new Map<string, ExistingInvoiceLine>();

  for (const chunk of chunksOf(references, CHUNK_SIZE)) {
    const { data, error } = await admin
      .from("invoice_lines")
      .select("reference,locked,export_status")
      .in("reference", chunk);

    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const reference = safeStr((row as any)?.reference);
      if (!reference) continue;
      out.set(reference, {
        reference,
        locked: Boolean((row as any)?.locked),
        export_status: safeStr((row as any)?.export_status) || null,
      });
    }
  }

  return out;
}

async function upsertInvoiceLines(admin: any, rows: InvoiceLineUpsert[]): Promise<UpsertedInvoiceLine[]> {
  const out: UpsertedInvoiceLine[] = [];

  for (const chunk of chunksOf(rows, CHUNK_SIZE)) {
    const { data, error } = await admin
      .from("invoice_lines")
      .upsert(chunk, { onConflict: "reference" })
      .select("id,reference,company_id,month,quantity,unit_price,amount,locked,export_status");

    if (error) throw error;
    out.push(...((Array.isArray(data) ? data : []) as UpsertedInvoiceLine[]));
  }

  return out;
}

async function upsertOutboxInvoiceReady(admin: any, month: string, lines: UpsertedInvoiceLine[]) {
  const rows = lines.map((line) => ({
    event_key: `invoice.ready:${safeStr(line.reference)}`,
    payload: {
      event: "invoice.ready",
      reference: safeStr(line.reference),
      companyId: safeStr(line.company_id),
      month,
      amount: safeNum(line.amount),
      quantity: Math.max(0, Math.floor(safeNum(line.quantity))),
      unit_price: safeNum(line.unit_price),
      invoiceLineId: safeStr(line.id),
    },
    status: "PENDING",
    attempts: 0,
    last_error: null,
    locked_at: null,
    locked_by: null,
  }));

  for (const chunk of chunksOf(rows, CHUNK_SIZE)) {
    const { error } = await admin.from("outbox").upsert(chunk, { onConflict: "event_key" });
    if (error) throw error;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return s?.response ?? s?.res;

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.invoices.generate.POST", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const parsed = parseMonth(safeStr(url.searchParams.get("month")));
  if (!parsed) return jsonErr(ctx.rid, "month ma vaere pa formatet YYYY-MM.", 400, "BAD_REQUEST");

  const skippedReasons: Record<SkipReason, number> = {
    NO_ACTIVE_AGREEMENT: 0,
    PRICE_MISSING: 0,
    ZERO_QUANTITY: 0,
    PRODUCT_MAPPING_MISSING: 0,
    TAX_CODE_MISSING: 0,
    LOCKED_PERIOD: 0,
  };
  const skippedCompanies: string[] = [];

  const admin = supabaseAdmin();
  let quantitySource: QuantitySource = "orders";

  try {
    const companyIds = await listActiveCompanyIds(admin);

    if (companyIds.length === 0) {
      return jsonOk(ctx.rid, {
        month: parsed.month,
        created: 0,
        updated: 0,
        exportQueued: 0,
        skipped: 0,
        skippedReasons,
        samples: { created: [], skipped: [] },
        meta: { quantitySource },
      });
    }

    const agreements = await loadActiveAgreements(admin, companyIds);
    const qtyRes = await loadQuantities(admin, companyIds, parsed.monthStart, parsed.nextMonthStart);
    quantitySource = qtyRes.source;

    const billingProducts = await loadBillingProducts(admin);
    const taxCodes = await loadBillingTaxCodes(admin);

    const lines: InvoiceLineUpsert[] = [];
    const nowIso = new Date().toISOString();

    for (const companyId of companyIds) {
      const agreement = agreements.byCompany.get(companyId);
      if (!agreement?.agreementId) {
        skippedReasons.NO_ACTIVE_AGREEMENT += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      const tier = agreement.tier;
      if (!tier) {
        skippedReasons.PRODUCT_MAPPING_MISSING += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      const product = billingProducts.get(tier);
      if (!product || !product.productName || !product.taxCodeId) {
        skippedReasons.PRODUCT_MAPPING_MISSING += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      const taxCode = taxCodes.get(product.taxCodeId);
      const tripletexVatCode = safeStr(taxCode?.tripletexVatCode);
      if (!tripletexVatCode) {
        skippedReasons.TAX_CODE_MISSING += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      let unitPrice = 0;

      if (agreements.priceColumn) {
        unitPrice = safeNum(agreement.priceRaw);
      } else {
        unitPrice = PRICE_PER_TIER[tier] ?? 0;
      }

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        skippedReasons.PRICE_MISSING += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      const quantity = Math.max(0, Math.floor(qtyRes.quantities.get(companyId) ?? 0));
      if (quantity <= 0) {
        skippedReasons.ZERO_QUANTITY += 1;
        skippedCompanies.push(companyId);
        continue;
      }

      const reference = `INV:${companyId}:${parsed.month}`;
      const amount = Number((quantity * unitPrice).toFixed(4));

      lines.push({
        reference,
        company_id: companyId,
        month: parsed.monthStart,
        agreement_id: agreement.agreementId,
        quantity,
        unit_price: unitPrice,
        amount,
        currency: "NOK",
        status: "PENDING",
        tax_code_id: product.taxCodeId,
        tripletex_vat_code: tripletexVatCode,
        product_tier: tier,
        product_name: product.productName,
        revenue_account: product.revenueAccount,
        unit: product.unit,
        locked: false,
        exported_at: null,
        export_status: "PENDING_EXPORT",
        export_last_error: null,
        updated_at: nowIso,
      });
    }

    if (lines.length === 0) {
      return jsonOk(ctx.rid, {
        month: parsed.month,
        created: 0,
        updated: 0,
        exportQueued: 0,
        skipped: skippedCompanies.length,
        skippedReasons,
        samples: { created: [], skipped: skippedCompanies.slice(0, 10) },
        meta: { quantitySource, priceColumn: agreements.priceColumn },
      });
    }

    const existingByRef = await loadExistingInvoiceLines(
      admin,
      lines.map((line) => line.reference)
    );

    const upsertable: InvoiceLineUpsert[] = [];
    for (const line of lines) {
      const existing = existingByRef.get(line.reference);
      const isLocked = Boolean(existing?.locked);
      const isExported = normalizeStatus(existing?.export_status) === "EXPORTED";

      if (isLocked || isExported) {
        skippedReasons.LOCKED_PERIOD += 1;
        skippedCompanies.push(line.company_id);
        continue;
      }

      upsertable.push(line);
    }

    if (upsertable.length === 0) {
      return jsonOk(ctx.rid, {
        month: parsed.month,
        created: 0,
        updated: 0,
        exportQueued: 0,
        skipped: skippedCompanies.length,
        skippedReasons,
        samples: { created: [], skipped: skippedCompanies.slice(0, 10) },
        meta: { quantitySource, priceColumn: agreements.priceColumn },
      });
    }

    const upserted = await upsertInvoiceLines(admin, upsertable);

    const exportable = upserted.filter((row) => !Boolean(row.locked) && normalizeStatus(row.export_status) !== "EXPORTED");
    if (exportable.length > 0) {
      await upsertOutboxInvoiceReady(admin, parsed.month, exportable);
    }

    const createdRefs: string[] = [];
    let updated = 0;

    for (const row of upserted) {
      const ref = safeStr(row.reference);
      if (!ref) continue;
      if (existingByRef.has(ref)) updated += 1;
      else createdRefs.push(ref);
    }

    return jsonOk(ctx.rid, {
      month: parsed.month,
      created: createdRefs.length,
      updated,
      exportQueued: exportable.length,
      skipped: skippedCompanies.length,
      skippedReasons,
      samples: {
        created: createdRefs.slice(0, 10),
        skipped: skippedCompanies.slice(0, 10),
      },
      meta: {
        quantitySource,
        priceColumn: agreements.priceColumn,
      },
    });
  } catch (error: any) {
    return jsonErr(ctx.rid, "Kunne ikke generere fakturalinjer.", 500, {
      code: "INVOICE_GENERATE_FAILED",
      detail: {
        message: safeStr(error?.message ?? error),
      },
    });
  }
}
