export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  classifyTripletexError,
  createInvoice,
  ensureCustomer,
  ensureProduct,
  resolveTripletexAuth,
  TripletexClientError,
  type TripletexAuth,
} from "@/lib/integrations/tripletex/client";

type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "FAILED_PERMANENT";

type OutboxRow = {
  id: number;
  event_key: string;
  status: OutboxStatus;
  attempts: number | null;
  last_error: string | null;
  payload: any;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string | null;
};

type InvoicePeriodRow = {
  company_id: string;
  period: string;
  tier: "BASIS" | "LUXUS" | "MIXED" | null;
  count_basis: number;
  count_luxus: number;
  unit_price_basis: number;
  unit_price_luxus: number;
  total: number;
  unique_ref: string;
  status: string;
  tripletex_invoice_id: string | null;
  last_error: string | null;
};

type BillingProductConfig = {
  tier: "BASIS" | "LUXUS";
  productName: string;
  tripletexProductId: string | null;
  revenueAccount: string | null;
  unit: string | null;
  tripletexVatCode: string | null;
};

type HandleEventResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 10;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 5;
const DEFAULT_CONCURRENCY = 3;

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeStatus(value: unknown): string {
  return safeStr(value).toUpperCase();
}

function parseConcurrency(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONCURRENCY;
  const i = Math.floor(n);
  if (i < MIN_CONCURRENCY) return MIN_CONCURRENCY;
  if (i > MAX_CONCURRENCY) return MAX_CONCURRENCY;
  return i;
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(MIN_CONCURRENCY, Math.min(concurrency, items.length));
  let index = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      await handler(items[current]);
    }
  });

  await Promise.all(workers);
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

function parseReference(row: OutboxRow): string {
  const payloadUniqueRef = safeStr(row?.payload?.uniqueRef);
  if (payloadUniqueRef) return payloadUniqueRef;

  const payloadRef = safeStr(row?.payload?.reference);
  if (payloadRef) return payloadRef;

  const parts = safeStr(row?.event_key).split(":");
  if (parts.length >= 2) return parts.slice(1).join(":");
  return "";
}

function classifyError(error: unknown): { message: string; permanent: boolean } {
  if (error instanceof TripletexClientError) {
    return {
      message: error.message,
      permanent: error.kind === "CONFIG_MISSING" || error.kind === "AUTH" || error.kind === "PERMANENT",
    };
  }

  if (error instanceof Error) {
    const asTripletex = classifyTripletexError(error);
    return {
      message: asTripletex.message,
      permanent: asTripletex.kind === "CONFIG_MISSING" || asTripletex.kind === "AUTH" || asTripletex.kind === "PERMANENT",
    };
  }

  const message = safeStr(error) || "Unknown error";
  return { message, permanent: false };
}

async function markOutboxSent(admin: any, row: OutboxRow, workerId: string, lockedAt: string) {
  await admin
    .from("outbox")
    .update({
      status: "SENT",
      last_error: null,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", row.id)
    .eq("status", "PROCESSING")
    .eq("locked_by", workerId)
    .eq("locked_at", lockedAt);
}

async function markOutboxFailed(admin: any, row: OutboxRow, workerId: string, lockedAt: string, message: string, permanent: boolean) {
  const attempts = intOr(row.attempts, 0) + 1;
  const nextStatus: OutboxStatus = permanent || attempts >= MAX_ATTEMPTS ? "FAILED_PERMANENT" : "FAILED";

  await admin
    .from("outbox")
    .update({
      attempts,
      last_error: safeStr(message).slice(0, 2000) || "unknown_error",
      status: nextStatus,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", row.id)
    .eq("status", "PROCESSING")
    .eq("locked_by", workerId)
    .eq("locked_at", lockedAt);
}

async function fetchInvoicePeriod(admin: any, uniqueRef: string): Promise<InvoicePeriodRow | null> {
  const { data, error } = await admin
    .from("invoice_periods")
    .select(
      "company_id,period,tier,count_basis,count_luxus,unit_price_basis,unit_price_luxus,total,unique_ref,status,tripletex_invoice_id,last_error"
    )
    .eq("unique_ref", uniqueRef)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as InvoicePeriodRow | null;
}

async function markInvoicePeriodFailed(admin: any, uniqueRef: string, reason: string): Promise<void> {
  await admin
    .from("invoice_periods")
    .update({
      status: "FAILED",
      last_error: safeStr(reason).slice(0, 2000) || "FAILED",
    })
    .eq("unique_ref", uniqueRef)
    .neq("status", "SENT");
}

async function markInvoicePeriodTransientError(admin: any, uniqueRef: string, reason: string): Promise<void> {
  await admin
    .from("invoice_periods")
    .update({
      last_error: safeStr(reason).slice(0, 2000) || "FAILED",
    })
    .eq("unique_ref", uniqueRef)
    .neq("status", "SENT");
}

async function markInvoicePeriodSent(admin: any, uniqueRef: string, tripletexInvoiceId: string): Promise<void> {
  await admin
    .from("invoice_periods")
    .update({
      status: "SENT",
      tripletex_invoice_id: safeStr(tripletexInvoiceId),
      last_error: null,
    })
    .eq("unique_ref", uniqueRef);
}

async function lookupTripletexExportLocal(
  admin: any,
  uniqueRef: string
): Promise<{ exists: boolean; invoiceId: string | null }> {
  const { data, error } = await admin
    .from("tripletex_exports")
    .select("unique_ref,tripletex_invoice_id")
    .eq("unique_ref", uniqueRef)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false, invoiceId: null };
  return {
    exists: true,
    invoiceId: safeStr((data as any)?.tripletex_invoice_id) || null,
  };
}

async function upsertTripletexExport(admin: any, uniqueRef: string, tripletexInvoiceId: string): Promise<void> {
  const { error } = await admin.from("tripletex_exports").upsert(
    {
      unique_ref: uniqueRef,
      tripletex_invoice_id: tripletexInvoiceId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "unique_ref", ignoreDuplicates: true }
  );

  if (error) throw error;
}

async function enqueueInvoiceSent(admin: any, uniqueRef: string, tripletexInvoiceId: string): Promise<void> {
  const { error } = await admin.from("outbox").upsert(
    {
      event_key: `invoice.sent:${uniqueRef}`,
      payload: {
        event: "invoice.sent",
        uniqueRef,
        tripletexInvoiceId,
        sentAt: new Date().toISOString(),
      },
      status: "PENDING",
      attempts: 0,
      last_error: null,
      locked_at: null,
      locked_by: null,
    },
    { onConflict: "event_key", ignoreDuplicates: true }
  );

  if (error) throw error;
}

async function fetchBillingProductConfig(admin: any, tier: "BASIS" | "LUXUS"): Promise<BillingProductConfig | null> {
  const { data: product, error: productError } = await admin
    .from("billing_products")
    .select("tier,product_name,tripletex_product_id,revenue_account,tax_code_id,unit")
    .eq("tier", tier)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) return null;

  const taxCodeId = safeStr((product as any).tax_code_id);
  let tripletexVatCode: string | null = null;

  if (taxCodeId) {
    const { data: taxCode, error: taxError } = await admin
      .from("billing_tax_codes")
      .select("id,tripletex_vat_code")
      .eq("id", taxCodeId)
      .maybeSingle();

    if (taxError) throw taxError;
    tripletexVatCode = safeStr((taxCode as any)?.tripletex_vat_code) || null;
  }

  return {
    tier,
    productName: safeStr((product as any).product_name) || tier,
    tripletexProductId: safeStr((product as any).tripletex_product_id) || null,
    revenueAccount: safeStr((product as any).revenue_account) || null,
    unit: safeStr((product as any).unit) || null,
    tripletexVatCode,
  };
}

async function ensureInvoiceTierLine(
  admin: any,
  getRunAuth: () => Promise<TripletexAuth>,
  period: InvoicePeriodRow,
  tier: "BASIS" | "LUXUS"
): Promise<{ productId: string; quantity: number; unitPrice: number; productName: string; vatCode: string; revenueAccount: string | null }> {
  const config = await fetchBillingProductConfig(admin, tier);
  if (!config) {
    throw new TripletexClientError({
      message: `PRODUCT_MAPPING_MISSING_${tier}`,
      kind: "PERMANENT",
      code: `PRODUCT_MAPPING_MISSING_${tier}`,
    });
  }

  const quantity = tier === "BASIS" ? Math.floor(safeNum(period.count_basis)) : Math.floor(safeNum(period.count_luxus));
  const unitPrice = tier === "BASIS" ? safeNum(period.unit_price_basis) : safeNum(period.unit_price_luxus);

  if (quantity <= 0 || unitPrice <= 0) {
    throw new TripletexClientError({
      message: `INVOICE_PERIOD_LINE_INVALID_${tier}`,
      kind: "PERMANENT",
      code: `INVOICE_PERIOD_LINE_INVALID_${tier}`,
    });
  }

  let productId = safeStr(config.tripletexProductId);
  if (!productId) {
    const product = await ensureProduct({
      admin,
      tier,
      request: { auth: await getRunAuth() },
    });
    productId = safeStr(product.productId);
  }

  const vatCode = safeStr(config.tripletexVatCode);
  if (!vatCode) {
    throw new TripletexClientError({
      message: `TRIPLETEX_VAT_CODE_MISSING_${tier}`,
      kind: "PERMANENT",
      code: `TRIPLETEX_VAT_CODE_MISSING_${tier}`,
    });
  }

  return {
    productId,
    quantity,
    unitPrice,
    productName: config.productName,
    vatCode,
    revenueAccount: config.revenueAccount,
  };
}

async function processInvoiceReady(
  admin: any,
  row: OutboxRow,
  getRunAuth: () => Promise<TripletexAuth>
): Promise<HandleEventResult> {
  const uniqueRef = parseReference(row);
  if (!uniqueRef) {
    return { ok: false, permanent: true, error: "UNIQUE_REF_MISSING" };
  }

  try {
    const period = await fetchInvoicePeriod(admin, uniqueRef);
    if (!period) {
      return { ok: false, permanent: true, error: "INVOICE_PERIOD_NOT_FOUND" };
    }

    const periodStatus = normalizeStatus(period.status);
    if (periodStatus === "SENT") {
      return { ok: true };
    }

    const periodInvoiceId = safeStr(period.tripletex_invoice_id);
    if (periodInvoiceId) {
      await markInvoicePeriodSent(admin, uniqueRef, periodInvoiceId);
      await enqueueInvoiceSent(admin, uniqueRef, periodInvoiceId);
      return { ok: true };
    }

    const localExport = await lookupTripletexExportLocal(admin, uniqueRef);
    if (localExport.exists) {
      const dedupeInvoiceId = localExport.invoiceId || periodInvoiceId;
      if (!dedupeInvoiceId) {
        await markInvoicePeriodFailed(admin, uniqueRef, "TRIPLETEX_EXPORT_INVOICE_ID_MISSING");
        return { ok: false, permanent: true, error: "TRIPLETEX_EXPORT_INVOICE_ID_MISSING" };
      }
      await markInvoicePeriodSent(admin, uniqueRef, dedupeInvoiceId);
      await enqueueInvoiceSent(admin, uniqueRef, dedupeInvoiceId);
      return { ok: true };
    }

    if (periodStatus !== "READY") {
      await markInvoicePeriodFailed(admin, uniqueRef, "INVOICE_PERIOD_NOT_READY");
      return { ok: false, permanent: true, error: "INVOICE_PERIOD_NOT_READY" };
    }

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select(
        "id,orgnr,name,legal_name,billing_email,billing_address,billing_postcode,billing_city,billing_country,ehf_enabled,ehf_endpoint"
      )
      .eq("id", period.company_id)
      .maybeSingle();

    if (companyError || !company) {
      await markInvoicePeriodFailed(admin, uniqueRef, "COMPANY_BILLING_PROFILE_MISSING");
      return { ok: false, permanent: true, error: "COMPANY_BILLING_PROFILE_MISSING" };
    }

    const orgnr = safeStr((company as any).orgnr);
    const legalName = safeStr((company as any).legal_name);
    const billingAddress = safeStr((company as any).billing_address);
    const billingPostcode = safeStr((company as any).billing_postcode);
    const billingCity = safeStr((company as any).billing_city);
    const billingCountry = safeStr((company as any).billing_country);

    if (!orgnr || !legalName || !billingAddress || !billingPostcode || !billingCity || !billingCountry) {
      await markInvoicePeriodFailed(admin, uniqueRef, "COMPANY_BILLING_FIELDS_MISSING");
      return { ok: false, permanent: true, error: "COMPANY_BILLING_FIELDS_MISSING" };
    }

    let tripletexCustomerId = "";
    const { data: customerMapping, error: customerMappingError } = await admin
      .from("tripletex_customers")
      .select("company_id,tripletex_customer_id")
      .eq("company_id", period.company_id)
      .maybeSingle();

    if (customerMappingError) {
      await markInvoicePeriodTransientError(admin, uniqueRef, "TRIPLETEX_CUSTOMER_MAPPING_LOOKUP_FAILED");
      return {
        ok: false,
        permanent: false,
        error: safeStr(customerMappingError?.message ?? "TRIPLETEX_CUSTOMER_MAPPING_LOOKUP_FAILED") || "TRIPLETEX_CUSTOMER_MAPPING_LOOKUP_FAILED",
      };
    }

    tripletexCustomerId = safeStr((customerMapping as any)?.tripletex_customer_id);
    if (!tripletexCustomerId) {
      const customer = await ensureCustomer({
        admin,
        company: {
          id: period.company_id,
          orgnr,
          legal_name: legalName,
          billing_email: safeStr((company as any).billing_email) || null,
          billing_address: billingAddress,
          billing_postcode: billingPostcode,
          billing_city: billingCity,
          billing_country: billingCountry,
          ehf_enabled: Boolean((company as any).ehf_enabled),
          ehf_endpoint: safeStr((company as any).ehf_endpoint) || null,
        },
        request: { auth: await getRunAuth() },
      });
      tripletexCustomerId = customer.customerId;
    }

    const tier = normalizeStatus(period.tier);
    const invoiceLines: Array<{
      productId: string;
      quantity: number;
      unit_price: number;
      product_name: string;
      tripletex_vat_code: string;
      revenue_account: string | null;
      currency: string;
    }> = [];

    if (tier === "BASIS") {
      const line = await ensureInvoiceTierLine(admin, getRunAuth, period, "BASIS");
      invoiceLines.push({
        productId: line.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        product_name: line.productName,
        tripletex_vat_code: line.vatCode,
        revenue_account: line.revenueAccount,
        currency: "NOK",
      });
    } else if (tier === "LUXUS") {
      const line = await ensureInvoiceTierLine(admin, getRunAuth, period, "LUXUS");
      invoiceLines.push({
        productId: line.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        product_name: line.productName,
        tripletex_vat_code: line.vatCode,
        revenue_account: line.revenueAccount,
        currency: "NOK",
      });
    } else if (tier === "MIXED") {
      const basis = await ensureInvoiceTierLine(admin, getRunAuth, period, "BASIS");
      const luxus = await ensureInvoiceTierLine(admin, getRunAuth, period, "LUXUS");
      invoiceLines.push({
        productId: basis.productId,
        quantity: basis.quantity,
        unit_price: basis.unitPrice,
        product_name: basis.productName,
        tripletex_vat_code: basis.vatCode,
        revenue_account: basis.revenueAccount,
        currency: "NOK",
      });
      invoiceLines.push({
        productId: luxus.productId,
        quantity: luxus.quantity,
        unit_price: luxus.unitPrice,
        product_name: luxus.productName,
        tripletex_vat_code: luxus.vatCode,
        revenue_account: luxus.revenueAccount,
        currency: "NOK",
      });
    } else {
      await markInvoicePeriodFailed(admin, uniqueRef, "INVOICE_PERIOD_TIER_INVALID");
      return { ok: false, permanent: true, error: "INVOICE_PERIOD_TIER_INVALID" };
    }

    const invoice = await createInvoice({
      uniqueRef,
      customerId: tripletexCustomerId,
      invoiceLines,
      request: {
        auth: await getRunAuth(),
      },
    });

    const invoiceId = safeStr(invoice.externalId);
    if (!invoiceId) {
      await markInvoicePeriodFailed(admin, uniqueRef, "TRIPLETEX_INVOICE_ID_MISSING");
      return { ok: false, permanent: true, error: "TRIPLETEX_INVOICE_ID_MISSING" };
    }

    await upsertTripletexExport(admin, uniqueRef, invoiceId);
    await markInvoicePeriodSent(admin, uniqueRef, invoiceId);
    await enqueueInvoiceSent(admin, uniqueRef, invoiceId);

    return { ok: true };
  } catch (error: any) {
    const classified = classifyError(error);

    if (classified.permanent) {
      await markInvoicePeriodFailed(admin, uniqueRef, classified.message);
      return { ok: false, permanent: true, error: classified.message };
    }

    await markInvoicePeriodTransientError(admin, uniqueRef, classified.message);
    return { ok: false, permanent: false, error: classified.message };
  }
}

async function handleEvent(
  admin: any,
  row: OutboxRow,
  getRunAuth: () => Promise<TripletexAuth>
): Promise<HandleEventResult> {
  const eventPrefix = safeStr(row.event_key).split(":")[0];

  switch (eventPrefix) {
    case "invoice.ready":
      return processInvoiceReady(admin, row, getRunAuth);

    default:
      return { ok: false, permanent: true, error: "UNSUPPORTED_EVENT" };
  }
}

export async function POST(_req: NextRequest) {
  const rid = makeRid();

  try {
    const admin = supabaseAdmin();
    const workerId = `invoice-outbox-worker-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const concurrency = parseConcurrency(process.env.TRIPLETEX_OUTBOX_CONCURRENCY);

    let runAuthPromise: Promise<TripletexAuth> | null = null;
    const getRunAuth = async () => {
      if (!runAuthPromise) {
        runAuthPromise = resolveTripletexAuth();
      }
      return runAuthPromise;
    };

    const { data: pendingRows, error: pendingError } = await admin
      .from("outbox")
      .select("id,event_key,status,attempts,last_error,payload,locked_at,locked_by,created_at")
      .eq("status", "PENDING")
      .is("locked_at", null)
      .like("event_key", "invoice.ready:%")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (pendingError) {
      return jsonErr(rid, "Kunne ikke hente ventende invoice-hendelser.", 500, "OUTBOX_READ_FAILED");
    }

    const ids = ((pendingRows ?? []) as OutboxRow[])
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id));

    if (ids.length === 0) {
      return jsonOk(rid, { processed: 0, delivered: 0, failed: 0, failedPermanent: 0 });
    }

    const { error: claimError } = await admin
      .from("outbox")
      .update({
        locked_at: nowIso,
        locked_by: workerId,
        status: "PROCESSING",
      })
      .in("id", ids)
      .eq("status", "PENDING")
      .is("locked_at", null);

    if (claimError) {
      return jsonErr(rid, "Kunne ikke laase invoice-hendelser.", 500, "OUTBOX_CLAIM_FAILED");
    }

    const { data: claimedRows, error: claimedError } = await admin
      .from("outbox")
      .select("id,event_key,status,attempts,last_error,payload,locked_at,locked_by,created_at")
      .eq("status", "PROCESSING")
      .eq("locked_by", workerId)
      .eq("locked_at", nowIso)
      .like("event_key", "invoice.ready:%")
      .order("created_at", { ascending: true });

    if (claimedError) {
      return jsonErr(rid, "Kunne ikke lese laaste invoice-hendelser.", 500, "OUTBOX_PROCESSING_READ_FAILED");
    }

    let processed = 0;
    let delivered = 0;
    let failed = 0;
    let failedPermanent = 0;

    await processWithConcurrency((claimedRows ?? []) as OutboxRow[], concurrency, async (row) => {
      processed += 1;

      try {
        const result = await handleEvent(admin, row, getRunAuth);

        if (result.ok) {
          await markOutboxSent(admin, row, workerId, nowIso);
          delivered += 1;
          return;
        }

        const permanent = Boolean(result.permanent);
        await markOutboxFailed(admin, row, workerId, nowIso, safeStr(result.error) || "EVENT_FAILED", permanent);
        if (permanent) failedPermanent += 1;
        else failed += 1;
      } catch (error) {
        const classified = classifyError(error);
        await markOutboxFailed(admin, row, workerId, nowIso, classified.message, classified.permanent);
        if (classified.permanent) failedPermanent += 1;
        else failed += 1;
      }
    });

    return jsonOk(rid, { processed, delivered, failed, failedPermanent });
  } catch (error: any) {
    return jsonErr(rid, "Invoice outbox behandling feilet.", 500, {
      code: "OUTBOX_PROCESS_FAILED",
      detail: {
        message: safeStr(error?.message ?? error),
      },
    });
  }
}

