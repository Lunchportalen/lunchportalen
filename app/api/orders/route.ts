// app/api/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { assertBeforeCutoff0800 } from "@/lib/guards/cutoff";
import { orderBase, receiptFor } from "@/lib/api/orderResponse";

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

function locked409(rid: string, dateISO: string, cutoffTime?: string, menuAvailable?: boolean) {
  return NextResponse.json(
    orderBase({
      ok: false,
      rid,
      date: dateISO,
      locked: true,
      cutoffTime: cutoffTime ?? "08:00",
      menuAvailable: menuAvailable ?? true,
      canAct: false,
      error: "LOCKED_AFTER_0800",
      message: `Handling er stengt etter kl. ${cutoffTime ?? "08:00"} (Oslo-tid).`,
      receipt: null,
      order: null,
    }),
    { status: 409 }
  );
}

export async function POST(req: Request) {
  const rid = `order_post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Stabil basisinfo (brukes også i catch)
  const dateISO = osloTodayISODate();
  const cutoff = cutoffStatusNow();
  const cutoffTime = cutoff.cutoffTime ?? "08:00";

  try {
    // ✅ Hard cutoff på server (aldri UI) – to lag:
    // 1) eksisterende cutoff-status (gir rik respons)
    // 2) guard (gir standardisert CUTOFF i catch)
    if (cutoff.isLocked) {
      return locked409(rid, dateISO, cutoffTime, true);
    }
    assertBeforeCutoff0800("Bestilling");

    // Meny (logg dersom Sanity/ENV feiler)
    let menu: any = null;
    try {
      menu = await getMenuForDate(dateISO);
    } catch (e: any) {
      logApiError("POST /api/orders menu failed", e, { rid, dateISO });
      menu = null;
    }

    const menuAvailable = !!menu?.isPublished;

    if (!menuAvailable) {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable: false,
          canAct: false,
          error: "MENU_NOT_PUBLISHED",
          message: "Meny er ikke publisert ennå.",
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const note = clampNote(body?.note);

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("POST /api/orders auth failed", userErr, { rid, dateISO });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable,
          canAct: false,
          error: "UNAUTH",
          message: "Ikke innlogget.",
          receipt: null,
          order: null,
        }),
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
      logApiError("POST /api/orders profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable,
          canAct: false,
          error: "PROFILE_LOOKUP_FAILED",
          message: "Kunne ikke hente profil.",
          receipt: null,
          order: null,
        }),
        { status: 500 }
      );
    }

    const hasScope = !!(profile?.company_id && profile?.location_id);

    if (!hasScope) {
      logApiError("POST /api/orders profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable,
          canAct: false,
          error: "PROFILE_MISSING_SCOPE",
          message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    // ✅ Idempotent UPSERT (MÅ matche unik index: user_id, location_id, date)
    // ✅ NB: orders-schemaet har også slot. Hvis dere har default-slot i DB (anbefalt), er dette ok.
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
      .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
      .single();

    if (error) {
      logApiError("POST /api/orders db upsert failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });

      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable,
          canAct: false,
          error: "DB_ERROR",
          message: error.message,
          receipt: null,
          order: null,
        }),
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
          (data?.slot ? `Slot: ${data.slot}\n` : "") +
          `Status: active\n` +
          (note ? `Notat: ${note}\n` : ""),
      });
    } catch (e: any) {
      logApiError("POST /api/orders outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });
      // Fortsett likevel (ordre er viktigst)
    }

    return NextResponse.json(
      orderBase({
        ok: true,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: true,
        error: null,
        message: null,
        receipt: receiptFor(data.id, data.status, data.updated_at ?? data.created_at),
        order: data,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    // ✅ LÅST: korrekt JSON for cutoff (409) – samme shape
    if (err?.code === "CUTOFF") {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: true,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "cutoff",
          message: err.message,
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    logApiError("POST /api/orders failed", err, { rid });
    return NextResponse.json(
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: err?.message || String(err),
        receipt: null,
        order: null,
      }),
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const rid = `order_del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const dateISO = osloTodayISODate();
  const cutoff = cutoffStatusNow();
  const cutoffTime = cutoff.cutoffTime ?? "08:00";

  try {
    // ✅ Hard cutoff på server (aldri UI) – to lag:
    if (cutoff.isLocked) {
      return locked409(rid, dateISO, cutoffTime, true);
    }
    assertBeforeCutoff0800("Avbestilling");

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("DELETE /api/orders auth failed", userErr, { rid, dateISO });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
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

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("DELETE /api/orders profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
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

    const hasScope = !!(profile?.company_id && profile?.location_id);

    if (!hasScope) {
      logApiError("DELETE /api/orders profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "PROFILE_MISSING_SCOPE",
          message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    // ✅ Avbestill = UPDATE status (ikke DELETE)
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "canceled" }) // ✅ enum: canceled (én L) — OBS: schemaet deres sier "canceled"
      .eq("user_id", userRes.user.id)
      .eq("date", dateISO)
      .eq("company_id", profile!.company_id)
      .eq("location_id", profile!.location_id)
      .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
      .maybeSingle();

    if (error) {
      logApiError("DELETE /api/orders db update failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });

      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "DB_ERROR",
          message: error.message,
          receipt: null,
          order: null,
        }),
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
          (data?.slot ? `Slot: ${data.slot}\n` : "") +
          `Status: canceled\n`,
      });
    } catch (e: any) {
      logApiError("DELETE /api/orders outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id: profile!.company_id,
        location_id: profile!.location_id,
      });
      // Fortsett likevel
    }

    return NextResponse.json(
      orderBase({
        ok: true,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable: true,
        canAct: true,
        receipt: receiptFor(data?.id ?? null, data?.status ?? "canceled", data?.updated_at ?? data?.created_at),
        order: data ?? null,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    // ✅ LÅST: korrekt JSON for cutoff (409) – samme shape
    if (err?.code === "CUTOFF") {
      return NextResponse.json(
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: true,
          cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "cutoff",
          message: err.message,
          receipt: null,
          order: null,
        }),
        { status: 409 }
      );
    }

    logApiError("DELETE /api/orders failed", err, { rid });
    return NextResponse.json(
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SERVER_ERROR",
        message: err?.message || String(err),
        receipt: null,
        order: null,
      }),
      { status: 500 }
    );
  }
}
