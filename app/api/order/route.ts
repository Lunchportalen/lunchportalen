import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";

function clampNote(v: unknown) {
  return (v ?? "").toString().trim().slice(0, 300);
}

// ✅ Konsistent logging + kontekst
function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function isDuplicateKeyError(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  // Supabase/Postgres kan variere litt, vi sjekker bredt:
  return msg.includes("duplicate") || msg.includes("unique constraint") || msg.includes("email_outbox_event_key_key");
}

async function queueBackupEmail(params: {
  supabase: any;
  eventKey: string;
  subject: string;
  text: string;
  html?: string | null;
}) {
  const mailFrom = process.env.LP_BACKUP_FROM || "ordre@lunchportalen.no";
  const mailTo = process.env.LP_BACKUP_TO || "ordre@lunchportalen.no";

  const { error } = await params.supabase.from("email_outbox").insert({
    event_key: params.eventKey,
    mail_from: mailFrom,
    mail_to: mailTo,
    subject: params.subject,
    body_text: params.text,
    body_html: params.html ?? null,
  });

  if (error && !isDuplicateKeyError(error)) {
    throw error;
  }
}

export async function POST(req: Request) {
  const rid = `order_post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // ✅ DB: orders.date er type DATE → forventer "YYYY-MM-DD"
    const dateISO = osloTodayISODate();
    const cutoff = cutoffStatusNow();

    if (cutoff.isLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "LOCKED_AFTER_0800",
          rid,
          date: dateISO,
          locked: true,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true, // irrelevant når locked=true
          canAct: false,
        },
        { status: 409 }
      );
    }

    // Meny (logg dersom Sanity/ENV feiler)
    let menu: any = null;
    try {
      menu = await getMenuForDate(dateISO);
    } catch (e: any) {
      logApiError("POST /api/order menu failed", e, { rid, dateISO });
      menu = null;
    }

    const menuAvailable = !!menu?.isPublished;

    if (!menuAvailable) {
      return NextResponse.json(
        {
          ok: false,
          error: "MENU_NOT_PUBLISHED",
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: false,
          canAct: false,
        },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const note = clampNote(body?.note);

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("POST /api/order auth failed", userErr, { rid, dateISO });
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTH",
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
        },
        { status: 401 }
      );
    }

    // ✅ Scope fra profil (company/location)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("POST /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_LOOKUP_FAILED",
          detail: pErr.message,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
        },
        { status: 500 }
      );
    }

    const hasScope = !!(profile?.company_id && profile?.location_id);

    if (!hasScope) {
      logApiError("POST /api/order profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_MISSING_SCOPE",
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
          reason: "PROFILE_MISSING_SCOPE",
          message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
        },
        { status: 409 }
      );
    }

    // ✅ Idempotent UPSERT (MÅ matche unik index: user_id, location_id, date)
    const { data, error } = await supabase
      .from("orders")
      .upsert(
        {
          user_id: userRes.user.id,
          date: dateISO,
          status: "active", // ✅ enum: active/canceled
          note,
          company_id: profile!.company_id,
          location_id: profile!.location_id,
        },
        { onConflict: "user_id,location_id,date" } // ✅ matcher indexen
      )
      .select("id, date, status, note, company_id, location_id, created_at, updated_at")
      .single();

    if (error) {
      logApiError("POST /api/order db upsert failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "DB_ERROR",
          detail: error.message,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable,
          canAct: false,
        },
        { status: 500 }
      );
    }

    // ✅ Outbox: legg e-post-backup i kø (ikke la dette stoppe ordre)
    try {
      await queueBackupEmail({
        supabase,
        eventKey: `order_active_${userRes.user.id}_${profile!.location_id}_${dateISO}`,
        subject: `Lunchportalen – Bestilling registrert (${dateISO})`,
        text:
          `Bestilling registrert\n\n` +
          `Dato: ${dateISO}\n` +
          `User: ${userRes.user.id}\n` +
          `Company: ${profile!.company_id}\n` +
          `Location: ${profile!.location_id}\n` +
          `Status: active\n` +
          (note ? `Notat: ${note}\n` : ""),
      });
    } catch (e: any) {
      logApiError("POST /api/order outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });
      // Fortsett likevel (ordre er viktigst)
    }

    return NextResponse.json({
      ok: true,
      rid,
      date: dateISO,
      locked: false,
      cutoffTime: cutoff.cutoffTime ?? "08:00",
      menuAvailable,
      canAct: true,
      receipt: {
        orderId: data.id,
        status: data.status,
        registeredAt: data.created_at,
        updatedAt: data.updated_at,
      },
      order: data,
    });
  } catch (err: any) {
    logApiError("POST /api/order failed", err, { rid });
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: err?.message || String(err), rid, canAct: false },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const rid = `order_del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const dateISO = osloTodayISODate();
    const cutoff = cutoffStatusNow();

    if (cutoff.isLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "LOCKED_AFTER_0800",
          rid,
          date: dateISO,
          locked: true,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true,
          canAct: false,
        },
        { status: 409 }
      );
    }

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("DELETE /api/order auth failed", userErr, { rid, dateISO });
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTH",
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true,
          canAct: false,
        },
        { status: 401 }
      );
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("DELETE /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_LOOKUP_FAILED",
          detail: pErr.message,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true,
          canAct: false,
        },
        { status: 500 }
      );
    }

    const hasScope = !!(profile?.company_id && profile?.location_id);

    if (!hasScope) {
      logApiError("DELETE /api/order profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "PROFILE_MISSING_SCOPE",
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true,
          canAct: false,
          reason: "PROFILE_MISSING_SCOPE",
          message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
        },
        { status: 409 }
      );
    }

    // ✅ Avbestill = UPDATE status (ikke DELETE)
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "canceled" }) // ✅ enum: canceled (én L)
      .eq("user_id", userRes.user.id)
      .eq("date", dateISO)
      .eq("company_id", profile!.company_id)
      .eq("location_id", profile!.location_id)
      .select("id, date, status, note, company_id, location_id, created_at, updated_at")
      .maybeSingle();

    if (error) {
      logApiError("DELETE /api/order db update failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "DB_ERROR",
          detail: error.message,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: cutoff.cutoffTime ?? "08:00",
          menuAvailable: true,
          canAct: false,
        },
        { status: 500 }
      );
    }

    // ✅ Outbox: legg e-post-backup i kø (ikke la dette stoppe avbestilling)
    try {
      await queueBackupEmail({
        supabase,
        eventKey: `order_canceled_${userRes.user.id}_${profile!.location_id}_${dateISO}`,
        subject: `Lunchportalen – Avbestilling registrert (${dateISO})`,
        text:
          `Avbestilling registrert\n\n` +
          `Dato: ${dateISO}\n` +
          `User: ${userRes.user.id}\n` +
          `Company: ${profile!.company_id}\n` +
          `Location: ${profile!.location_id}\n` +
          `Status: canceled\n`,
      });
    } catch (e: any) {
      logApiError("DELETE /api/order outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });
      // Fortsett likevel
    }

    return NextResponse.json({
      ok: true,
      rid,
      date: dateISO,
      locked: false,
      cutoffTime: cutoff.cutoffTime ?? "08:00",
      menuAvailable: true,
      canAct: true,
      receipt: {
        orderId: data?.id ?? null,
        status: data?.status ?? "canceled",
        registeredAt: data?.created_at ?? null,
        updatedAt: data?.updated_at ?? null,
      },
      order: data ?? null,
    });
  } catch (err: any) {
    logApiError("DELETE /api/order failed", err, { rid });
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: err?.message || String(err), rid, canAct: false },
      { status: 500 }
    );
  }
}
