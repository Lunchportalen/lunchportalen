// STATUS: KEEP

import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

type Stored = { hit: true } | { hit: false };

export async function getIdempotentResult(key: string, scope: string): Promise<Stored> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("idempotency")
    .select("key")
    .eq("key", key)
    .eq("scope", scope)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { hit: false };
  return { hit: true };
}

export async function putIdempotentResult(opts: {
  key: string;
  scope: string;
}) {
  const sb = await supabaseServer();

  const { error } = await sb.from("idempotency").upsert(
    {
      key: opts.key,
      scope: opts.scope,
    },
    { onConflict: "scope,key" }
  );

  if (error) throw error;
}
