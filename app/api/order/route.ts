// app/api/order/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloNowISO, osloTodayISODate } from "@/lib/date/oslo";
import { cutoffStatusNow } from "@/lib/cutoff";
import { SYSTEM_EMAILS } from "@/lib/system/emails";
import { requireRule } from "@/lib/agreement/requireRule";
import { sendOrderBackup } from "@/lib/orders/orderBackup";
import { fetchCompanyLocationNames } from "@/lib/orders/backupContext";

// ✅ Dag-10 helpers (Response + rid + no-store via respond)
import { jsonOk } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
   - Ingen NextResponse
========================================================= */
function jsonErr(rid: string, message: string, status = 400, error?: unknown) {
  let errorVal: unknown = "ERROR";
  let detail: unknown = undefined;

  if (error !== undefined) {
    if (typeof error === "object" && error && "code" in (error as any)) {
      const code = (error as any).code;
      errorVal = typeof code === "string" ? code : "ERROR";
      if ("detail" in (error as any)) detail = (error as any).detail;
    } else if (typeof error === "string") {
      errorVal = error;
    } else if (error instanceof Error) {
      errorVal = error.message || "ERROR";
    } else {
      errorVal = error;
    }
  }

  const body: any = { ok: false, rid, error: errorVal, message, status, canAct: false };
  if (detail !== undefined) body.detail = detail;
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

function weekdayKeyOslo(isoDate: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
    };
    return map[wd] ?? null;
  } catch {
    return null;
  }
}

function isMissingColumnError(err: any, column: string) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes(column.toLowerCase()) && (msg.includes("does not exist") || msg.includes("not exist"));
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
  const mailFrom = process.env.LP_BACKUP_FROM || SYSTEM_EMAILS.ORDER;
  const mailTo = process.env.LP_BACKUP_TO || SYSTEM_EMAILS.ORDER;

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
      return jsonErr(rid, "Endringer er låst etter kl. 08:00 i dag.", 409, { code: "LOCKED_AFTER_0800", detail: {
        date: dateISO,
        locked: true,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      } });
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
      return jsonErr(rid, "Meny er ikke publisert.", 409, { code: "MENU_NOT_PUBLISHED", detail: {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: false,
      } });
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
      return jsonErr(rid, "Du må være innlogget.", 401, { code: "UNAUTH", detail: {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      } });
    }

    // ✅ Scope fra profil (company/location)
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("POST /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "PROFILE_LOOKUP_FAILED", detail: {
        detail: pErr.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      } });
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

      return jsonErr(rid, "Kontoen mangler firmatilknytning/leveringssted.", 409, { code: "PROFILE_MISSING_SCOPE", detail: {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
        reason: "PROFILE_MISSING_SCOPE",
        message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
      } });
    }

    // ✅ Agreement rules gate (fail-closed)
    let ruleTier: "BASIS" | "LUXUS" | null = null;
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const admin = supabaseAdmin();
      const dayKey = weekdayKeyOslo(dateISO);
      if (!dayKey) {
        return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: dateISO } });
      }
      const ruleRes = await requireRule({ sb: admin as any, companyId: company_id, dayKey, slot: "lunch", rid });
      if (!ruleRes.ok) {
        const err = ruleRes as { status: number; error: string; message: string };
        return jsonErr(rid, err.message, err.status ?? 400, err.error);
      }
      ruleTier = ruleRes.rule.tier;
    } catch (e: any) {
      return jsonErr(rid, "Mangler service role konfigurasjon for avtalerregler.", 500, { code: "CONFIG_ERROR", detail: { error: String(e?.message ?? e) } });
    }

    // ✅ Idempotent UPSERT (MÅ matche unik index: user_id, location_id, date)
    const payload = {
      user_id: userRes.user.id,
      date: dateISO,
      status: "active", // legacy i denne route (orders/* bruker ACTIVE). Beholdt for kompat.
      note,
      company_id,
      location_id,
      slot: "lunch",
      ...(ruleTier ? { tier: ruleTier } : {}),
    };

    let { data, error } = await supabase
      .from("orders")
      .upsert(payload, { onConflict: "user_id,location_id,date" })
      .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
      .single();

    if (error && payload.tier && isMissingColumnError(error, "tier")) {
      const { tier, ...noTier } = payload as any;
      const retry = await supabase
        .from("orders")
        .upsert(noTier, { onConflict: "user_id,location_id,date" })
        .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
        .single();
      data = retry.data as any;
      error = retry.error as any;
    }

    if (error) {
      logApiError("POST /api/order db upsert failed", error, {
        rid,
        userId: userRes.user.id,
        dateISO,
        company_id,
        location_id,
      });

      return jsonErr(rid, "Kunne ikke lagre bestilling.", 500, { code: "DB_ERROR", detail: {
        detail: error.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable,
      } });
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

    const backupTs = osloNowISO();
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const admin = supabaseAdmin();
      const names = await fetchCompanyLocationNames({ admin: admin as any, companyId: company_id, locationId: location_id });
      await sendOrderBackup({
        rid,
        action: "PLACE",
        status: "ACTIVE",
        orderId: data.id,
        date: dateISO,
        slot: "lunch",
        user_id: userRes.user.id,
        company_id,
        location_id,
        company_name: names.company_name ?? null,
        location_name: names.location_name ?? null,
        actor_email: userRes.user.email ?? null,
        actor_role: null,
        note: data.note ?? null,
        timestamp_oslo: backupTs,
        extra: { route: "/api/order" },
      });
    } catch {
      // best effort
    }

    return jsonOk(rid, {
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
    return jsonErr(rid, "Serverfeil.", 500, { code: "SERVER_ERROR", detail: { detail: err?.message || String(err) } });
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
      return jsonErr(rid, "Endringer er låst etter kl. 08:00 i dag.", 409, { code: "LOCKED_AFTER_0800", detail: {
        date: dateISO,
        locked: true,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      } });
    }

    const supabase = await supabaseServer();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      logApiError("DELETE /api/order auth failed", userErr, { rid, dateISO });
      return jsonErr(rid, "Du må være innlogget.", 401, { code: "UNAUTH", detail: {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      } });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id, location_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (pErr) {
      logApiError("DELETE /api/order profile failed", pErr, { rid, userId: userRes.user.id, dateISO });
      return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "PROFILE_LOOKUP_FAILED", detail: {
        detail: pErr.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      } });
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

      return jsonErr(rid, "Kontoen mangler firmatilknytning/leveringssted.", 409, { code: "PROFILE_MISSING_SCOPE", detail: {
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
        reason: "PROFILE_MISSING_SCOPE",
        message: "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.",
      } });
    }

    // ✅ Agreement rules gate (fail-closed)
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const admin = supabaseAdmin();
      const dayKey = weekdayKeyOslo(dateISO);
      if (!dayKey) {
        return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: dateISO } });
      }
      const ruleRes = await requireRule({ sb: admin as any, companyId: company_id, dayKey, slot: "lunch", rid });
      if (!ruleRes.ok) {
        const err = ruleRes as { status: number; error: string; message: string };
        return jsonErr(rid, err.message, err.status ?? 400, err.error);
      }
    } catch (e: any) {
      return jsonErr(rid, "Mangler service role konfigurasjon for avtalerregler.", 500, { code: "CONFIG_ERROR", detail: { error: String(e?.message ?? e) } });
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

      return jsonErr(rid, "Kunne ikke avbestille.", 500, { code: "DB_ERROR", detail: {
        detail: error.message,
        date: dateISO,
        locked: false,
        cutoffTime: cutoff.cutoffTime ?? "08:00",
        menuAvailable: true,
      } });
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

    const backupTs = osloNowISO();
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const admin = supabaseAdmin();
      const names = await fetchCompanyLocationNames({ admin: admin as any, companyId: company_id, locationId: location_id });
      await sendOrderBackup({
        rid,
        action: "CANCEL",
        status: "CANCELLED",
        orderId: data?.id ?? null,
        date: dateISO,
        slot: "lunch",
        user_id: userRes.user.id,
        company_id,
        location_id,
        company_name: names.company_name ?? null,
        location_name: names.location_name ?? null,
        actor_email: userRes.user.email ?? null,
        actor_role: null,
        note: data?.note ?? null,
        timestamp_oslo: backupTs,
        extra: { route: "/api/order" },
      });
    } catch {
      // best effort
    }

    return jsonOk(rid, {
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
    return jsonErr(rid, "Serverfeil.", 500, { code: "SERVER_ERROR", detail: { detail: err?.message || String(err) } });
  }
}
