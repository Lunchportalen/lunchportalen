

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOk } from "@/lib/http/resp";

export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();

  // liten DB ping (velg en stabil tabell)
  const t0 = Date.now();
  const { error } = await sb.from("profiles").select("id").limit(1);
  const dbMs = Date.now() - t0;

  return jsonOk({
    ok: true,
    time: new Date().toISOString(),
    auth: !!auth?.user,
    db: { ok: !error, ms: dbMs },
  });
}



