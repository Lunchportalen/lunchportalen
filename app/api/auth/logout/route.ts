import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function json(ok: boolean, status: number, payload: Record<string, any>) {
  return NextResponse.json({ ok, ...payload }, { status });
}

export async function POST() {
  const rid = `logout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = await supabaseServer();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return json(false, 400, {
        rid,
        error: "logout_failed",
        message: "Kunne ikke logge ut. Prøv igjen.",
      });
    }

    return json(true, 200, { rid });
  } catch (err: any) {
    console.error("[api/auth/logout]", err?.message || err, { rid, err });
    return json(false, 500, {
      rid,
      error: "server_error",
      message: "Kunne ikke logge ut akkurat nå.",
    });
  }
}
