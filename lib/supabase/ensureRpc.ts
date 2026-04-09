import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Best-effort PostgREST schema reload so `lp_order_set` and other RPCs resolve on the API.
 * Requires migration `lp_pgrst_reload_schema` (service_role EXECUTE only).
 */
export async function ensureRpcReady(): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await (admin as any).rpc("lp_pgrst_reload_schema");
    if (error && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[ensureRpcReady] lp_pgrst_reload_schema:", error.message);
    }
  } catch {
    /* non-fatal */
  }
}
