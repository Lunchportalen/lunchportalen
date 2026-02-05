// tests/_helpers/waitForAuditRid.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Robust audit-waiter for integrasjonstester.
 * - Returnerer true hvis rid finnes i en kjent audit-tabell
 * - Returnerer false ved timeout / tabell finnes ikke / RLS
 * - KASTER ALDRI (for å unngå “kuking” i test-run)
 */

const DEFAULT_TABLES = ["audit_events", "audit_log", "audit", "audit_trail"];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function existsInTable(admin: SupabaseClient, table: string, rid: string) {
  try {
    const { data, error } = await admin.from(table).select("rid").eq("rid", rid).limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function waitForAuditRid(
  admin: SupabaseClient,
  rid: string,
  opts?: { timeoutMs?: number; intervalMs?: number; tables?: string[] }
) {
  const timeoutMs = opts?.timeoutMs ?? 3000;
  const intervalMs = opts?.intervalMs ?? 150;
  const tables = opts?.tables ?? DEFAULT_TABLES;

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const t of tables) {
      const ok = await existsInTable(admin, t, rid);
      if (ok) return true;
    }
    await sleep(intervalMs);
  }

  return false;
}
