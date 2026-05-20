/**
 * Supabase clients for remote integration tests only — never import from app code.
 *
 * - serviceRoleClient: Auth Admin API + RPC (not table INSERT on provider tables without GRANT)
 * - authenticatedClient: anon key + JWT → RLS as that user
 * - fixture DML on restricted tables: use fixturePg.ts (postgres connection string)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { readRemoteSupabaseIntegrationEnv } from "./remoteSupabaseIntegration";

const CLIENT_OPTS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/** PostgREST service_role (bypasses RLS; table GRANTs still apply). */
export function serviceRoleClient(): SupabaseClient<Database> {
  const { url, serviceKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, serviceKey, CLIENT_OPTS);
}

/** Anon + bearer — evaluates RLS as auth.uid(). */
export function authenticatedClient(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, anonKey!, {
    ...CLIENT_OPTS,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function anonClient(): SupabaseClient<Database> {
  const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, anonKey!, CLIENT_OPTS);
}
