// lib/orderBackup/admin.ts
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OutboxStatus } from "@/lib/orderBackup/outbox";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export type OutboxListRow = {
  event_key: string;
  status: OutboxStatus;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  payload: any; // jsonb
};

export async function listOutbox(input: {
  status?: OutboxStatus | "ALL";
  q?: string; // substring match in event_key
  limit?: number;
}) {
  const admin = supabaseAdmin();
  const status = (input.status ?? "ALL") as OutboxStatus | "ALL";
  const q = safeStr(input.q);
  const limit = Math.max(1, Math.min(200, Number(input.limit ?? 50) || 50));

  let query = admin
    .from("order_email_outbox")
    .select("event_key,status,attempts,created_at,sent_at,last_error,payload")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "ALL") query = query.eq("status", status);
  if (q) query = query.ilike("event_key", `%${q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`outbox_list_failed: ${error.message}`);

  return (data ?? []) as OutboxListRow[];
}

export async function outboxCounts() {
  const admin = supabaseAdmin();

  // PostgREST: bruk separate counts for enkel robusthet
  const statuses: Array<OutboxStatus> = ["PENDING", "FAILED", "SENT"];

  const res: Record<string, number> = { PENDING: 0, FAILED: 0, SENT: 0 };

  for (const s of statuses) {
    const { count, error } = await admin
      .from("order_email_outbox")
      .select("event_key", { count: "exact", head: true })
      .eq("status", s);

    if (error) throw new Error(`outbox_count_failed(${s}): ${error.message}`);
    res[s] = Number(count ?? 0);
  }

  return res as { PENDING: number; FAILED: number; SENT: number };
}
