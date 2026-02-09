export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const body = await req.json();
    const email = String(body?.email ?? "").toLowerCase().trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return jsonErr(rid, "Mangler e-post eller passord.", 400, "MISSING_CREDENTIALS");
    }

    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return jsonErr(rid, "Ugyldig e-post eller passord.", 401, "AUTH_FAILED");
    }

    return jsonOk(rid, { ok: true, rid }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Innlogging feilet.", 500, "SERVER_ERROR");
  }
}
