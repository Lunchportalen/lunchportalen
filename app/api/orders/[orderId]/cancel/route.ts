// app/api/orders/[orderId]/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { requireRule } from "@/lib/agreement/requireRule";

import { osloTodayISODate } from "@/lib/date/oslo";
import { assertBeforeCutoffForDeliveryDate } from "@/lib/cutoff";
import { lpOrderCancel } from "@/lib/orders/rpcWrite";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

// Ã¢Å“â€¦ Konsistent logging + kontekst
function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

/* =========================================================
   Types
========================================================= */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ProfileRow = {
  id: string;
  role: Role | null;
  company_id: string | null;
  disabled_at: string | null;
};

type CompanyRow = {
  id: string;
  status: string | null; // "active" | "paused" | "closed" ...
};

type OrderRow = {
  id: string;
  date: string;
  user_id: string;
  status: string | null; // ACTIVE/CANCELLED (evt legacy)
  company_id: string | null;
  location_id: string | null;
  slot?: string | null;
};

/* =========================================================
   PATCH: /api/orders/[orderId]/cancel
   - Idempotent: hvis allerede kansellert -> ok, changed:false
   - Eierskap: kun egen ordre
   - Firma gate: company mÃƒÂ¥ vÃƒÂ¦re active
   - Cutoff: assertBeforeCutoffForDeliveryDate
========================================================= */

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = makeRid();

  try {
    const orderId = String(params?.orderId ?? "").trim();
    if (!orderId) {
      return jsonErr(r, "Ugyldig orderId.", 400, { code: "bad_request", detail: { orderId } });
    }

    const sb = await supabaseServer();

    // -----------------------------
    // Auth
    // -----------------------------
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) {
      logApiError("PATCH /api/orders/[id]/cancel auth failed", authErr, { rid: r, orderId });
      return jsonErr(r, "Ikke innlogget.", 401, { code: "unauthorized", detail: { authErr: authErr?.message } });
    }

    // -----------------------------
    // Profile + role gate
    // -----------------------------
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id,role,company_id,disabled_at")
      .eq("id", auth.user.id)
      .maybeSingle<ProfileRow>();

    if (pErr) {
      logApiError("PATCH /api/orders/[id]/cancel profile lookup failed", pErr, { rid: r, orderId });
      return jsonErr(r, "Kunne ikke lese profil.", 500, { code: "db_error", detail: { pErr: pErr.message } });
    }
    if (!profile) {
      return jsonErr(r, "Profil finnes ikke.", 403, { code: "forbidden", detail: { userId: auth.user.id } });
    }
    if (profile.disabled_at) {
      return jsonErr(r, "Konto er deaktivert.", 403, { code: "forbidden", detail: { disabled_at: profile.disabled_at } });
    }

    const role = profile.role ?? null;
    if (role !== "employee" && role !== "company_admin") {
      return jsonErr(r, "Ingen tilgang til ÃƒÂ¥ avbestille med denne rollen.", 403, { code: "forbidden", detail: { role } });
    }

    const companyId = String(profile.company_id ?? "").trim();
    if (!companyId) {
      return jsonErr(r, "Mangler company_id pÃƒÂ¥ profil.", 403, { code: "forbidden", detail: { role } });
    }

    // -----------------------------
    // Company status gate (ACTIVE-only)
    // -----------------------------
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id,status")
      .eq("id", companyId)
      .maybeSingle<CompanyRow>();

    if (cErr) {
      logApiError("PATCH /api/orders/[id]/cancel company lookup failed", cErr, { rid: r, companyId });
      return jsonErr(r, "Kunne ikke lese firmastatus.", 500, { code: "db_error", detail: { cErr: cErr.message } });
    }
    if (!company) {
      return jsonErr(r, "Firma finnes ikke (eller ingen tilgang).", 403, { code: "forbidden", detail: { companyId } });
    }

    const companyStatus = String(company.status ?? "").toLowerCase();
    if (companyStatus && companyStatus !== "active") {
      return jsonErr(r, "Firma er ikke aktivt.", 403, { code: "company_blocked", detail: { companyStatus } });
    }

    // -----------------------------
    // Fetch order (for date + ownership + firmabinding)
    // -----------------------------
    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id,date,user_id,status,company_id,location_id,slot")
      .eq("id", orderId)
      .maybeSingle<OrderRow>();

    if (oErr) {
      logApiError("PATCH /api/orders/[id]/cancel order lookup failed", oErr, { rid: r, orderId });
      return jsonErr(r, "Kunne ikke lese ordre.", 500, { code: "db_error", detail: { oErr: oErr.message } });
    }
    if (!order) {
      return jsonErr(r, "Ordre ikke funnet.", 404, { code: "not_found", detail: { orderId } });
    }

    // Ã¢Å“â€¦ Firmasjekk (ordre mÃƒÂ¥ tilhÃƒÂ¸re samme firma som profilen)
    if (String(order.company_id ?? "") !== companyId) {
      return jsonErr(r, "Du har ikke tilgang til denne ordren.", 403, { code: "forbidden", detail: {
        orderCompanyId: order.company_id,
        companyId,
      } });
    }

    // Ã¢Å“â€¦ Eier-sjekk (ansatt/admin kan kun avbestille egen ordre)
    if (order.user_id !== auth.user.id) {
      return jsonErr(r, "Du kan kun avbestille egen ordre.", 403, { code: "forbidden", detail: { orderUserId: order.user_id } });
    }

    const slotVal = String((order as any)?.slot ?? "").trim() || "lunch";
    const dayKey = weekdayKeyOslo(order.date);
    if (!dayKey) {
      return jsonErr(r, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: order.date } });
    }

    let admin: any = null;
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      admin = supabaseAdmin();
    } catch {
      return jsonErr(r, "Mangler service role konfigurasjon for avtalerregler.", 500, "CONFIG_ERROR");
    }
    const ruleRes = await requireRule({ sb: admin as any, companyId, dayKey, slot: slotVal, rid: r });
    if (!ruleRes.ok) {
      const err = ruleRes as { status: number; error: string; message: string };
      return jsonErr(r, err.message, err.status ?? 400, err.error);
    }

    // -----------------------------
    // Idempotens: allerede kansellert
    // (stÃƒÂ¸tter bÃƒÂ¥de ny og legacy status)
    // -----------------------------
    const curr = String(order.status ?? "").toUpperCase();
    const isCancelled = curr === "CANCELLED" || curr === "CANCELED" || curr === "CANCELED" || curr === "CANCELED" || curr === "CANCELED"; // safe
    const isLegacyCancelled = String(order.status ?? "").toLowerCase() === "canceled";

    if (isCancelled || isLegacyCancelled) {
      return jsonOk(r, {
        ok: true,
        rid: r,
        changed: false,
        canAct: true,
        order: { id: order.id, date: order.date, status: "CANCELLED" },
      }, 200);
    }

    // -----------------------------
    // HARD CUTOFF
    // -----------------------------
    assertBeforeCutoffForDeliveryDate("Avbestilling", order.date);

    // -----------------------------
    // Cancel = UPDATE status (ikke DELETE)
    // Fasit: ACTIVE/CANCELLED
    // -----------------------------
    const cancelRes = await lpOrderCancel(sb as any, { p_date: order.date });
    if (!cancelRes.ok) {
      logApiError("PATCH /api/orders/[id]/cancel rpc failed", cancelRes.error, { rid: r, orderId, date: order.date });
      return jsonErr(r, "Kunne ikke avbestille ordre.", 500, {
        code: cancelRes.code ?? "ORDER_RPC_FAILED",
        detail: { uErr: cancelRes.error?.message ?? "rpc_failed" },
      });
    }

    const { data: updated, error: readErr } = await sb
      .from("orders")
      .select("id,date,status,updated_at")
      .eq("id", order.id)
      .eq("company_id", companyId)
      .eq("user_id", auth.user.id)
      .maybeSingle<{ id: string; date: string; status: string | null; updated_at: string | null }>();

    if (readErr || !updated) {
      return jsonErr(r, "Ordre kunne ikke leses etter avbestilling.", 409, "conflict");
    }

    return jsonOk(r, {
      ok: true,
      rid: r,
      changed: true,
      canAct: true,
      order: {
        id: updated.id,
        date: updated.date,
        status: "CANCELLED",
        updated_at: updated.updated_at,
      },
    }, 200);
  } catch (err: any) {
    // Ã°Å¸Å½Â¯ Cutoff-feil (forretningsregel)
    if (err?.code === "CUTOFF") {
      return jsonErr(r, err.message, 409, { code: "LOCKED_AFTER_0800", detail: {
        date: osloTodayISODate(),
        canAct: false,
      } });
    }

    logApiError("PATCH /api/orders/[id]/cancel failed", err, { rid: r });
    return jsonErr(r, err?.message || String(err), 500, { code: "server_error", detail: { orderId: params?.orderId } });
  }
}




