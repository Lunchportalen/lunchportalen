// app/api/debug/whoami/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function safeObj(err: any) {
  if (!err) return null;
  return {
    name: safeStr(err?.name),
    message: safeStr(err?.message),
    status: (err as any)?.status ?? null,
    code: (err as any)?.code ?? null,
  };
}

export async function GET(_req: NextRequest) {
  const rid = makeRid();
  const env = {
    hasUrl: !!safeStr(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: !!safeStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    urlHost: safeStr(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/^https?:\/\//, "").split("/")[0] || null,
  };

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return jsonErr(rid, "Kunne ikke hente auth-bruker.", 401, {
        code: "AUTH_LOOKUP_FAILED",
        detail: { env, authError: safeObj(authError) },
      });
    }

    const user = authData?.user ?? null;
    if (!user) {
      return jsonErr(rid, "Ikke innlogget.", 401, {
        code: "AUTH_REQUIRED",
        detail: { env, user: null },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, role, company_id, location_id, active")
      .eq("user_id", user.id)
      .maybeSingle();

    return jsonOk(
      rid,
      {
        env,
        auth: { id: user.id, email: user.email ?? null, user_metadata: user.user_metadata ?? null },
        profile: profile ?? null,
        profileError: safeObj(profileError),
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Debug whoami feilet.", 500, {
      code: "DEBUG_WHOAMI_FAILED",
      detail: { env, exception: safeObj(e) },
    });
  }
}
