import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const userId = auth.user.id;

  const { data: rows, error: profErr } = await supabase
    .from("profiles")
    .select("role, company_id, location_id")
    .eq("user_id", userId)
    .limit(1);

  // ✅ Workaround: hvis DB/RLS går i loop (54001), ikke krasj appen
  if (profErr) {
    console.error("[api/me] profiles query error:", profErr);

    const code = (profErr as any)?.code;
    if (code === "54001") {
      return NextResponse.json({
        role: "employee",
        company_id: null,
        location_id: null,
        user_id: userId,
        degraded: true, // nyttig flagg til debugging
      });
    }

    return NextResponse.json(
      { error: profErr.message, code },
      { status: 500 }
    );
  }

  const profile = rows?.[0] ?? null;

  return NextResponse.json({
    role: profile?.role ?? "employee",
    company_id: profile?.company_id ?? null,
    location_id: profile?.location_id ?? null,
    user_id: userId,
  });
}
