import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  // ✅ VIKTIG: await fordi supabaseServer er async
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const location_id = url.searchParams.get("location_id");

  if (!date || !location_id) {
    return NextResponse.json({ ok: false, error: "MISSING_PARAMS" }, { status: 400 });
  }

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, user_id, company_id, location_id, date, status, note, created_at, updated_at")
    .eq("user_id", auth.user.id)
    .eq("location_id", location_id)
    .eq("date", date)
    .maybeSingle();

  if (oErr) {
    return NextResponse.json(
      { ok: false, error: "ORDER_FETCH_FAILED", detail: oErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, order: order ?? null });
}
