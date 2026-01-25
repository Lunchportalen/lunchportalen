// app/api/auth/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

export async function GET() {
  const rid = `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // ✅ Viktig i ditt prosjekt: supabaseServer() er async
    const sb = await supabaseServer();

    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr) {
      return json(401, { ok: false, rid, error: "not_authenticated", message: "Not authenticated." });
    }

    const user = auth?.user ?? null;
    if (!user?.id) {
      return json(401, { ok: false, rid, error: "not_authenticated", message: "Not authenticated." });
    }

    // ✅ Service-side check med cookie-auth (RLS gjelder)
    const p = await sb
      .from("profiles")
      .select("id, role, company_id, location_id, is_active, disabled_at, disabled_reason")
      .eq("id", user.id)
      .maybeSingle();

    // Ved RLS/kolonnefeil: ikke leak, men returner profileExists=false
    if (p.error) {
      return json(200, {
        ok: true,
        rid,
        profileExists: false,
        userId: user.id,
        note: "profile_query_error",
      });
    }

    if (!p.data?.id) {
      return json(200, { ok: true, rid, profileExists: false, userId: user.id });
    }

    return json(200, { ok: true, rid, profileExists: true, userId: user.id, profile: p.data });
  } catch (e: any) {
    return json(500, {
      ok: false,
      rid,
      error: "server_error",
      message: "Unexpected error.",
      detail: String(e?.message ?? e),
    });
  }
}
