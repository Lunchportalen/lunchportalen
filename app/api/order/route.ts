// app/api/order/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/date/cutoff";

// ✅ Dag-10 helpers (Response + rid + no-store via respond)
import { jsonOk } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
   - Ingen NextResponse
========================================================= */
function jsonErr(rid: string, status: number, error: string, message: string, detail?: any) {
  const body = { ok: false, rid, error, message, canAct: false, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function clampNote(v: unknown) {
  return String(v ?? "").trim().slice(0, 300);
}

function ridNow(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
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

  if (error && !isDuplicateKeyError(error)) throw error;
}

/* =========================================================
   POST: Create/activate today's order (idempotent upsert)
========================================================= */
export async function POST(req: NextRequest) {
  
  const { getMenuForDate } = await import("@/lib/sanity/queries");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = ridNow("order_post");

  try {
    // ✅ DB: orders.date er type DATE → forventer "YYYY-MM-DD"
    const dateISO = osloTodayISODate();
    const cutoff = cutoffStatusNow();

    if (cutoff.isLocked) {
      return jsonErr(rid, 409, "LOCKED_AFTER_0800", "Endringer er låst etter kl. 08:00 i dag.", {
        date: dateISO,
        locked: true,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      });
    }

    // Meny (best effort)
    let menu: any = null;
    try {
      menu = await getMenuForDate(dateISO);
    } catch (e: any) {
      logApiError("POST /api/order menu failed", e, { rid, dateISO });
      menu = null;
    }

    const menuAvailable = !!menu?.isPublished;
    if (!menuAvailable) {
      return jsonErr(rid, 409, "MENU_NOT_PUBLISHED", "Meny er ikke publisert.", {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: false,
      });
    }

    // Body (safe)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const note = clampNote(body?.note);

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("POST /api/order auth failed", userErr, { rid, dateISO });
      return jsonErr(rid, 401, "UNAUTH", "Du må være innlogget.", {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      });
    }

    // ✅ Scope fra profil (company/location)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("POST /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return jsonErr(rid, 500, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.", {
        detail: pErr.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      });
    }

    const company_id = safeStr(profile?.company_id);
    const location_id = safeStr(profile?.location_id);

    if (!company_id || !location_id) {
      logApiError("POST /api/order profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return jsonErr(rid, 409, "PROFILE_MISSING_SCOPE", "Kontoen mangler firmatilknytning/leveringssted.", {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
        reason: "PROFILE_MISSING_SCOPE",
        message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
      });
    }

    // ✅ Idempotent UPSERT (MÅ matche unik index: user_id, location_id, date)
    const { data, error } = await supabase
      .from("orders")
      .upsert(
        {
          user_id: userRes.user.id,
          date: dateISO,
          status: "active", // legacy i denne route (orders/* bruker ACTIVE). Beholdt for kompat.
          note,
          company_id,
          location_id,
        },
        { onConflict: "user_id,location_id,date" }
      )
      .select("id, date, status, note, company_id, location_id, created_at, updated_at")
      .single();

    if (error) {
      logApiError("POST /api/order db upsert failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id,
        location_id,
      });

      return jsonErr(rid, 500, "DB_ERROR", "Kunne ikke lagre bestilling.", {
        detail: error.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      });
    }

    // ✅ Outbox: legg e-post-backup i kø (best effort)
    try {
      await queueBackupEmail({
        supabase,
        eventKey: `order_active_${userRes.user.id}_${location_id}_${dateISO}`,
        subject: `Lunchportalen – Bestilling registrert (${dateISO})`,
        text:
          `Bestilling registrert\n\n` +
          `Dato: ${dateISO}\n` +
          `User: ${userRes.user.id}\n` +
          `Company: ${company_id}\n` +
          `Location: ${location_id}\n` +
          `Status: active\n` +
          (note ? `Notat: ${note}\n` : ""),
      });
    } catch (e: any) {
      logApiError("POST /api/order outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id,
        location_id,
      });
    }

    return jsonOk({
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
    return jsonErr(rid, 500, "SERVER_ERROR", "Serverfeil.", { detail: err?.message || String(err) });
  }
}

/* =========================================================
   DELETE: Cancel today's order (legacy endpoint)
   - Denne brukes fortsatt av noen klienter.
   - Setter status="canceled" (legacy) for kompat.
========================================================= */
export async function DELETE(_req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = ridNow("order_del");

  try {
    const dateISO = osloTodayISODate();
    const cutoff = cutoffStatusNow();

    if (cutoff.isLocked) {
      return jsonErr(rid, 409, "LOCKED_AFTER_0800", "Endringer er låst etter kl. 08:00 i dag.", {
        date: dateISO,
        locked: true,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      });
    }

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("DELETE /api/order auth failed", userErr, { rid, dateISO });
      return jsonErr(rid, 401, "UNAUTH", "Du må være innlogget.", {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("DELETE /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return jsonErr(rid, 500, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.", {
        detail: pErr.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      });
    }

    const company_id = safeStr(profile?.company_id);
    const location_id = safeStr(profile?.location_id);

    if (!company_id || !location_id) {
      logApiError("DELETE /api/order profile missing scope", "PROFILE_MISSING_SCOPE", {
        rid,
        userId: userRes.user.id,
        dateISO,
        profile,
      });

      return jsonErr(rid, 409, "PROFILE_MISSING_SCOPE", "Kontoen mangler firmatilknytning/leveringssted.", {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
        reason: "PROFILE_MISSING_SCOPE",
        message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
      });
    }

    // ✅ Avbestill = UPDATE status (ikke DELETE)
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "canceled" }) // legacy (én L)
      .eq("user_id", userRes.user.id)
      .eq("date", dateISO)
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .select("id, date, status, note, company_id, location_id, created_at, updated_at")
      .maybeSingle();

    if (error) {
      logApiError("DELETE /api/order db update failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id,
        location_id,
      });

      return jsonErr(rid, 500, "DB_ERROR", "Kunne ikke avbestille.", {
        detail: error.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      });
    }

    // ✅ Outbox: legg e-post-backup i kø (best effort)
    try {
      await queueBackupEmail({
        supabase,
        eventKey: `order_canceled_${userRes.user.id}_${location_id}_${dateISO}`,
        subject: `Lunchportalen – Avbestilling registrert (${dateISO})`,
        text:
          `Avbestilling registrert\n\n` +
          `Dato: ${dateISO}\n` +
          `User: ${userRes.user.id}\n` +
          `Company: ${company_id}\n` +
          `Location: ${location_id}\n` +
          `Status: canceled\n`,
      });
    } catch (e: any) {
      logApiError("DELETE /api/order outbox enqueue failed", e, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id,
        location_id,
      });
    }

    return jsonOk({
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
    return jsonErr(rid, 500, "SERVER_ERROR", "Serverfeil.", { detail: err?.message || String(err) });
  }
}


