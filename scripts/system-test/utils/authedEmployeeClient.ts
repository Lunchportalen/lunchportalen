/**
 * Browserless sign-in for system tests — same Supabase project as service role.
 * lp_order_set uses auth.uid(); PostgREST must receive a real Supabase Auth JWT (not service role).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../lib/types/database";

export type EmployeeTestClient = SupabaseClient<Database>;

/**
 * 1) signInWithPassword on anon client → session.access_token
 * 2) New anon client with Authorization: Bearer <token> (same as tests/_helpers/rlsFixtures `supabaseAs`).
 */
export async function createEmployeeRpcClient(email: string, password: string): Promise<EmployeeTestClient> {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anon) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const pre = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await pre.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error("AUTH_FAILED");
  }

  const token = data.session.access_token;

  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
