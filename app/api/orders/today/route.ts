// app/api/orders/today/route.ts
export const runtime = "nodejs";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { isCutoffPassedNow } from "@/lib/date/cutoff";
import { orderBase, receiptFor } from "@/lib/api/orderResponse";

type Action = "place" | "cancel";

function clampNote(v: unknown) {
  const s = (v ?? "").toString().trim();
  return s.length ? s.slice(0, 300) : null;
}

// ✅ Konsistent logging + kontekst
function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function jsonError(
  status: number,
  rid: string,
  dateISO: string,
  params: {
    locked: boolean;
    cutoffTime?: string;
    menuAvailable?: boolean;
    canAct: boolean;
    error: string;
    message: string;
    detail?: any;
  }
) {
  return NextResponse.json(
    orderBase({
      ok: false,
      rid,
      date: dateISO,
      locked: params.locked,
      cutoffTime: params.cutoffTime ?? "08:00",
      menuAvailable: params.menuAvailable ?? true,
      canAct: params.canAct,
      error: params.error,
      message: params.message,
      receipt: null,
      order: null,
    }),
    { status }
  );
}

export async function POST(req: Request) {
  const rid = `orders_today_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: Action; note?: string | null };
    const action = body.action;

    if (action !== "place" && action !== "cancel") {
      return jsonError(400, rid, osloTodayISODate(), {
        locked: false,
        canAct: false,
        error: "BAD_REQUEST",
        message: "Ugyldig action. Bruk 'place' eller 'cancel'.",
      });
    }

    // Dato-felt i DB heter "date" (type: date)
    const today = osloTodayISODate(); // YYYY-MM-DD
    const cutoffTime = "08:00";

    // 1) Cut-off (server er fasit)
    if (isCutoffPassedNow()) {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: today,
          locked: true,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "LOCKED_AFTER_0800",
          message: "Bestilling/avbestilling er låst etter 08:00.",
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    const supabase = await supabaseServer();

    // 2) Innlogget bruker
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return jsonError(401, rid, today, {
        locked: false,
        cutoffTime,
        canAct: false,
        error: "UNAUTH",
        message: "Ikke innlogget.",
        detail: authErr?.message ?? null,
      });
    }

    const userId = auth.user.id;
    const nowUtc = new Date().toISOString(); // timestamptz-felt i DB

    // 3) Hent profil (company_id/location_id)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr) {
      logApiError("POST /api/orders/today profile failed", pErr, { rid, userId, today });
      return jsonError(500, rid, today, {
        locked: false,
        cutoffTime,
        canAct: false,
        error: "PROFILE_LOOKUP_FAILED",
        message: "Kunne ikke hente profil.",
        detail: pErr.message,
      });
    }

    if (!profile?.company_id || !profile?.location_id) {
      return jsonError(409, rid, today, {
        locked: false,
        cutoffTime,
        canAct: false,
        error: "PROFILE_MISSING_SCOPE",
        message: "Mangler firmatilknytning (profiles.company_id/location_id).",
      });
    }

    // 4) Payload – IMPORTANT:
    // Vi følger prosjektets enum: active/canceled (ikke placed/cancelled).
    const nextStatus = action === "place" ? "active" : "canceled";

    const payload = {
      user_id: userId,
      company_id: profile.company_id,
      location_id: profile.location_id,
      date: today,
      status: nextStatus,
      note: clampNote(body.note),
      updated_at: nowUtc,
    };

    const { data: upserted, error: uErr } = await supabase
      .from("orders")
      .upsert(payload, { onConflict: "user_id,location_id,date" })
      .select("id,status,date,created_at,updated_at,note,company_id,location_id")
      .single();

    if (uErr || !upserted) {
      logApiError("POST /api/orders/today upsert failed", uErr, { rid, userId, today, nextStatus });
      return jsonError(500, rid, today, {
        locked: false,
        cutoffTime,
        canAct: false,
        error: "DB_ERROR",
        message: uErr?.message ?? "Upsert feilet.",
      });
    }

    // 5) Return – samme JSON-kontrakt som resten
    return NextResponse.json(
      orderBase({
        ok: true,
        rid,
        date: upserted.date,
        locked: false,
        cutoffTime,
        menuAvailable: true,
        canAct: true,
        error: null,
        message: upserted.status === "active" ? "Bestilling registrert." : "Avbestilling registrert.",
        receipt: receiptFor(upserted.id, upserted.status, upserted.updated_at ?? upserted.created_at ?? osloNowISO()),
        order: upserted,
      }),
      { status: 200 }
    );
  } catch (e: any) {
    const today = osloTodayISODate();
    logApiError("POST /api/orders/today failed", e, { rid, today });
    return NextResponse.json(
      orderBase({
        ok: false,
        rid,
        date: today,
        locked: false,
        cutoffTime: "08:00",
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: e?.message ?? "Ukjent feil.",
        receipt: null,
        order: null,
      }),
      { status: 500 }
    );
  }
}

/**
 * (Valgfritt, men nyttig)
 * GET gir UI status for i dag uten å endre noe.
 * Returnerer samme orderBase-shape.
 */
export async function GET() {
  const rid = `orders_today_get_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const today = osloTodayISODate();
  const cutoffTime = "08:00";
  const locked = isCutoffPassedNow();

  try {
    const supabase = await supabaseServer();

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: today,
          locked,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "UNAUTH",
          message: "Ikke innlogget.",
          receipt: null,
          order: null,
        }),
        { status: 401 }
      );
    }

    const userId = auth.user.id;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr) {
      logApiError("GET /api/orders/today profile failed", pErr, { rid, userId, today });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: today,
          locked,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "PROFILE_LOOKUP_FAILED",
          message: "Kunne ikke hente profil.",
          receipt: null,
          order: null,
        }),
        { status: 500 }
      );
    }

    if (!profile?.company_id || !profile?.location_id) {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: today,
          locked,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "PROFILE_MISSING_SCOPE",
          message: "Mangler firmatilknytning (profiles.company_id/location_id).",
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id,status,date,created_at,updated_at,note,company_id,location_id")
      .eq("user_id", userId)
      .eq("date", today)
      .eq("company_id", profile.company_id)
      .eq("location_id", profile.location_id)
      .maybeSingle();

    if (oErr) {
      logApiError("GET /api/orders/today order failed", oErr, { rid, userId, today });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: today,
          locked,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "DB_ERROR",
          message: "Kunne ikke hente ordrestatus.",
          receipt: null,
          order: null,
        }),
        { status: 500 }
      );
    }

    const canAct = !locked; // (menyAvailable håndteres annet sted i flow)

    return NextResponse.json(
      orderBase({
        ok: true,
        rid,
        date: today,
        locked,
        cutoffTime,
        menuAvailable: true,
        canAct,
        error: null,
        message: null,
        receipt: order?.id
          ? receiptFor(order.id, String(order.status ?? "unknown"), order.updated_at ?? order.created_at ?? osloNowISO())
          : null,
        order: order ?? null,
      }),
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("GET /api/orders/today failed", e, { rid, today });
    return NextResponse.json(
      orderBase({
        ok: false,
        rid,
        date: today,
        locked,
        cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: e?.message ?? "Ukjent feil.",
        receipt: null,
        order: null,
      }),
      { status: 500 }
    );
  }
}
