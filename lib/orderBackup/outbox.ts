// lib/orderBackup/outbox.ts
import "server-only";

import { sendMail } from "@/lib/orderBackup/smtp";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

export async function claimOutbox(limit = 25, worker: string | null = null): Promise<OutboxRow[]> {
  const n = clampInt(limit, 1, 200, 25);
  const data = await rpc<any>("lp_outbox_claim", {
    p_limit: n,
    p_worker: safeStr(worker) || null,
  });

  return asRows<any>(data).map((row) => ({
    id: safeStr(row?.id),
    event_key: safeStr(row?.event_key),
    payload: (row?.payload ?? {}) as OrderBackupInput,
    status: (safeStr(row?.status).toUpperCase() as OutboxStatus) || "PENDING",
    attempts: Number(row?.attempts ?? 0),
    created_at: safeStr(row?.created_at) || undefined,
    last_error: row?.last_error ?? null,
  }));
}

export async function fetchOutboxBatch(limit = 25): Promise<OutboxRow[]> {
  return claimOutbox(limit, "fetchOutboxBatch");
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
  const rows = await claimOutbox(limit, worker);

  let sent = 0;
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

    try {
      const p: any = row.payload;

      const from = safeStr(p.from ?? p.from_email ?? p.fromEmail);
      const to = safeStr(p.to ?? p.to_email ?? p.toEmail);
      const subject = safeStr(p.subject);
      const text = safeStr(p.bodyText ?? p.text ?? "");
      const html = (p.bodyHtml ?? p.html ?? null) as string | null;

      if (!from || !to || !subject) {
        throw new Error(`payload_missing_fields: from/to/subject (event_key=${key})`);
      }

      await sendMail({ from, to, subject, text, html });
      await markOutboxSent(outboxId, null);

      sent += 1;
      outboxLog("info", "sent", { rid, outbox_id: outboxId, event_key: key });
    } catch (e: any) {
      const mark = await markOutboxFailed(outboxId, errString(e));
      if (mark.status === "FAILED_PERMANENT") {
        failedPermanent += 1;
      } else {
        failed += 1;
      }

      outboxLog("error", "send_failed", {
        rid,
        outbox_id: outboxId,
        event_key: key,
        attempts_after: mark.attempts,
        max_attempts: OUTBOX_MAX_ATTEMPTS,
      });
    }
  }

  return {
    ok: true as const,
    processed: rows.length,
    sent,
    failed,
    failedPermanent,
    timedOut,
    resetStale,
    maxAttempts: OUTBOX_MAX_ATTEMPTS,
  };
}

export const processOutbox = processOutboxBatch;

