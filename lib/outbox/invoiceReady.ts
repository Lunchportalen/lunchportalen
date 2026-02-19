import "server-only";

import { osloNowIsoLocal } from "@/lib/date/osloPeriod";

export type InvoiceReadyOutboxInput = {
  uniqueRef: string;
  companyId: string;
  period: string;
  countBasis: number;
  countLuxus: number;
  unitPriceBasis: number;
  unitPriceLuxus: number;
  total: number;
  generatedAt?: string;
  invoiceStatus?: string | null;
  tripletexInvoiceId?: string | null;
};

export type InvoiceReadyOutboxCompanyResult = {
  companyId: string;
  uniqueRef: string;
  ok: boolean;
  skipped: boolean;
  reason?: string;
  errorCode?: string;
};

export type InvoiceReadyOutboxBatchResult = {
  attempted: number;
  inserted: number;
  skipped: number;
  failed: number;
  results: InvoiceReadyOutboxCompanyResult[];
};

export type InvoiceReadyOutboxOptions = {
  dryRun?: boolean;
};

const CHUNK_SIZE = 200;

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

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function toPayload(input: InvoiceReadyOutboxInput) {
  return {
    event: "invoice.ready",
    uniqueRef: safeStr(input.uniqueRef),
    companyId: safeStr(input.companyId),
    period: safeStr(input.period),
    countBasis: Math.max(0, Math.floor(safeNum(input.countBasis))),
    countLuxus: Math.max(0, Math.floor(safeNum(input.countLuxus))),
    unitPriceBasis: safeNum(input.unitPriceBasis),
    unitPriceLuxus: safeNum(input.unitPriceLuxus),
    total: safeNum(input.total),
    generatedAt: safeStr(input.generatedAt) || osloNowIsoLocal(),
  };
}

type NormalizedEvent = {
  eventKey: string;
  uniqueRef: string;
  companyId: string;
  payload: ReturnType<typeof toPayload>;
};

function classifyInput(input: InvoiceReadyOutboxInput): {
  event: NormalizedEvent | null;
  result: InvoiceReadyOutboxCompanyResult | null;
} {
  const uniqueRef = safeStr(input.uniqueRef);
  const companyId = safeStr(input.companyId);
  const status = normalizeStatus(input.invoiceStatus);
  const tripletexInvoiceId = safeStr(input.tripletexInvoiceId);

  if (!companyId || !uniqueRef) {
    return {
      event: null,
      result: {
        companyId: companyId || "unknown",
        uniqueRef: uniqueRef || "unknown",
        ok: false,
        skipped: false,
        errorCode: "INVALID_INPUT",
      },
    };
  }

  // Hard guard: never enqueue when invoice already exported/sent.
  if (status === "SENT" || tripletexInvoiceId) {
    return {
      event: null,
      result: {
        companyId,
        uniqueRef,
        ok: true,
        skipped: true,
        reason: "ALREADY_SENT",
      },
    };
  }

  return {
    event: {
      eventKey: `invoice.ready:${uniqueRef}`,
      uniqueRef,
      companyId,
      payload: toPayload(input),
    },
    result: null,
  };
}

function errorCodeFrom(error: any): string {
  const code = safeStr(error?.code).toUpperCase();
  if (code) return `OUTBOX_UPSERT_FAILED_${code}`;
  return "OUTBOX_UPSERT_FAILED";
}

export async function enqueueInvoiceReadyOutbox(
  admin: any,
  events: InvoiceReadyOutboxInput[],
  options: InvoiceReadyOutboxOptions = {}
): Promise<InvoiceReadyOutboxBatchResult> {
  const dryRun = Boolean(options.dryRun);
  const results: InvoiceReadyOutboxCompanyResult[] = [];
  const deduped = new Map<string, NormalizedEvent>();

  for (const input of events) {
    const classified = classifyInput(input);
    if (classified.result) {
      results.push(classified.result);
      continue;
    }
    if (!classified.event) continue;

    if (deduped.has(classified.event.uniqueRef)) {
      results.push({
        companyId: classified.event.companyId,
        uniqueRef: classified.event.uniqueRef,
        ok: true,
        skipped: true,
        reason: "DUPLICATE_INPUT",
      });
      continue;
    }

    deduped.set(classified.event.uniqueRef, classified.event);
  }

  const pending = Array.from(deduped.values());

  if (dryRun) {
    for (const event of pending) {
      results.push({
        companyId: event.companyId,
        uniqueRef: event.uniqueRef,
        ok: true,
        skipped: true,
        reason: "DRY_RUN",
      });
    }

    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;
    return {
      attempted: pending.length,
      inserted: 0,
      skipped,
      failed,
      results,
    };
  }

  let inserted = 0;
  let failed = 0;

  for (const part of chunk(pending, CHUNK_SIZE)) {
    const rows = part.map((event) => ({
      // Schema-safe outbox columns only.
      event_key: event.eventKey,
      payload: event.payload,
      status: "PENDING",
      attempts: 0,
      last_error: null,
      locked_at: null,
      locked_by: null,
    }));

    let error: any = null;
    try {
      const res = await admin.from("outbox").upsert(rows, {
        // Idempotent dedupe: ON CONFLICT(event_key) DO NOTHING.
        onConflict: "event_key",
        ignoreDuplicates: true,
      });
      error = res?.error ?? null;
    } catch (caught: any) {
      error = caught;
    }

    if (error) {
      failed += part.length;
      const errorCode = errorCodeFrom(error);
      for (const event of part) {
        results.push({
          companyId: event.companyId,
          uniqueRef: event.uniqueRef,
          ok: false,
          skipped: false,
          errorCode,
        });
      }
      continue;
    }

    inserted += part.length;
    for (const event of part) {
      results.push({
        companyId: event.companyId,
        uniqueRef: event.uniqueRef,
        ok: true,
        skipped: false,
        reason: "ENQUEUED_OR_EXISTS",
      });
    }
  }

  const skipped = results.filter((r) => r.skipped).length;
  return {
    attempted: pending.length,
    inserted,
    skipped,
    failed,
    results,
  };
}
