import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

function autonomyLogFrom(sb: ReturnType<typeof supabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table missing from generated types until db:types
  return (sb as any).from("ai_autonomy_log");
}

export type AutonomyLogInsert = {
  rid: string;
  entry_type: string;
  actor_user_id?: string | null;
  company_id?: string | null;
  payload: Record<string, unknown>;
};

export async function insertAutonomyLog(row: AutonomyLogInsert): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAdmin();
  const { error } = await autonomyLogFrom(sb).insert({
    rid: row.rid,
    entry_type: row.entry_type,
    actor_user_id: row.actor_user_id ?? null,
    company_id: row.company_id ?? null,
    payload: row.payload,
  } as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getLastAutonomyCycleTime(): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data, error } = await autonomyLogFrom(sb)
    .select("created_at")
    .eq("entry_type", "autonomy_cycle_summary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof (data as { created_at?: string }).created_at !== "string") return null;
  return (data as { created_at: string }).created_at;
}

export async function fetchRecentAutonomyLogs(limit: number): Promise<
  Array<{ id: string; created_at: string; entry_type: string; rid: string; payload: Record<string, unknown> }>
> {
  const sb = supabaseAdmin();
  const { data, error } = await autonomyLogFrom(sb)
    .select("id, created_at, entry_type, rid, payload")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error || !Array.isArray(data)) return [];
  return data as Array<{
    id: string;
    created_at: string;
    entry_type: string;
    rid: string;
    payload: Record<string, unknown>;
  }>;
}
