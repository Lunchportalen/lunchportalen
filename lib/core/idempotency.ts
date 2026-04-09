/**
 * Idempotens via `public.idempotency` (scope + key) — service-role, egnet for cron/server.
 * Ved feil i `fn` fjernes låserad slik at operasjonen kan prøves på nytt (reversibel nøkkel).
 */
import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const PG_UNIQUE = "23505";

export type EnsureOnceResult = { executed: true } | { executed: false; duplicate: true };

export async function ensureOnce(scope: string, key: string, fn: () => Promise<void>): Promise<EnsureOnceResult> {
  const s = scope.trim().slice(0, 200);
  const k = key.trim().slice(0, 512);
  if (!s || !k) {
    throw new Error("IDEMPOTENCY_INVALID_KEY");
  }
  if (!hasSupabaseAdminConfig()) {
    await fn();
    return { executed: true };
  }

  const admin = supabaseAdmin();
  const { error: insErr } = await admin.from("idempotency").insert({ scope: s, key: k });

  if (insErr?.code === PG_UNIQUE) {
    return { executed: false, duplicate: true };
  }
  if (insErr) {
    throw insErr;
  }

  try {
    await fn();
    return { executed: true };
  } catch (e) {
    await admin.from("idempotency").delete().eq("scope", s).eq("key", k);
    throw e;
  }
}
