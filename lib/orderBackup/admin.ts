// lib/orderBackup/admin.ts
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OutboxStatus } from "@/lib/orderBackup/outbox";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export type OutboxListRow = {
  id: string;
  event_key: string;
  status: OutboxStatus;
  attempts: number;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  company_name: string | null;
};

function companyIdFromEventKey(eventKey: string): string | null {
  return eventKey.match(/:([a-f0-9-]{36})$/i)?.[1] ?? null;
}

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
    .from("outbox")
    .select("id,event_key,status,attempts,created_at,sent_at:delivered_at,last_error")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "ALL") query = query.eq("status", status);
  if (q) query = query.ilike("event_key", `%${q}%`);

  const { data, error } = await query;
  if (error) throw new Error(`outbox_list_failed: ${error.message}`);

  const rows = (data ?? []) as Array<Omit<OutboxListRow, "company_name">>;
  const companyIds = Array.from(
    new Set(rows.map((row) => companyIdFromEventKey(row.event_key)).filter((id): id is string => Boolean(id)))
  );

  if (companyIds.length === 0) {
    return rows.map((row) => ({ ...row, company_name: null }));
  }

  const { data: companies, error: companyError } = await admin
    .from("companies")
    .select("id,name")
    .in("id", companyIds);

  if (companyError) throw new Error(`outbox_company_lookup_failed: ${companyError.message}`);

  const companyMap = new Map<string, string | null>(
    ((companies ?? []) as Array<{ id: string | null; name: string | null }>).map((company) => [
      safeStr(company.id),
      safeStr(company.name) || null,
    ])
  );

  return rows.map((row) => ({
    ...row,
    company_name: companyMap.get(companyIdFromEventKey(row.event_key) ?? "") ?? null,
  }));
}

export async function outboxCounts() {
  const admin = supabaseAdmin();

  // PostgREST: bruk separate counts for enkel robusthet
  const statuses: Array<OutboxStatus> = ["PENDING", "PROCESSING", "FAILED", "FAILED_PERMANENT", "SENT"];

  const res: Record<string, number> = { PENDING: 0, PROCESSING: 0, FAILED: 0, FAILED_PERMANENT: 0, SENT: 0 };

  for (const s of statuses) {
    const { count, error } = await admin
      .from("outbox")
      .select("event_key", { count: "exact", head: true })
      .eq("status", s);

    if (error) throw new Error(`outbox_count_failed(${s}): ${error.message}`);
    res[s] = Number(count ?? 0);
  }

  return res as { PENDING: number; PROCESSING: number; FAILED: number; FAILED_PERMANENT: number; SENT: number };
}
