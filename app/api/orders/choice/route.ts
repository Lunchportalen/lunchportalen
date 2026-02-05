// app/api/orders/choice/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { backupOrderEvent } from "@/lib/orderBackup";

// ✅ Dag-10 standard helpers (Response + no-store + rid via ctx)
import { jsonOk } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import {
  scopeOr401,
  requireRoleOr403,
  requireCompanyScopeOr403,
  readJson,
} from "@/lib/http/routeGuard";

// ✅ Oslo single source of truth
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";
import { requireRule } from "@/lib/agreement/requireRule";

/* =========================================================
   Route-local jsonErr (beholder canAct:false for UI)
   - Ingen NextResponse
   - Bruker noStoreHeaders()
   - Bruker rid fra ctx (samme som scopeOr401)
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

function nowIso() {
  return new Date().toISOString();
}

/* =========================================================
   Validators / helpers
========================================================= */

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
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

// Note-format: "choice:<key>" (kan ligge sammen med andre linjer)
function setChoiceInNote(note: string | null | undefined, choiceKey: string) {
  const lines = String(note ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rest = lines.filter((l) => !l.toLowerCase().startsWith("choice:"));
  return [`choice:${choiceKey}`, ...rest].join("\n");
}

function eventKeyForChoice(input: {
  companyId: string;
  locationId: string;
  userId: string;
  date: string;
  choiceKey: string;
  clientRequestId?: string | null;
}) {
  const cr = safeStr(input.clientRequestId);
  if (cr) return `choice:${input.companyId}:${input.locationId}:${input.userId}:${input.date}:${cr}`;
  return `choice:${input.companyId}:${input.locationId}:${input.userId}:${input.date}:${input.choiceKey}`;
}

/* =========================================================
   Types
========================================================= */

type CompanyRow = {
  id: string;
  status: string | null;
};

type OrderRow = {
  id: string;
  date: string;
  status: string | null;
  note: string | null;
  slot: string | null;
  user_id: string;
  company_id: string | null;
  location_id: string | null;
};

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  // ✅ scope gate – rid må være samme som scopeOr401
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const ctx = a.ctx;
  const { rid, scope } = ctx;
  let admin: any = null;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    admin = supabaseAdmin();
  } catch {
    return jsonErr(ctx.rid, "Mangler service role konfigurasjon for avtalerregler.", 500, "CONFIG_ERROR");
  }

  // ✅ role gate (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "orders.choice", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  // ✅ company scope gate (NY SIGNATUR)
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const userId = String(scope.userId ?? "").trim();
  const userEmail = scope.email ?? null;
  const companyId = String(scope.companyId ?? "").trim();
  const locationId = String(scope.locationId ?? "").trim();

  if (!companyId || !locationId || !userId) {
    return jsonErr(ctx.rid, "Mangler firmatilknytning (company/location).", 403, "missing_scope");
  }

  const sb = await supabaseServer();

  // Body (safe JSON)
  const body = await readJson(req);

  const date = safeText(body?.date);
  const choice_key = safeText(body?.choice_key);
  const client_request_id = safeText(body?.client_request_id);

  if (!date || !isIsoDate(date)) return jsonErr(ctx.rid, "Ugyldig dato.", 400, { code: "bad_date", detail: { date } });
  if (!choice_key) return jsonErr(ctx.rid, "Mangler choice_key.", 400, { code: "bad_choice", detail: { choice_key } });

  // ✅ Cutoff / past-lock (per dato)
  const cutoff = cutoffStatusForDate(date);
  if (cutoff === "PAST") {
    return jsonErr(ctx.rid, "Datoen er passert og kan ikke endres.", 403, { code: "DATE_LOCKED_PAST", detail: { date } });
  }
  if (cutoff === "TODAY_LOCKED") {
    return jsonErr(ctx.rid, "Endringer er låst etter kl. 08:00 i dag.", 409, { code: "LOCKED_AFTER_0800", detail: {
      date,
      cutoff: "08:00",
    } });
  }

  // ✅ Company status gate (ACTIVE-only) – deterministisk via service role
  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(ctx.rid, "Kunne ikke hente firmastatus.", 500, { code: "db_company", detail: { message: cErr.message } });
  if (!company) return jsonErr(ctx.rid, "Firma finnes ikke.", 403, { code: "forbidden", detail: { companyId } });

  const companyStatus = String(company.status ?? "").toLowerCase().trim();
  if (companyStatus && companyStatus !== "active") {
    return jsonErr(ctx.rid, "Firma er ikke aktivt.", 403, { code: "company_blocked", detail: { companyStatus } });
  }

  const dayKey = weekdayKeyOslo(date);
  if (!dayKey) return jsonErr(ctx.rid, "Ugyldig ukedag.", 400, { code: "bad_date", detail: { date } });

  const ruleRes = await requireRule({ sb: admin as any, companyId, dayKey, slot: "lunch", rid });
  if (!ruleRes.ok) {
    const err = ruleRes as { status: number; error: string; message: string };
    return jsonErr(ctx.rid, err.message, err.status ?? 400, err.error);
  }

  // Finn dagens order for bruker+dato
  const { data: order, error: ordErr } = await sb
    .from("orders")
    .select("id,date,status,note,slot,user_id,company_id,location_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("date", date)
    .maybeSingle<OrderRow>();

  if (ordErr) return jsonErr(ctx.rid, "Kunne ikke hente bestilling.", 500, { code: "db_order", detail: { message: ordErr.message } });
  if (!order) return jsonErr(ctx.rid, "Du må bestille lunsj før du kan velge meny.", 409, { code: "no_order", detail: { date } });

  // Belt & suspenders
  if (order.user_id !== userId) {
    return jsonErr(ctx.rid, "Du kan kun endre menyvalg på egen ordre.", 403, { code: "forbidden", detail: { orderUserId: order.user_id } });
  }
  if (String(order.company_id ?? "") !== companyId || String(order.location_id ?? "") !== locationId) {
    return jsonErr(ctx.rid, "Du har ikke tilgang til denne ordren.", 403, { code: "forbidden", detail: {
      orderCompanyId: order.company_id,
      orderLocationId: order.location_id,
      companyId,
      locationId,
    } });
  }

  const status = String(order.status ?? "").toUpperCase();
  if (status !== "ACTIVE") {
    return jsonErr(ctx.rid, "Du må ha aktiv bestilling for å endre menyvalg.", 409, { code: "not_active", detail: { status } });
  }

  const nextNote = setChoiceInNote(order.note, choice_key);

  // ✅ Idempotens: hvis note allerede er lik -> no-op (ingen backup)
  if (String(order.note ?? "") === String(nextNote)) {
    return jsonOk(ctx.rid, {
      changed: false,
      canAct: true,
      order: {
        id: order.id,
        date: order.date,
        status: "ACTIVE",
        note: order.note,
        slot: order.slot ?? null,
        updated_at: null,
        saved_at: null,
      },
    });
  }

  // ✅ Race-safe update: match id + tenant + user + status
  const savedAt = nowIso();
  const { data: updated, error: updErr } = await sb
    .from("orders")
    .update({ note: nextNote, updated_at: savedAt })
    .eq("id", order.id)
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .select("id,date,status,note,slot,updated_at,created_at")
    .maybeSingle<{
      id: string;
      date: string;
      status: string | null;
      note: string | null;
      slot: string | null;
      updated_at: string | null;
      created_at: string | null;
    }>();

  if (updErr) return jsonErr(ctx.rid, "Kunne ikke lagre menyvalg.", 500, { code: "db_update", detail: { message: updErr.message } });
  if (!updated) return jsonErr(ctx.rid, "Kunne ikke lagre menyvalg (ordre endret/ikke aktiv).", 409, "conflict");

  // ✅ E-post-backup (kun etter verifisert lagring) – best effort
  try {
    await backupOrderEvent({
      eventType: "CHOICE_SET",
      rid,
      eventKey: eventKeyForChoice({
        companyId,
        locationId,
        userId,
        date,
        choiceKey: choice_key,
        clientRequestId: client_request_id,
      }),
      userId,
      userEmail,
      companyId,
      locationId,
      date,
      status: "ACTIVE",
      choiceKey: choice_key,
      orderId: updated.id,
      timestampISO: savedAt,
    });
  } catch {
    // ignore
  }

  return jsonOk(ctx.rid, {
    changed: true,
    canAct: true,
    order: {
      id: updated.id,
      date: updated.date,
      status: String(updated.status ?? "").toUpperCase(),
      note: updated.note,
      slot: updated.slot ?? null,
      updated_at: updated.updated_at,
      saved_at: savedAt,
      created_at: updated.created_at,
    },
  });
}
