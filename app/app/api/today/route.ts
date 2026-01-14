import { NextResponse } from "next/server";
import { osloTodayISO } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const dateISO = osloTodayISO();
  const cutoff = cutoffStatusNow();

  const supabase = await supabaseServer(); // ✅ VIKTIG
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const menu = await getMenuForDate(dateISO);
  const menuAvailable = Boolean(menu?.isPublished);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id,date,status,note,updated_at")
    .eq("user_id", userRes.user.id)
    .eq("date", dateISO)
    .maybeSingle();

  if (orderErr) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: orderErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    date: dateISO,
    locked: cutoff.isLocked,
    cutoffTime: cutoff.cutoffTime,
    menuAvailable,
    menu: menuAvailable ? menu : null,
    order: order ?? null,
  });
}
