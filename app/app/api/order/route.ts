import { NextResponse } from "next/server";
import { osloTodayISO } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";

function clampNote(v: unknown) {
  return (v ?? "").toString().trim().slice(0, 300);
}

export async function POST(req: Request) {
  const dateISO = osloTodayISO();
  const cutoff = cutoffStatusNow();

  if (cutoff.isLocked) {
    return NextResponse.json(
      { ok: false, error: "LOCKED_AFTER_0800", date: dateISO },
      { status: 409 }
    );
  }

  const menu = await getMenuForDate(dateISO);
  if (!menu?.isPublished) {
    return NextResponse.json(
      { ok: false, error: "MENU_NOT_PUBLISHED", date: dateISO },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const note = clampNote(body?.note);

  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  // ✅ Hent scope fra profil (company/location)
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("company_id,location_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOOKUP_FAILED", detail: pErr.message },
      { status: 500 }
    );
  }

  if (!profile?.company_id || !profile?.location_id) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_MISSING", hint: "Mangler firmatilknytning/leveringssted." },
      { status: 409 }
    );
  }

  // ✅ Idempotent UPSERT (krever unique index på user_id+date)
  const { data, error } = await supabase
    .from("orders")
    .upsert(
      {
        user_id: userRes.user.id,
        date: dateISO,
        status: "active",
        note,
        company_id: profile.company_id,
        location_id: profile.location_id,
      },
      { onConflict: "user_id,date" }
    )
    .select("id,date,status,note,company_id,location_id,updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    date: dateISO,
    receipt: {
      orderId: data.id,
      status: data.status,
      timestamp: data.updated_at,
    },
    order: data,
  });
}

export async function DELETE() {
  const dateISO = osloTodayISO();
  const cutoff = cutoffStatusNow();

  if (cutoff.isLocked) {
    return NextResponse.json(
      { ok: false, error: "LOCKED_AFTER_0800", date: dateISO },
      { status: 409 }
    );
  }

  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  // ✅ Scope fra profil (for å sikre at vi avbestiller riktig “tilknytning”)
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("company_id,location_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (pErr) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_LOOKUP_FAILED", detail: pErr.message },
      { status: 500 }
    );
  }

  if (!profile?.company_id || !profile?.location_id) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_MISSING", hint: "Mangler firmatilknytning/leveringssted." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "canceled" })
    .eq("user_id", userRes.user.id)
    .eq("date", dateISO)
    .eq("company_id", profile.company_id)
    .eq("location_id", profile.location_id)
    .select("id,date,status,note,company_id,location_id,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    date: dateISO,
    receipt: {
      orderId: data?.id ?? null,
      status: data?.status ?? "canceled",
      timestamp: data?.updated_at ?? null,
    },
    order: data ?? null,
  });
}
