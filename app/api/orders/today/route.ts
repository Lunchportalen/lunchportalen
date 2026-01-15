// app/api/orders/today/route.ts
export const runtime = "nodejs";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { isCutoffPassedNow } from "@/lib/date/cutoff";

type Action = "place" | "cancel";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: Action; note?: string | null };
    const action = body.action;

    if (action !== "place" && action !== "cancel") {
      return NextResponse.json({ ok: false, error: "Ugyldig action." }, { status: 400 });
    }

    // 1) Cut-off (server er fasit)
    if (isCutoffPassedNow()) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          status: "locked",
          timestamp: osloNowISO(),
          message: "Bestilling/avbestilling er låst etter 08:00.",
        },
        { status: 409 }
      );
    }

    const supabase = await supabaseServer();

    // 2) Innlogget bruker
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Ikke innlogget." }, { status: 401 });
    }

    const userId = auth.user.id;

    // Dato-feltet i DB heter "date" (type: date)
    const today = osloTodayISODate(); // "YYYY-MM-DD"
    const nowUtc = new Date().toISOString(); // timestamptz-felt i DB

    // 3) Hent profil (company_id/location_id)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userId)
      .single();

    if (pErr || !profile?.company_id || !profile?.location_id) {
      return NextResponse.json(
        { ok: false, error: "Mangler firmatilknytning (profiles.company_id/location_id)." },
        { status: 500 }
      );
    }

    const payload = {
      user_id: userId,
      company_id: profile.company_id,
      location_id: profile.location_id,
      date: today, // ✅ riktig kolonne
      status: action === "place" ? "placed" : "cancelled",
      note: body.note ?? null,
      updated_at: nowUtc,
    };

    const { data: upserted, error: uErr } = await supabase
      .from("orders")
      .upsert(payload, { onConflict: "user_id,location_id,date" }) // ✅ riktig conflict key
      .select("id,status,date,updated_at")
      .single();

    if (uErr || !upserted) {
      return NextResponse.json({ ok: false, error: uErr?.message ?? "Upsert feilet." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      locked: false,
      action,
      status: upserted.status,
      orderId: upserted.id,
      date: upserted.date,
      timestamp: osloNowISO(), // vis Oslo-tid i kvittering
      message: upserted.status === "placed" ? "Bestilling registrert." : "Avbestilling registrert.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Ukjent feil." }, { status: 500 });
  }
}
