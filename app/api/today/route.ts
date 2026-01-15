import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// ✅ Liten helper: gjør all logging konsekvent og lett å finne i terminalen
function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const rid = `today_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const dateISO = osloTodayISODate();
    const cutoff = cutoffStatusNow();

    // Meny (kan feile hvis Sanity/ENV mangler -> vi håndterer dette)
    let menu: any = null;
    try {
      menu = await getMenuForDate(dateISO);
    } catch (e: any) {
      logApiError("GET /api/today menu failed", e, { rid, dateISO });
      menu = null;
    }

    const menuAvailable = !!menu?.isPublished;

    const supabase = await supabaseServer();

    // Auth
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("GET /api/today auth failed", userErr, { rid, dateISO });

      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTH",
          rid,
          date: dateISO,
          locked: cutoff.isLocked,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
          order: null,
        },
        { status: 401 }
      );
    }

    // ✅ Profile scope (company/location) – hent med service role for å unngå RLS-rekursjon
    const admin = supabaseAdmin();
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("GET /api/today profile failed", pErr, {
        rid,
        userId: userRes.user.id,
        dateISO,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_LOOKUP_FAILED",
          detail: pErr.message,
          rid,
          date: dateISO,
          locked: cutoff.isLocked,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
          order: null,
        },
        { status: 500 }
      );
    }

    const hasScope = !!(profile?.company_id && profile?.location_id);

    // ✅ Hvis brukeren mangler profil-scope -> ok:true, men handling er deaktivert
    if (!hasScope) {
      logApiError("GET /api/today profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      const locked = cutoff.isLocked;

      return NextResponse.json(
        {
          ok: true,
          rid,
          date: dateISO,
          locked,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
          order: null,
          reason: "PROFILE_MISSING_SCOPE",
          message:
            "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
        },
        { status: 200 }
      );
    }

    // Fetch order for i dag (scoped) – kan kjøres med vanlig supabaseServer (RLS på orders)
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, user_id, company_id, location_id, date, status, note, created_at, updated_at")
      .eq("user_id", userRes.user.id)
      .eq("company_id", profile!.company_id)
      .eq("location_id", profile!.location_id)
      .eq("date", dateISO)
      .maybeSingle();

    if (oErr) {
      logApiError("GET /api/today order failed", oErr, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "ORDER_FETCH_FAILED",
          detail: oErr.message,
          rid,
          date: dateISO,
          locked: cutoff.isLocked,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
          order: null,
        },
        { status: 500 }
      );
    }

    // ✅ Samlet “kan handle”-flag basert på alle regler
    const canAct = !cutoff.isLocked && menuAvailable && hasScope;

    return NextResponse.json(
      {
        ok: true,
        rid,
        date: dateISO,
        locked: cutoff.isLocked,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
        canAct,
        order: order ?? null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    logApiError("GET /api/today failed", err, { rid });
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: err?.message || String(err), rid, canAct: false },
      { status: 500 }
    );
  }
}
