import "server-only";

import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { ensureRpcReady } from "@/lib/supabase/ensureRpc";

/** Run once per Node process (via instrumentation) — reload PostgREST schema cache best-effort. */
export async function initSupabaseServerHooks(): Promise<void> {
  if (!getCmsRuntimeStatus().requiresRemoteBackend) return;
  await ensureRpcReady();
}
