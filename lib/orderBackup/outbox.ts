// lib/orderBackup/outbox.ts
import "server-only";

import { sendMail } from "@/lib/orderBackup/smtp";
import {
  resolveOrderNotificationRecipients,
  type OrderNotificationRouting,
} from "@/lib/orders/resolveOrderNotificationRecipients";
import {
  OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES,
  OUTBOX_SMTP_EMAIL_PREFIXES,
  OUTBOX_STATE_EVENT_PREFIXES,
} from "@/lib/outbox/eventKinds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORDER_EMAIL as SYSTEM_ORDER_EMAIL } from "@/lib/system/emailAddresses";
import { opsLog } from "@/lib/ops/log";
import { reportOutboxPermanentFailure } from "@/lib/sentry/capture";
import type { OrderBackupInput } from "./types";

export type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "FAILED_PERMANENT";

export type OutboxRow = {
  id: string;
  event_key: string;
  payload: OrderBackupInput;
  status: OutboxStatus;
  attempts: number;
  created_at?: string;
  last_error?: string | null;
};

const OUTBOX_MAX_ATTEMPTS = 10;

/** Fan-out / state markers: no SMTP; row closed as SENT (noop until a dedicated consumer exists). */
export { OUTBOX_STATE_EVENT_PREFIXES };

/**
 * Known SMTP-queue prefixes. Rows may still fail `payload_missing_fields` until from/to/subject resolve.
 * Ad-hoc keys (e.g. legacy smoke tests) are allowed when the JSON payload already carries a full triplet.
 */
export const OUTBOX_DECLARED_EMAIL_PREFIXES = OUTBOX_SMTP_EMAIL_PREFIXES;

const OUTBOX_INVOICE_READY_PREFIX = "invoice.ready:";
const OUTBOX_TRIPLETEX_PROVIDER_CUSTOMER_PREFIX = "tripletex.provider_customer_create_lp:";
const OUTBOX_TRIPLETEX_SAAS_INVOICE_PREFIX = "tripletex.saas_invoice_create_lp:";

function extractOutboxEmailFields(p: unknown) {
  const x: any = p ?? {};
  const from = safeStr(x.from ?? x.from_email ?? x.fromEmail);
  const to = safeStr(x.to ?? x.to_email ?? x.toEmail);
  const subject = safeStr(x.subject);
  return { from, to, subject };
}

export function isOutboxStateEventKey(eventKey: string): boolean {
  const k = safeStr(eventKey);
  return OUTBOX_STATE_EVENT_PREFIXES.some((pre) => k.startsWith(pre));
}

function isOutboxInvoiceReadyKey(eventKey: string): boolean {
  return safeStr(eventKey).startsWith(OUTBOX_INVOICE_READY_PREFIX);
}

function isOutboxTripletexProviderCustomerCreateLpKey(eventKey: string): boolean {
  return safeStr(eventKey).startsWith(OUTBOX_TRIPLETEX_PROVIDER_CUSTOMER_PREFIX);
}

function isOutboxTripletexSaasInvoiceCreateLpKey(eventKey: string): boolean {
  return safeStr(eventKey).startsWith(OUTBOX_TRIPLETEX_SAAS_INVOICE_PREFIX);
}

function matchesDeclaredOutboxEmailPrefix(eventKey: string): boolean {
  const k = safeStr(eventKey);
  return OUTBOX_DECLARED_EMAIL_PREFIXES.some((pre) => k.startsWith(pre));
}

/**
 * Whether the row belongs on the SMTP worker path (not state noop, not Tripletex invoice.ready worker).
 */
export function isOutboxEmailRoutedEvent(eventKey: string, payload: unknown): boolean {
  const k = safeStr(eventKey);
  if (
    !k ||
    isOutboxStateEventKey(k) ||
    isOutboxInvoiceReadyKey(k) ||
    isOutboxTripletexProviderCustomerCreateLpKey(k) ||
    isOutboxTripletexSaasInvoiceCreateLpKey(k)
  ) {
    return false;
  }
  const { from, to, subject } = extractOutboxEmailFields(payload);
  if (from && to && subject) return true;
  return matchesDeclaredOutboxEmailPrefix(k);
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function errString(e: unknown) {
  try {
    return safeStr((e as any)?.message ?? e) || "unknown_error";
  } catch {
    return "unknown_error";
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function outboxLog(level: "info" | "error", event: string, meta: Record<string, unknown>) {
  const payload = { ts: nowIso(), event, ...meta };
  if (level === "error") {
    console.error("[outbox]", payload);
  } else {
    console.log("[outbox]", payload);
  }
}

async function rpc<T>(fn: string, params: Record<string, unknown>) {
  const admin = supabaseAdmin() as any;
  const { data, error } = await admin.rpc(fn, params);
  if (error) throw new Error(`${fn}_failed: ${error.message}`);
  return data as T;
}

async function rpcWithParamFallbacks<T>(fn: string, candidates: Array<Record<string, unknown>>) {
  let lastError: unknown = null;
  for (const params of candidates) {
    try {
      return await rpc<T>(fn, params);
    } catch (e) {
      lastError = e;
    }
  }
  throw (lastError as Error) ?? new Error(`${fn}_failed`);
}

function asRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data) return [];
  return [data as T];
}

async function resolveOutboxIdByEventKey(eventKey: string): Promise<string> {
  const key = safeStr(eventKey);
  if (!key) throw new Error("eventKey required");

  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch {
    throw new Error("CONFIG_ERROR: service role client not configured for outbox lookup");
  }

  try {
    const { data, error } = await admin.from("outbox").select("id").eq("event_key", key).maybeSingle();
    if (error) throw error;

    const id = safeStr((data as any)?.id);
    if (!id) throw new Error("outbox_row_not_found");
    return id;
  } catch (e: any) {
    throw new Error(`outbox_lookup_failed: ${safeStr(e?.message) || "unknown_error"}`);
  }
}

// Kept for compatibility with existing callers outside the worker path.
export async function upsertOutboxEvent(eventKey: string, payload: OrderBackupInput) {
  const admin = supabaseAdmin();
  const key = safeStr(eventKey);
  if (!key) throw new Error("eventKey required");

  const { error } = await admin
    .from("outbox")
    .upsert(
      {
        event_key: key,
        payload,
        status: "PENDING" as OutboxStatus,
        attempts: 0,
      },
      { onConflict: "event_key" }
    );

  if (error) throw error;

  if (process.env.OUTBOX_QUEUE_FANOUT === "true") {
    try {
      const { fanOutOutboxInserted } = await import("@/lib/infra/outboxQueueBridge");
      await fanOutOutboxInserted(key);
    } catch (e) {
      const message = errString(e);
      outboxLog("error", "queue_fanout_failed", { eventKey: key, message });
      opsLog("order.outbox.queue_fanout_failed", { event_key: key, detail: message });
    }
  }
}

/**
 * Etter vellykket `lp_order_set`: RPC har allerede skrevet `public.outbox` med `event_key`
 * `order.set:<userId>:<date>:<slot>`. Dette er kun valgfri wake mot kø/cron — aldri brukerfeil.
 */
export async function fanoutLpOrderSetOutboxBestEffort(p: {
  userId: string | null | undefined;
  date: string;
  slot: string;
}): Promise<void> {
  const uid = safeStr(p.userId);
  const date = safeStr(p.date);
  const slot = safeStr(p.slot);
  if (!uid || !date) return;
  const key = `order.set:${uid}:${date}:${slot}`;
  try {
    const { fanOutOutboxInserted } = await import("@/lib/infra/outboxQueueBridge");
    await fanOutOutboxInserted(key);
  } catch (e) {
    const message = errString(e);
    outboxLog("error", "order_outbox_rpc_fanout_failed", { event_key: key, message });
    opsLog("order.outbox.rpc_fanout_failed", { event_key: key, detail: message });
  }
}

export type DayChoiceCancelOutboxParams = {
  dbEventKey: string;
  rid: string;
  orderId: string;
  companyId: string;
  locationId: string;
  userId: string;
  userEmail: string | null;
  date: string;
  orderStatus: string;
  /** Ordrens provider_id (orders.provider_id). Null → varsling går kun til plattformkopi. */
  providerId?: string | null;
};

function isoToDottedDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safeStr(iso));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : safeStr(iso);
}

function dayChoiceCancelMailFrom(): string {
  return safeStr(process.env.LP_RESEND_FROM) || `Lunchportalen <${SYSTEM_ORDER_EMAIL}>`;
}

/**
 * Ren payload-bygger for avbestillings-varsling (testbar uten I/O).
 * `routing.recipients` inneholder provider-routet mottaker + plattformkopi (deduplisert).
 */
export function buildDayChoiceCancelOutboxPayload(
  p: DayChoiceCancelOutboxParams,
  routing: OrderNotificationRouting,
  opts?: { from?: string; timestampISO?: string },
): OrderBackupInput {
  const ts = safeStr(opts?.timestampISO) || new Date().toISOString();
  const prettyDate = isoToDottedDate(p.date);

  const bodyText = [
    "Avbestilling (drift)",
    "",
    `Dato: ${prettyDate}`,
    `Status: ${safeStr(p.orderStatus) || "-"}`,
    "",
    `OrderId: ${safeStr(p.orderId) || "-"}`,
    `RID: ${safeStr(p.rid) || "-"}`,
    "",
    "Denne meldingen er sendt automatisk fra Lunchportalen.",
  ].join("\n");

  return {
    eventType: "ORDER_CANCELLED",
    rid: p.rid,
    eventKey: safeStr(p.dbEventKey),
    userId: p.userId,
    userEmail: p.userEmail,
    companyId: p.companyId,
    locationId: p.locationId,
    date: p.date,
    status: p.orderStatus,
    orderId: p.orderId,
    timestampISO: ts,
    from: safeStr(opts?.from) || dayChoiceCancelMailFrom(),
    to: routing.recipients.join(", "),
    subject: `Ordre avbestilt – ${prettyDate} – Lunchportalen`,
    bodyText,
    extra: {
      source: "day_choice_http",
      providerId: routing.providerId,
      recipientSource: routing.recipientSource,
    },
  };
}

/**
 * `POST /api/order/cancel` (day_choice): persisterer canonical `public.outbox` etter verifisert ordre-rad.
 * Kaster ved DB-feil — HTTP-laget skal ikke returnere suksess uten vellykket outbox-skriving.
 *
 * Mottakere: provider-routet via ordrens provider_id (operations_email-kjeden) + plattformkopi.
 * Resolver-feil er fail-safe (plattformkopi alene) og blokkerer aldri avbestillingen.
 */
export async function persistDayChoiceOrderCancelOutbox(p: DayChoiceCancelOutboxParams): Promise<void> {
  const key = safeStr(p.dbEventKey);
  if (!key) throw new Error("dbEventKey required");

  const routing = await resolveOrderNotificationRecipients(p.providerId ?? null);
  const payload = buildDayChoiceCancelOutboxPayload(p, routing);

  await upsertOutboxEvent(key, payload);
}

async function markOutboxSentById(outboxId: string, messageId: string | null = null) {
  return rpcWithParamFallbacks("lp_outbox_mark_sent", [
    { p_id: outboxId, p_message_id: messageId },
    { id: outboxId, p_message_id: messageId },
    { p_outbox_id: outboxId, p_message_id: messageId },
  ]);
}

export async function markOutboxSent(idOrEventKey: string, messageId: string | null = null) {
  const raw = safeStr(idOrEventKey);
  if (!raw) throw new Error("idOrEventKey required");

  try {
    await markOutboxSentById(raw, messageId);
    return;
  } catch {
    const outboxId = await resolveOutboxIdByEventKey(raw);
    await markOutboxSentById(outboxId, messageId);
  }
}

async function markStateOutboxEventClosed(outboxId: string) {
  await markOutboxSentById(outboxId, "state-noop");
}

/**
 * `invoice.ready:%` rows are processed by `/api/system/outbox/process` with its own claim loop.
 * If the SMTP worker claimed them first via `lp_outbox_claim`, release back to PENDING without burning attempts.
 */
async function releaseInvoiceReadyOutboxClaim(outboxId: string): Promise<boolean> {
  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch {
    return false;
  }
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("outbox")
    .update({
      status: "PENDING",
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .eq("id", outboxId)
    .eq("status", "PROCESSING")
    .select("id")
    .limit(1);

  if (error) {
    outboxLog("error", "invoice_ready_release_failed", { outbox_id: outboxId, message: errString(error) });
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function markOutboxFailedById(outboxId: string, errorMsg: string) {
  return rpcWithParamFallbacks<any>("lp_outbox_mark_failed", [
    { p_id: outboxId, p_error: safeStr(errorMsg) || "unknown_error" },
    { id: outboxId, p_error: safeStr(errorMsg) || "unknown_error" },
    { p_outbox_id: outboxId, p_error: safeStr(errorMsg) || "unknown_error" },
  ]);
}

export async function markOutboxFailed(idOrEventKey: string, errorMsg: string) {
  const raw = safeStr(idOrEventKey);
  if (!raw) throw new Error("idOrEventKey required");

  let data: unknown;
  let resolvedId = raw;

  try {
    data = await markOutboxFailedById(raw, errorMsg);
  } catch {
    resolvedId = await resolveOutboxIdByEventKey(raw);
    data = await markOutboxFailedById(resolvedId, errorMsg);
  }

  const row = asRows<{ status?: string; attempts?: number }>(data)[0] ?? {};
  const status = safeStr(row.status).toUpperCase() || "FAILED";
  const attempts = Number(row.attempts ?? 0);

  outboxLog(status === "FAILED_PERMANENT" ? "error" : "info", "mark_failed", {
    outbox_id: resolvedId,
    attempts,
    status,
  });

  if (status === "FAILED_PERMANENT") {
    reportOutboxPermanentFailure({
      outbox_id: resolvedId,
      attempts,
      status,
      error: safeStr(errorMsg) || "unknown_error",
    });
  }

  return {
    status: status as OutboxStatus,
    attempts,
  };
}

export async function resetStaleProcessing(staleMinutes = 10) {
  const mins = clampInt(staleMinutes, 1, 120, 10);
  const data = await rpc<any>("lp_outbox_reset_stale", { p_stale_minutes: mins });
  const row = asRows<{ reset_count?: number }>(data)[0] ?? {};
  return Number(row.reset_count ?? 0);
}

export async function claimOutbox(
  limit = 25,
  worker: string | null = null,
  opts?: { excludePrefixes?: readonly string[]; rid?: string },
): Promise<OutboxRow[]> {
  const n = clampInt(limit, 1, 200, 25);
  const excludePrefixes = Array.isArray(opts?.excludePrefixes)
    ? opts.excludePrefixes.map((p) => safeStr(p)).filter(Boolean)
    : [...OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES];
  const workerName = safeStr(worker) || null;

  outboxLog("info", "claim_requested", {
    rid: safeStr(opts?.rid) || null,
    worker: workerName,
    limit: n,
    exclude_prefixes: excludePrefixes,
  });

  const data = await rpcWithParamFallbacks<any>("lp_outbox_claim", [
    {
      p_limit: n,
      p_worker: workerName,
      p_exclude_prefixes: excludePrefixes,
    },
    {
      p_limit: n,
      p_worker: workerName,
    },
  ]);

  const rows = asRows<any>(data).map((row) => ({
    id: safeStr(row?.id),
    event_key: safeStr(row?.event_key),
    payload: (row?.payload ?? {}) as OrderBackupInput,
    status: (safeStr(row?.status).toUpperCase() as OutboxStatus) || "PENDING",
    attempts: Number(row?.attempts ?? 0),
    created_at: safeStr(row?.created_at) || undefined,
    last_error: row?.last_error ?? null,
  }));

  outboxLog("info", "claim_result", {
    rid: safeStr(opts?.rid) || null,
    worker: workerName,
    claimed_count: rows.length,
    event_keys: rows.map((row) => row.event_key),
  });

  return rows;
}

export async function fetchOutboxBatch(limit = 25): Promise<OutboxRow[]> {
  return claimOutbox(limit, "fetchOutboxBatch", { rid: "fetchOutboxBatch" });
}

export async function processOutboxBatch(
  limit = 25,
  opts?: {
    rid?: string;
    worker?: string;
    staleMinutes?: number;
    timeBudgetMs?: number;
  }
) {
  const rid = safeStr(opts?.rid);
  const worker = safeStr(opts?.worker) || (rid ? `cron:${rid}` : "cron:outbox");
  const staleMinutes = clampInt(opts?.staleMinutes, 1, 120, 10);
  const timeBudgetMs = clampInt(opts?.timeBudgetMs, 500, 60000, 20000);
  const started = Date.now();

  const resetStale = await resetStaleProcessing(staleMinutes);
  const rows = await claimOutbox(limit, worker, { rid, excludePrefixes: OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES });

  let sent = 0;
  /** Rows closed without SMTP (order.set / rollup.rebuild noop). */
  let stateNoop = 0;
  /** invoice.ready rows handed back to the Tripletex worker claim loop. */
  let releasedInvoiceReady = 0;
  let failed = 0;
  let failedPermanent = 0;
  let timedOut = 0;

  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - started >= timeBudgetMs) {
      timedOut = rows.length - i;
      break;
    }

    const row = rows[i];
    const outboxId = safeStr(row.id);
    const key = safeStr(row.event_key) || outboxId;

    const p: any = row.payload;

    if (isOutboxStateEventKey(key)) {
      let marked = false;
      try {
        await markStateOutboxEventClosed(outboxId);
        marked = true;
      } catch (e1: any) {
        try {
          await markStateOutboxEventClosed(outboxId);
          marked = true;
        } catch (e2: any) {
          outboxLog("error", "state_event_mark_sent_failed", {
            rid,
            outbox_id: outboxId,
            event_key: key,
            error: errString(e2),
          });
        }
      }
      if (marked) {
        stateNoop += 1;
        outboxLog("info", "state_event_noop", { rid, outbox_id: outboxId, event_key: key });
      } else {
        failed += 1;
      }
      continue;
    }

    if (isOutboxInvoiceReadyKey(key) || isOutboxTripletexProviderCustomerCreateLpKey(key)) {
      const released = await releaseInvoiceReadyOutboxClaim(outboxId);
      if (released) {
        releasedInvoiceReady += 1;
        outboxLog("info", "tripletex_outbox_released_to_pending", { rid, outbox_id: outboxId, event_key: key });
      } else {
        failed += 1;
        outboxLog("error", "tripletex_outbox_release_miss", { rid, outbox_id: outboxId, event_key: key });
      }
      continue;
    }

    if (!isOutboxEmailRoutedEvent(key, p)) {
      try {
        const mark = await markOutboxFailed(outboxId, `unknown_event_kind: ${key}`);
        if (mark.status === "FAILED_PERMANENT") failedPermanent += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      outboxLog("error", "unknown_event_kind", { rid, outbox_id: outboxId, event_key: key });
      continue;
    }

    const from = safeStr(p.from ?? p.from_email ?? p.fromEmail);
    const to = safeStr(p.to ?? p.to_email ?? p.toEmail);
    const subject = safeStr(p.subject);
    const text = safeStr(p.bodyText ?? p.text ?? "");
    const html = (p.bodyHtml ?? p.html ?? null) as string | null;

    if (!from || !to || !subject) {
      try {
        const mark = await markOutboxFailed(outboxId, "payload_missing_fields: from/to/subject");
        if (mark.status === "FAILED_PERMANENT") failedPermanent += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      outboxLog("error", "send_failed", { rid, outbox_id: outboxId, event_key: key, reason: "payload_missing_fields" });
      continue;
    }

    let sendSucceeded = false;
    try {
      await sendMail({ from, to, subject, text, html });
      sendSucceeded = true;
    } catch (e: any) {
      const mark = await markOutboxFailed(outboxId, errString(e));
      if (mark.status === "FAILED_PERMANENT") failedPermanent += 1;
      else failed += 1;
      outboxLog("error", "send_failed", {
        rid,
        outbox_id: outboxId,
        event_key: key,
        attempts_after: mark.attempts,
        max_attempts: OUTBOX_MAX_ATTEMPTS,
      });
      continue;
    }

    // Send succeeded: must mark SENT so retries do not duplicate. Retry mark once on failure.
    if (sendSucceeded) {
      let marked = false;
      try {
        await markOutboxSent(outboxId, null);
        marked = true;
      } catch (e1: any) {
        try {
          await markOutboxSent(outboxId, null);
          marked = true;
        } catch (e2: any) {
          outboxLog("error", "mark_sent_failed_after_send", {
            rid,
            outbox_id: outboxId,
            event_key: key,
            error: errString(e2),
          });
        }
      }
      sent += 1;
      if (marked) outboxLog("info", "sent", { rid, outbox_id: outboxId, event_key: key });
    }
  }

  return {
    ok: true as const,
    processed: rows.length,
    sent,
    stateNoop,
    releasedInvoiceReady,
    failed,
    failedPermanent,
    timedOut,
    resetStale,
    maxAttempts: OUTBOX_MAX_ATTEMPTS,
  };
}

export const processOutbox = processOutboxBatch;

