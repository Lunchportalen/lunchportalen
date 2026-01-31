// app/api/orders/[orderId]/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";
import { assertBeforeCutoffForDeliveryDate } from "@/lib/guards/cutoff";

/* =========================================================
   Fasit response helpers (no-store + rid)
========================================================= */

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomUUID();
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, r: string, error: string, message: string, detail?: any) {
  return NextResponse.json(
    { ok: false, rid: r, error, message, canAct: false, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// ✅ Konsistent logging + kontekst
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
};

/* =========================================================
   PATCH: /api/orders/[orderId]/cancel
   - Idempotent: hvis allerede kansellert -> ok, changed:false
   - Eierskap: kun egen ordre
   - Firma gate: company må være active
   - Cutoff: assertBeforeCutoffForDeliveryDate
========================================================= */

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = rid();

  try {
    const orderId = String(params?.orderId ?? "").trim();
    if (!orderId || !isUuid(orderId)) {
      return jsonErr(400, r, "bad_request", "Ugyldig orderId.", { orderId });
    }

    const sb = await supabaseServer();

    // -----------------------------
    // Auth
    // -----------------------------
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) {
      logApiError("PATCH /api/orders/[id]/cancel auth failed", authErr, { rid: r, orderId });
      return jsonErr(401, r, "unauthorized", "Ikke innlogget.", { authErr: authErr?.message });
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
      return jsonErr(500, r, "db_error", "Kunne ikke lese profil.", { pErr: pErr.message });
    }
    if (!profile) {
      return jsonErr(403, r, "forbidden", "Profil finnes ikke.", { userId: auth.user.id });
    }
    if (profile.disabled_at) {
      return jsonErr(403, r, "forbidden", "Konto er deaktivert.", { disabled_at: profile.disabled_at });
    }

    const role = profile.role ?? null;
    if (role !== "employee" && role !== "company_admin") {
      return jsonErr(403, r, "forbidden", "Ingen tilgang til å avbestille med denne rollen.", { role });
    }

    const companyId = String(profile.company_id ?? "").trim();
    if (!companyId) {
      return jsonErr(403, r, "forbidden", "Mangler company_id på profil.", { role });
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
      return jsonErr(500, r, "db_error", "Kunne ikke lese firmastatus.", { cErr: cErr.message });
    }
    if (!company) {
      return jsonErr(403, r, "forbidden", "Firma finnes ikke (eller ingen tilgang).", { companyId });
    }

    const companyStatus = String(company.status ?? "").toLowerCase();
    if (companyStatus && companyStatus !== "active") {
      return jsonErr(403, r, "company_blocked", "Firma er ikke aktivt.", { companyStatus });
    }

    // -----------------------------
    // Fetch order (for date + ownership + firmabinding)
    // -----------------------------
    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id,date,user_id,status,company_id,location_id")
      .eq("id", orderId)
      .maybeSingle<OrderRow>();

    if (oErr) {
      logApiError("PATCH /api/orders/[id]/cancel order lookup failed", oErr, { rid: r, orderId });
      return jsonErr(500, r, "db_error", "Kunne ikke lese ordre.", { oErr: oErr.message });
    }
    if (!order) {
      return jsonErr(404, r, "not_found", "Ordre ikke funnet.", { orderId });
    }

    // ✅ Firmasjekk (ordre må tilhøre samme firma som profilen)
    if (String(order.company_id ?? "") !== companyId) {
      return jsonErr(403, r, "forbidden", "Du har ikke tilgang til denne ordren.", {
        orderCompanyId: order.company_id,
        companyId,
      });
    }

    // ✅ Eier-sjekk (ansatt/admin kan kun avbestille egen ordre)
    if (order.user_id !== auth.user.id) {
      return jsonErr(403, r, "forbidden", "Du kan kun avbestille egen ordre.", { orderUserId: order.user_id });
    }

    // -----------------------------
    // Idempotens: allerede kansellert
    // (støtter både ny og legacy status)
    // -----------------------------
    const curr = String(order.status ?? "").toUpperCase();
    const isCancelled = curr === "CANCELLED" || curr === "CANCELED" || curr === "CANCELED" || curr === "CANCELED" || curr === "CANCELED"; // safe
    const isLegacyCancelled = String(order.status ?? "").toLowerCase() === "canceled";

    if (isCancelled || isLegacyCancelled) {
      return jsonOk({
        ok: true,
        rid: r,
        changed: false,
        canAct: true,
        order: { id: order.id, date: order.date, status: "CANCELLED" },
      });
    }

    // -----------------------------
    // HARD CUTOFF
    // -----------------------------
    assertBeforeCutoffForDeliveryDate("Avbestilling", order.date);

    // -----------------------------
    // Cancel = UPDATE status (ikke DELETE)
    // Fasit: ACTIVE/CANCELLED
    // -----------------------------
    const { data: updated, error: uErr } = await sb
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id)
      .eq("company_id", companyId)
      .eq("user_id", auth.user.id)
      .select("id,date,status,updated_at")
      .maybeSingle<{ id: string; date: string; status: string | null; updated_at: string | null }>();

    if (uErr) {
      logApiError("PATCH /api/orders/[id]/cancel update failed", uErr, { rid: r, orderId, date: order.date });
      return jsonErr(500, r, "db_error", "Kunne ikke avbestille ordre.", { uErr: uErr.message });
    }
    if (!updated) {
      return jsonErr(409, r, "conflict", "Ordre kunne ikke oppdateres (race/tilgang).");
    }

    return jsonOk({
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
    });
  } catch (err: any) {
    // 🎯 Cutoff-feil (forretningsregel)
    if (err?.code === "CUTOFF") {
      return NextResponse.json(
        {
          ok: false,
          rid: r,
          error: "LOCKED_AFTER_0800",
          message: err.message,
          date: osloTodayISODate(),
          canAct: false,
        },
        { status: 409, headers: noStore() }
      );
    }

    logApiError("PATCH /api/orders/[id]/cancel failed", err, { rid: r });
    return jsonErr(500, r, "server_error", err?.message || String(err), { orderId: params?.orderId });
  }
}
