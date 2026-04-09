import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type GuardedPublicTable = keyof Database["public"]["Tables"];

/** PostgREST / Postgres signals that a relation is absent or not exposed. */
export function isMissingRelationError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const c = String(err.code ?? "");
  const m = String(err.message ?? "").toLowerCase();
  return (
    c === "PGRST205" ||
    c === "42P01" ||
    m.includes("could not find the table") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}

export type DbGuardLog = {
  scope: "db_guard";
  table: string;
  exists: boolean;
  route: string;
  detail?: string;
};

export function logDbGuard(entry: DbGuardLog, extra?: Record<string, unknown>): void {
  console.error("[db_guard]", JSON.stringify({ ...entry, ...extra }));
}

/**
 * Runtime probe: `id` finnes på tabellen (typisk `social_posts`).
 * Fail-closed: any non-success without a clear "missing relation" is treated as unavailable.
 */
export async function verifyTable(
  client: SupabaseClient<Database>,
  table: GuardedPublicTable,
  route: string,
): Promise<boolean> {
  const { error } = await client.from(table).select("id").limit(1);
  if (!error) return true;
  if (isMissingRelationError(error)) {
    logDbGuard({
      scope: "db_guard",
      table,
      exists: false,
      route,
      detail: error.message,
    });
    return false;
  }
  logDbGuard(
    {
      scope: "db_guard",
      table,
      exists: false,
      route,
      detail: error.message,
    },
    { code: error.code },
  );
  return false;
}
