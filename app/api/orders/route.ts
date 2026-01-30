// app/api/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate, cutoffStatusForDate } from "@/lib/date/oslo";
import { getMenuForDate } from "@/lib/sanity/queries";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orderBase, receiptFor } from "@/lib/api/orderResponse";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

// ✅ MUST audit (lukket sirkel)
import { auditWriteMust } from "@/lib/audit/auditWrite";

/* =========================================================
   Helpers
========================================================= */

function clampNote(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s.slice(0, 300) : "";
}

function nowIso() {
  return new Date().toISOString();
}

function lockForToday(dateISO: string): { locked: boolean; cutoffTime: string; lockCode: string | null } {
  const cutoff = cutoffStatusForDate(dateISO);
  if (cutoff === "TODAY_LOCKED") return { locked: true, cutoffTime: "08:00", lockCode: "LOCKED_AFTER_0800" };
  if (cutoff === "PAST") return { locked: true, cutoffTime: "08:00", lockCode: "DATE_LOCKED_PAST" };
  return { locked: false, cutoffTime: "08:00", lockCode: null };
}

type CompanyLifecycle = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";
function normCompanyStatus(v: any): CompanyLifecycle {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function adminClientOrNull() {
  try {
    return supabaseAdmin();
  } catch {
    return null;
  }
}

function respond(status: number, body: any) {
  return jsonOk(body, status);
}

type AgreementRow = {
  status: any;
  start_date: string | null;
  end_date: string | null;
  cutoff_time: string | null;
  timezone: string | null;
};

async function enforceCompanyAndAgreement(input: {
  rid: string;
  dateISO: string;
  cutoffTime: string;
  menuAvailable: boolean;
  company_id: string;
  location_id: string;
  user_id: string;
  actor_email: string | null;
  actor_role: string | null;
}) {
  const { rid, dateISO, cutoffTime, menuAvailable, company_id, location_id, user_id } = input;

  const admin = adminClientOrNull();
  if (!admin) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "CONFIG_ERROR",
        message: "Mangler service role konfigurasjon for firmastatus/avtale.",
        detail: { missing: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"] },
        receipt: null,
        order: null,
      } as any)
    );
  }

  // 1) Company status
  const cRes = await admin.from("companies").select("id,status").eq("id", company_id).maybeSingle();
  if (cRes.error || !cRes.data) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "COMPANY_LOOKUP_FAILED",
        message: "Kunne ikke verifisere firmastatus.",
        detail: { error: cRes.error?.message ?? null, company_id },
        receipt: null,
        order: null,
      } as any)
    );
  }

  const companyStatus = normCompanyStatus((cRes.data as any).status);
  if (companyStatus !== "ACTIVE") {
    const reason =
      companyStatus === "PAUSED" ? "COMPANY_PAUSED" : companyStatus === "CLOSED" ? "COMPANY_CLOSED" : "COMPANY_NOT_ACTIVE";

    // MUST audit: enforcement block
    try {
      await auditWriteMust({
        rid,
        action: "ENFORCEMENT_BLOCK",
        entity_type: "order",
        entity_id: `${company_id}:${location_id}:${user_id}:${dateISO}`,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: input.actor_email,
        actor_role: input.actor_role,
        summary: reason,
        detail: { route: "/api/orders", date: dateISO, company_status: companyStatus, reason, intent: "ORDER" },
      });
    } catch (e: any) {
      return respond(
        500,
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime,
          menuAvailable,
          canAct: false,
          error: "AUDIT_INSERT_FAILED",
          message: "Kunne ikke logge enforcement-block. Avbryter for å bevare fasit.",
          detail: { audit_error: String(e?.message ?? e ?? "Unknown audit error") },
          receipt: null,
          order: null,
        } as any)
      );
    }

    return respond(
      403,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: reason,
        message: "Firmaet er deaktivert.",
        detail: { company_status: companyStatus },
        receipt: null,
        order: null,
      } as any)
    );
  }

  // 2) Agreement (view/derived)
  const aRes = await admin
    .from("company_current_agreement")
    .select("status,start_date,end_date,cutoff_time,timezone")
    .eq("company_id", company_id)
    .maybeSingle();

  if (aRes.error) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AGREEMENT_LOOKUP_FAILED",
        message: "Kunne ikke verifisere avtale.",
        detail: { error: aRes.error?.message ?? null },
        receipt: null,
        order: null,
      } as any)
    );
  }

  const ag = (aRes.data as AgreementRow | null) ?? null;
  if (!ag) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AGREEMENT_MISSING",
        message: "Ingen aktiv avtale er registrert for firmaet.",
        detail: { company_id },
        receipt: null,
        order: null,
      } as any)
    );
  }

  const agStatus = String(ag.status ?? "").trim().toUpperCase();
  if (agStatus !== "ACTIVE") {
    return respond(
      403,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AGREEMENT_INACTIVE",
        message: "Avtalen er ikke aktiv.",
        detail: { status: ag.status },
        receipt: null,
        order: null,
      } as any)
    );
  }

  // Start/end sanity (ISO compare)
  const start = String(ag.start_date ?? "");
  const end = ag.end_date ? String(ag.end_date) : null;

  if (start && dateISO < start) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AGREEMENT_NOT_STARTED",
        message: "Avtalen har ikke startet ennå.",
        detail: { start_date: start },
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (end && dateISO > end) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AGREEMENT_EXPIRED",
        message: "Avtalen er utløpt.",
        detail: { end_date: end },
        receipt: null,
        order: null,
      } as any)
    );
  }

  return null; // ✅ ok
}

/* =========================================================
   GET: Hent status for dagens ordre (og UI-sannhet)
========================================================= */
export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.read", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const dateISO = osloTodayISODate();
  const lock = lockForToday(dateISO);

  // Meny (best effort)
  let menu: any = null;
  try {
    menu = await getMenuForDate(dateISO);
  } catch {
    menu = null;
  }
  const menuAvailable = !!menu?.isPublished;

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!user_id || !company_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "SCOPE_MISSING",
        message: "Mangler scope (user/company).",
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (!location_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "LOCATION_MISSING",
        message: "Mangler lokasjonstilknytning (location_id).",
        receipt: null,
        order: null,
      } as any)
    );
  }

  // ✅ Enforcement (firma + avtale)
  const enfRes = await enforceCompanyAndAgreement({
    rid,
    dateISO,
    cutoffTime: lock.cutoffTime,
    menuAvailable,
    company_id,
    location_id,
    user_id,
    actor_email: scope.email ?? null,
    actor_role: scope.role ?? null,
  });
  if (enfRes) return enfRes;

  const sb = await supabaseServer();

  const { data: order, error: oErr } = await sb
    .from("orders")
    .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
    .eq("user_id", user_id)
    .eq("date", dateISO)
    .eq("company_id", company_id)
    .eq("location_id", location_id)
    .maybeSingle();

  if (oErr) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: lock.locked,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "DB_ERROR",
        message: "Kunne ikke hente ordrestatus.",
        detail: { error: oErr.message },
        receipt: null,
        order: null,
      } as any)
    );
  }

  const canAct = menuAvailable && !lock.locked;

  return respond(
    200,
    orderBase({
      ok: true,
      rid,
      date: dateISO,
      locked: lock.locked,
      cutoffTime: lock.cutoffTime,
      menuAvailable,
      canAct,
      receipt: order?.id ? receiptFor(order.id, order.status, order.updated_at ?? order.created_at) : null,
      order: order ?? null,
    } as any)
  );
}

/* =========================================================
   POST: Registrer/oppdater bestilling (idempotent)
========================================================= */
export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.place", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const dateISO = osloTodayISODate();
  const lock = lockForToday(dateISO);

  if (lock.locked) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: true,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: lock.lockCode ?? "LOCKED",
        message: `Handling er stengt etter kl. ${lock.cutoffTime} (Oslo-tid).`,
        receipt: null,
        order: null,
      } as any)
    );
  }

  // Meny (best effort)
  let menu: any = null;
  try {
    menu = await getMenuForDate(dateISO);
  } catch {
    menu = null;
  }
  const menuAvailable = !!menu?.isPublished;
  if (!menuAvailable) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: false,
        canAct: false,
        error: "MENU_NOT_PUBLISHED",
        message: "Meny er ikke publisert ennå.",
        receipt: null,
        order: null,
      } as any)
    );
  }

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!user_id || !company_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "SCOPE_MISSING",
        message: "Mangler scope (user/company).",
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (!location_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "LOCATION_MISSING",
        message: "Mangler lokasjonstilknytning (location_id).",
        receipt: null,
        order: null,
      } as any)
    );
  }

  // ✅ Enforcement (firma + avtale)
  const enfRes = await enforceCompanyAndAgreement({
    rid,
    dateISO,
    cutoffTime: lock.cutoffTime,
    menuAvailable,
    company_id,
    location_id,
    user_id,
    actor_email: scope.email ?? null,
    actor_role: scope.role ?? null,
  });
  if (enfRes) return enfRes;

  const body = await readJson(req);
  const note = clampNote((body as any)?.note);

  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("orders")
    .upsert(
      {
        user_id,
        date: dateISO,
        status: "ACTIVE",
        note,
        company_id,
        location_id,
      },
      { onConflict: "user_id,location_id,date" }
    )
    .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
    .single();

  if (error || !data) {
    // MUST audit: db error
    try {
      await auditWriteMust({
        rid,
        action: "ORDER_PLACE_FAILED",
        entity_type: "order",
        entity_id: `${company_id}:${location_id}:${user_id}:${dateISO}`,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        summary: "DB_ERROR",
        detail: { route: "/api/orders", date: dateISO, error: error?.message ?? "unknown" },
      });
    } catch (e: any) {
      return respond(
        500,
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: lock.cutoffTime,
          menuAvailable,
          canAct: false,
          error: "AUDIT_INSERT_FAILED",
          message: "Kunne ikke logge DB-feil. Avbryter for å bevare fasit.",
          detail: { audit_error: String(e?.message ?? e ?? "Unknown audit error") },
          receipt: null,
          order: null,
        } as any)
      );
    }

    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "DB_ERROR",
        message: error?.message ?? "Kunne ikke registrere bestilling.",
        receipt: null,
        order: null,
      } as any)
    );
  }

  // MUST audit: applied
  try {
    await auditWriteMust({
      rid,
      action: "ORDER_PLACE_APPLIED",
      entity_type: "order",
      entity_id: data.id,
      company_id,
      location_id,
      actor_user_id: user_id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: "Placed",
      detail: { route: "/api/orders", date: dateISO, slot: data.slot ?? null },
    });
  } catch (e: any) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable,
        canAct: false,
        error: "AUDIT_INSERT_FAILED",
        message: "Kunne ikke logge bestilling. Avbryter for å bevare fasit.",
        detail: { audit_error: String(e?.message ?? e ?? "Unknown audit error") },
        receipt: null,
        order: null,
      } as any)
    );
  }

  return respond(
    200,
    orderBase({
      ok: true,
      rid,
      date: dateISO,
      locked: false,
      cutoffTime: lock.cutoffTime,
      menuAvailable,
      canAct: true,
      error: null,
      message: null,
      receipt: receiptFor(data.id, data.status, data.updated_at ?? data.created_at),
      order: data,
    } as any)
  );
}

/* =========================================================
   DELETE: Avbestill (status update, ikke fysisk delete)
========================================================= */
export async function DELETE(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.cancel", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const dateISO = osloTodayISODate();
  const lock = lockForToday(dateISO);

  if (lock.locked) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: true,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: lock.lockCode ?? "LOCKED",
        message: `Handling er stengt etter kl. ${lock.cutoffTime} (Oslo-tid).`,
        receipt: null,
        order: null,
      } as any)
    );
  }

  const user_id = String(scope.userId ?? "").trim();
  const company_id = String(scope.companyId ?? "").trim();
  const location_id = String(scope.locationId ?? "").trim();

  if (!user_id || !company_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "SCOPE_MISSING",
        message: "Mangler scope (user/company).",
        receipt: null,
        order: null,
      } as any)
    );
  }
  if (!location_id) {
    return respond(
      409,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "LOCATION_MISSING",
        message: "Mangler lokasjonstilknytning (location_id).",
        receipt: null,
        order: null,
      } as any)
    );
  }

  // ✅ Enforcement (firma + avtale) – menuAvailable irrelevant for cancel, men vi setter true for konsistens
  const enfRes = await enforceCompanyAndAgreement({
    rid,
    dateISO,
    cutoffTime: lock.cutoffTime,
    menuAvailable: true,
    company_id,
    location_id,
    user_id,
    actor_email: scope.email ?? null,
    actor_role: scope.role ?? null,
  });
  if (enfRes) return enfRes;

  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("orders")
    .update({ status: "CANCELLED", updated_at: nowIso() })
    .eq("user_id", user_id)
    .eq("date", dateISO)
    .eq("company_id", company_id)
    .eq("location_id", location_id)
    .select("id, date, status, note, company_id, location_id, created_at, updated_at, slot")
    .maybeSingle();

  if (error) {
    // MUST audit: db error
    try {
      await auditWriteMust({
        rid,
        action: "ORDER_CANCEL_FAILED",
        entity_type: "order",
        entity_id: `${company_id}:${location_id}:${user_id}:${dateISO}`,
        company_id,
        location_id,
        actor_user_id: user_id,
        actor_email: scope.email ?? null,
        actor_role: scope.role ?? null,
        summary: "DB_ERROR",
        detail: { route: "/api/orders", date: dateISO, error: error.message },
      });
    } catch (e: any) {
      return respond(
        500,
        orderBase({
          ok: false,
          rid,
          date: dateISO,
          locked: false,
          cutoffTime: lock.cutoffTime,
          menuAvailable: true,
          canAct: false,
          error: "AUDIT_INSERT_FAILED",
          message: "Kunne ikke logge DB-feil. Avbryter for å bevare fasit.",
          detail: { audit_error: String(e?.message ?? e ?? "Unknown audit error") },
          receipt: null,
          order: null,
        } as any)
      );
    }

    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "DB_ERROR",
        message: error.message,
        receipt: null,
        order: null,
      } as any)
    );
  }

  if (!data?.id) {
    // Idempotent: ingen ordre å avbestille
    return respond(
      404,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: true,
        error: "ORDER_NOT_FOUND",
        message: "Ingen bestilling å avbestille.",
        receipt: null,
        order: null,
      } as any)
    );
  }

  // MUST audit: applied
  try {
    await auditWriteMust({
      rid,
      action: "ORDER_CANCEL_APPLIED",
      entity_type: "order",
      entity_id: data.id,
      company_id,
      location_id,
      actor_user_id: user_id,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: "Cancelled",
      detail: { route: "/api/orders", date: dateISO, slot: data.slot ?? null },
    });
  } catch (e: any) {
    return respond(
      500,
      orderBase({
        ok: false,
        rid,
        date: dateISO,
        locked: false,
        cutoffTime: lock.cutoffTime,
        menuAvailable: true,
        canAct: false,
        error: "AUDIT_INSERT_FAILED",
        message: "Kunne ikke logge avbestilling. Avbryter for å bevare fasit.",
        detail: { audit_error: String(e?.message ?? e ?? "Unknown audit error") },
        receipt: null,
        order: null,
      } as any)
    );
  }

  return respond(
    200,
    orderBase({
      ok: true,
      rid,
      date: dateISO,
      locked: false,
      cutoffTime: lock.cutoffTime,
      menuAvailable: true,
      canAct: true,
      receipt: receiptFor(data.id, data.status, data.updated_at ?? data.created_at),
      order: data,
    } as any)
  );
}
