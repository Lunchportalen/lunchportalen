// lib/orderBackup/outbox.ts
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/orderBackup/smtp";
import type { OrderBackupInput } from "./types";

/**
 * Табell: public.order_email_outbox
 *
 * Minimumskolonner:
 * - id uuid pk default gen_random_uuid()
 * - created_at timestamptz default now()
 * - event_key text unique not null
 * - payload jsonb not null
 * - status text not null default 'PENDING'  (PENDING|SENT|FAILED)
 * - attempts int not null default 0
 * - last_error text null
 * - sent_at timestamptz null
 * - message_id text null (valgfritt)
 */

export type OutboxStatus = "PENDING" | "SENT" | "FAILED";

export type OutboxRow = {
  event_key: string;
  payload: OrderBackupInput;
  status: OutboxStatus;
  attempts: number;
  created_at: string;
  last_error: string | null;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function errString(e: any) {
  try {
    return safeStr(e?.message ?? e) || "unknown_error";
  } catch {
    return "unknown_error";
  }
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/* =========================================================
   Primitives
========================================================= */

/** Idempotent: upsert på event_key */
export async function upsertOutboxEvent(eventKey: string, payload: OrderBackupInput) {
  const admin = supabaseAdmin();
  const key = safeStr(eventKey);
  if (!key) throw new Error("eventKey required");

  const { error } = await admin
    .from("order_email_outbox")
    .upsert(
      {
        event_key: key,
        payload,
        status: "PENDING" as OutboxStatus,
      },
      { onConflict: "event_key" }
    );

  if (error) throw error;
}

/** Markér som SENT (prøver med message_id først, fallback uten hvis kolonnen ikke finnes) */
export async function markOutboxSent(eventKey: string, messageId: string | null) {
  const admin = supabaseAdmin();
  const key = safeStr(eventKey);
  if (!key) throw new Error("eventKey required");

  const patchBase: any = {
    status: "SENT" as OutboxStatus,
    sent_at: nowIso(),
    last_error: null,
  };

  // message_id kan være en kolonne dere har/ikke har
  const r1 = await admin
    .from("order_email_outbox")
    .update({ ...patchBase, message_id: messageId ?? null })
    .eq("event_key", key);

  if (!r1.error) return;

  const r2 = await admin.from("order_email_outbox").update(patchBase).eq("event_key", key);
  if (r2.error) throw r2.error;
}

/** Markér FAILED + attempts++ (best-effort robust) */
export async function markOutboxFailed(eventKey: string, errorMsg: string) {
  const admin = supabaseAdmin();
  const key = safeStr(eventKey);
  if (!key) throw new Error("eventKey required");

  const { data, error: rErr } = await admin
    .from("order_email_outbox")
    .select("attempts")
    .eq("event_key", key)
    .maybeSingle();

  if (rErr) throw rErr;

  const attempts = Number((data as any)?.attempts ?? 0) + 1;

  const { error } = await admin
    .from("order_email_outbox")
    .update({
      status: "FAILED" as OutboxStatus,
      attempts,
      last_error: safeStr(errorMsg) || "unknown_error",
    })
    .eq("event_key", key);

  if (error) throw error;
}

/** Hent neste batch som skal prosesseres (PENDING + FAILED) */
export async function fetchOutboxBatch(limit = 25): Promise<OutboxRow[]> {
  const admin = supabaseAdmin();
  const n = clampInt(limit, 1, 200, 25);

  const { data, error } = await admin
    .from("order_email_outbox")
    .select("event_key,payload,status,attempts,created_at,last_error")
    .in("status", ["PENDING", "FAILED"])
    .order("created_at", { ascending: true })
    .limit(n);

  if (error) throw error;
  return (data ?? []) as OutboxRow[];
}

/* =========================================================
   Worker
========================================================= */

/**
 * Prosesser outbox batch.
 *
 * Forventer at payload inkluderer mailfeltene:
 * - from, to, subject
 * - bodyText (eller text)
 * - bodyHtml (eller html)
 *
 * NB: Dette er bevisst tolerant for nøkkelvarianter.
 */
export async function processOutboxBatch(limit = 25) {
  const rows = await fetchOutboxBatch(limit);

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const key = row.event_key;

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

      await markOutboxSent(key, null);
      sent += 1;
    } catch (e: any) {
      await markOutboxFailed(key, errString(e));
      failed += 1;
    }
  }

  return {
    ok: true as const,
    processed: rows.length,
    sent,
    failed,
  };
}

/** Alias (kompatibilitet hvis noen filer bruker annet navn) */
export const processOutbox = processOutboxBatch;
