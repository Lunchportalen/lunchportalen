export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm, toPeriodYmBounds } from "@/lib/billing/periodYm";
import { osloNowIsoLocal, osloPreviousPeriodYm } from "@/lib/date/osloPeriod";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { enqueueInvoiceReadyOutbox, type InvoiceReadyOutboxInput } from "@/lib/outbox/invoiceReady";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AgreementTier = "BASIS" | "LUXUS";

type AgreementSummary = {
  companyId: string;
  tier: AgreementTier | null;
  pricePerEmployee: number;
  updatedAtMs: number;
};

type ExistingInvoicePeriod = {
  companyId: string;
  status: string;
  tripletexInvoiceId: string | null;
};

type InvoicePeriodUpsert = {
  company_id: string;
  period: string;
  count_basis: number;
  count_luxus: number;
  unit_price_basis: number;
  unit_price_luxus: number;
  total: number;
  unique_ref: string;
  status: "READY" | "FAILED";
  tripletex_invoice_id: string | null;
  last_error: string | null;
  generated_at: string;
};

type PreviewRow = {
  companyId: string;
  period: string;
  tier: AgreementTier | null;
  count: number;
  unitPrice: number;
  total: number;
  outcome: "READY" | "FAILED" | "SKIPPED_SENT";
  reason?: string;
};

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 200;

// Conservativ fail-closed allowlist: fakturer kun ACTIVE inntil status-kontrakt er 100% bekreftet.
// Videre utvidelse av allowlist krever eksplisitt avklaring av ordrestatus-kontrakt.
const BILLABLE_ORDER_STATUSES = ["ACTIVE"] as const;

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(value: unknown): string {
  return safeStr(value).toUpperCase();
}

function normalizeTier(value: unknown): AgreementTier | null {
  const tier = normalizeStatus(value);
  if (tier === "BASIS" || tier === "LUXUS") return tier;
  return null;
}

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function isSchemaError(error: any): boolean {
  const code = safeStr(error?.code).toLowerCase();
  const msg = safeStr(error?.message ?? error?.details ?? error?.hint).toLowerCase();

  return (
    code === "42703" ||
    code === "42p01" ||
    code === "pgrst205" ||
    msg.includes("column") ||
    msg.includes("relation") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function dryRunEnabled(req: NextRequest): boolean {
  const v = safeStr(new URL(req.url).searchParams.get("dryRun"));
  return v === "1";
}

function chooseAgreement(prev: AgreementSummary | undefined, next: AgreementSummary): AgreementSummary {
  if (!prev) return next;
  if (next.updatedAtMs > prev.updatedAtMs) return next;
  return prev;
}

async function loadBillableOrderCountsByCompany(
  admin: any,
  periodStart: string,
  periodEndExclusive: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("orders")
      .select("company_id")
      .in("status", [...BILLABLE_ORDER_STATUSES])
      .gte("date", periodStart)
      .lt("date", periodEndExclusive)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const companyId = safeStr((row as any)?.company_id);
      if (!companyId) continue;
      counts.set(companyId, (counts.get(companyId) ?? 0) + 1);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return counts;
}

async function fetchAgreementRows(admin: any, companyChunk: string[], withUpdatedAt: boolean): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;

  while (true) {
    // Hvis agreement-modell har company_id + location_id, velger vi fortsatt per company_id
    // og plukker siste ACTIVE rad (fail-closed, ingen gjetting mellom lokasjoner).
    let query = admin
      .from("agreements")
      .select(withUpdatedAt ? "company_id,tier,price_per_employee,updated_at" : "company_id,tier,price_per_employee")
      .in("company_id", companyChunk)
      .eq("status", "ACTIVE")
      .range(offset, offset + PAGE_SIZE - 1);

    if (withUpdatedAt) {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function loadActiveAgreementsByCompany(
  admin: any,
  companyIds: string[]
): Promise<{ byCompany: Map<string, AgreementSummary>; loadError: string | null }> {
  const byCompany = new Map<string, AgreementSummary>();

  for (const part of chunk(companyIds, CHUNK_SIZE)) {
    let rows: any[] = [];

    try {
      rows = await fetchAgreementRows(admin, part, true);
    } catch (error: any) {
      if (!isSchemaError(error)) throw error;

      try {
        rows = await fetchAgreementRows(admin, part, false);
      } catch (fallbackError: any) {
        if (isSchemaError(fallbackError)) {
          return {
            byCompany,
            loadError: "AGREEMENT_SCHEMA_ERROR",
          };
        }
        throw fallbackError;
      }
    }

    for (const row of rows) {
      const companyId = safeStr((row as any)?.company_id);
      if (!companyId) continue;

      const updatedAtRaw = safeStr((row as any)?.updated_at);
      const updatedAtMs = Number.isFinite(Date.parse(updatedAtRaw)) ? Date.parse(updatedAtRaw) : 0;

      const candidate: AgreementSummary = {
        companyId,
        tier: normalizeTier((row as any)?.tier),
        pricePerEmployee: safeNum((row as any)?.price_per_employee),
        updatedAtMs,
      };

      const prev = byCompany.get(companyId);
      byCompany.set(companyId, chooseAgreement(prev, candidate));
    }
  }

  return { byCompany, loadError: null };
}

async function loadExistingInvoicePeriods(
  admin: any,
  companyIds: string[],
  period: string
): Promise<Map<string, ExistingInvoicePeriod>> {
  const out = new Map<string, ExistingInvoicePeriod>();

  for (const part of chunk(companyIds, CHUNK_SIZE)) {
    const { data, error } = await admin
      .from("invoice_periods")
      .select("company_id,status,tripletex_invoice_id")
      .eq("period", period)
      .in("company_id", part);

    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const companyId = safeStr((row as any)?.company_id);
      if (!companyId) continue;

      out.set(companyId, {
        companyId,
        status: normalizeStatus((row as any)?.status),
        tripletexInvoiceId: safeStr((row as any)?.tripletex_invoice_id) || null,
      });
    }
  }

  return out;
}

async function upsertInvoicePeriods(admin: any, rows: InvoicePeriodUpsert[]): Promise<void> {
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await admin.from("invoice_periods").upsert(part, {
      onConflict: "company_id,period",
      ignoreDuplicates: false,
    });

    if (error) throw error;
  }
}

/**
 * DONE criteria (verified by design in this route):
 * 1) Idempotent rows: upsert on (company_id,period) => maks 1 rad per firma/periode.
 * 2) Idempotent outbox: upsert on event_key + ignoreDuplicates => maks 1 invoice.ready per unique_ref.
 * 3) SENT rows: status=SENT + tripletex_invoice_id => SKIPPED_SENT (ingen rewrite, ingen outbox).
 * 4) Manglende avtale/pris/tier => FAILED + last_error, ingen outbox-event.
 * 5) dryRun=1 => ingen writes til invoice_periods/outbox; kun preview/summary.
 * 6) Smoke: kjÃ¸r samme period to ganger => maks 1 outbox event per invoice.ready:<uniqueRef>.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const code = safeStr(e?.code).toLowerCase();
    const msg = safeStr(e?.message).toLowerCase();

    if (code === "cron_secret_missing" || msg === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i servermiljÃ¸.", 500, "CRON_SECRET_MISSING");
    }

    return jsonErr(rid, "Ugyldig eller manglende cron-tilgang.", 403, "CRON_FORBIDDEN");
  }

  const url = new URL(req.url);
  const periodInput = safeStr(url.searchParams.get("period"));
  const resolvedPeriod = periodInput || osloPreviousPeriodYm();
  const bounds = toPeriodYmBounds(resolvedPeriod);
  const dryRun = dryRunEnabled(req);

  if (!bounds || !parsePeriodYm(resolvedPeriod)) {
    return jsonErr(rid, "period mÃ¥ vÃ¦re pÃ¥ formatet YYYY-MM.", 400, "BAD_REQUEST", {
      period: resolvedPeriod,
    });
  }

  try {
    const admin = supabaseAdmin();

    const countsByCompany = await loadBillableOrderCountsByCompany(
      admin,
      bounds.periodStart,
      bounds.periodEndExclusive
    );
    const companyIds = Array.from(countsByCompany.keys()).sort((a, b) => a.localeCompare(b));

    if (companyIds.length === 0) {
      return jsonOk(rid, {
        period: bounds.period,
        processed_companies: 0,
        ready: 0,
        failed: 0,
        skipped: 0,
        outbox_failed: 0,
        dryRun,
        preview: dryRun ? [] : undefined,
      });
    }

    const existingByCompany = await loadExistingInvoicePeriods(admin, companyIds, bounds.period);
    const agreementsRes = await loadActiveAgreementsByCompany(admin, companyIds);

    let ready = 0;
    let failed = 0;
    let skipped = 0;
    let outboxFailed = 0;

    const generatedAt = new Date().toISOString();
    const generatedAtOslo = osloNowIsoLocal();

    const upserts: InvoicePeriodUpsert[] = [];
    const readyEvents: InvoiceReadyOutboxInput[] = [];
    const preview: PreviewRow[] = [];

    for (const companyId of companyIds) {
      const billableCount = Math.max(0, Math.floor(countsByCompany.get(companyId) ?? 0));
      const existing = existingByCompany.get(companyId);
      const uniqueRef = `${companyId}:${bounds.period}`;

      if (existing?.status === "SENT" && safeStr(existing.tripletexInvoiceId)) {
        skipped += 1;

        preview.push({
          companyId,
          period: bounds.period,
          tier: null,
          count: billableCount,
          unitPrice: 0,
          total: 0,
          outcome: "SKIPPED_SENT",
          reason: "ALREADY_SENT",
        });

        console.info("[cron.invoice_periods.company]", {
          rid,
          company_id: companyId,
          outcome: "SKIPPED_SENT",
          count: billableCount,
          total: 0,
        });
        continue;
      }

      const failedUpsert = (reason: string) => {
        failed += 1;

        upserts.push({
          company_id: companyId,
          period: bounds.period,
          count_basis: 0,
          count_luxus: 0,
          unit_price_basis: 1,
          unit_price_luxus: 1,
          total: 0,
          unique_ref: uniqueRef,
          status: "FAILED",
          tripletex_invoice_id: existing?.tripletexInvoiceId ?? null,
          last_error: reason,
          generated_at: generatedAt,
        });

        preview.push({
          companyId,
          period: bounds.period,
          tier: null,
          count: billableCount,
          unitPrice: 0,
          total: 0,
          outcome: "FAILED",
          reason,
        });

        console.info("[cron.invoice_periods.company]", {
          rid,
          company_id: companyId,
          outcome: "FAILED",
          reason,
          count: billableCount,
          total: 0,
        });
      };

      if (agreementsRes.loadError) {
        failedUpsert(agreementsRes.loadError);
        continue;
      }

      const agreement = agreementsRes.byCompany.get(companyId);
      if (!agreement) {
        failedUpsert("MISSING_ACTIVE_AGREEMENT");
        continue;
      }

      if (!agreement.tier) {
        failedUpsert("MISSING_TIER");
        continue;
      }

      if (!(agreement.pricePerEmployee > 0)) {
        failedUpsert("MISSING_PRICE");
        continue;
      }

      const countBasis = agreement.tier === "BASIS" ? billableCount : 0;
      const countLuxus = agreement.tier === "LUXUS" ? billableCount : 0;
      const unitPriceBasis = agreement.tier === "BASIS" ? agreement.pricePerEmployee : 1;
      const unitPriceLuxus = agreement.tier === "LUXUS" ? agreement.pricePerEmployee : 1;
      const total = Number((countBasis * unitPriceBasis + countLuxus * unitPriceLuxus).toFixed(4));

      ready += 1;

      upserts.push({
        company_id: companyId,
        period: bounds.period,
        count_basis: countBasis,
        count_luxus: countLuxus,
        unit_price_basis: unitPriceBasis,
        unit_price_luxus: unitPriceLuxus,
        total,
        unique_ref: uniqueRef,
        status: "READY",
        tripletex_invoice_id: existing?.tripletexInvoiceId ?? null,
        last_error: null,
        generated_at: generatedAt,
      });

      readyEvents.push({
        uniqueRef,
        companyId,
        period: bounds.period,
        countBasis,
        countLuxus,
        unitPriceBasis,
        unitPriceLuxus,
        total,
        generatedAt: generatedAtOslo,
        invoiceStatus: existing?.status ?? null,
        tripletexInvoiceId: existing?.tripletexInvoiceId ?? null,
      });

      preview.push({
        companyId,
        period: bounds.period,
        tier: agreement.tier,
        count: billableCount,
        unitPrice: agreement.pricePerEmployee,
        total,
        outcome: "READY",
      });

      console.info("[cron.invoice_periods.company]", {
        rid,
        company_id: companyId,
        outcome: "READY",
        count: billableCount,
        total,
      });
    }

    if (!dryRun && upserts.length > 0) {
      await upsertInvoicePeriods(admin, upserts);
      const outboxResult = await enqueueInvoiceReadyOutbox(admin, readyEvents, { dryRun: false });
      outboxFailed = outboxResult.failed;

      for (const item of outboxResult.results) {
        if (!item.ok) {
          console.warn("[cron.invoice_periods.outbox_failed]", {
            rid,
            company_id: item.companyId,
            unique_ref: item.uniqueRef,
            error_code: item.errorCode ?? "OUTBOX_UPSERT_FAILED",
          });
        }
      }
    }

    console.info("[cron.invoice_periods.generate]", {
      rid,
      period: bounds.period,
      dryRun,
      processed_companies: companyIds.length,
      ready,
      failed,
      skipped,
      outbox_failed: outboxFailed,
    });

    return jsonOk(rid, {
      period: bounds.period,
      processed_companies: companyIds.length,
      ready,
      failed,
      skipped,
      outbox_failed: outboxFailed,
      dryRun,
      preview: dryRun ? preview.slice(0, 20) : undefined,
    });
  } catch {
    return jsonErr(rid, "Kunne ikke generere fakturaperiode.", 500, "INVOICE_PERIOD_GENERATE_FAILED");
  }
}

