// app/api/debug/whoami/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET() {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return jsonErr(rid, "Auth session missing!", 401, { code: "AUTH_REQUIRED", detail: { user: null } });

  return jsonOk(rid, {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role ?? null,
    },
  }, 200);
}


