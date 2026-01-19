// app/api/kitchen/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  // Krever innlogging (cookies)
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("get_kitchen_orders", {
    p_from: today,
    p_to: today,
    p_location_id: null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, detail: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: today, rows: data });
}
