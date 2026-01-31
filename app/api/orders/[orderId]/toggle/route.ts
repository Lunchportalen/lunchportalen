// app/api/orders/[orderId]/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/* =========================================================
   Response helpers (fasit)
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
    { ok: false, rid: r, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}
async function readJson(req: NextRequest) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/* =========================================================
   Types
========================================================= */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ToggleBody = {
  // ✅ Idempotent: klienten sender ønsket slutt-tilstand
  wantsLunch?: boolean;
  // (valgfritt) hvis dere vil tillate note her
  note?: string | null;
};

type ProfileRow = {
  id: string;
  role: Role | null;
  company_id: string | null;
  location_id: string | null;
  disabled_at: string | null;
};

type CompanyRow = {
  id: string;
  status: string | null; // "active" | "paused" | "closed" | ...
};

type OrderRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  location_id: string | null;
  date: string;
  status: string | null;
  note: string | null;
  updated_at: string | null;
};

/* =========================================================
   POST: /api/orders/[orderId]/toggle
========================================================= */

export async function POST(req: NextRequest, ctx: { params: { orderId: string } }) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = rid();

  try {
    const orderId = String(ctx?.params?.orderId ?? "").trim();
    if (!orderId || !isUuid(orderId)) {
      return jsonErr(400, r, "bad_request", "Ugyldig orderId.", { orderId });
    }

    const sb = await supabaseServer();

    // -----------------------------
    // Auth
    // -----------------------------
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) {
      return jsonErr(401, r, "unauthorized", "Ikke innlogget.", { authErr: authErr?.message });
    }

    // -----------------------------
    // Input (idempotent)
    // -----------------------------
    const body = (await readJson(req)) as ToggleBody;
    if (typeof body.wantsLunch !== "boolean") {
      return jsonErr(
        400,
        r,
        "bad_request",
        "Mangler wantsLunch (boolean). Send ønsket slutt-tilstand (idempotent).",
        { received: body }
      );
    }

    const desiredStatus = body.wantsLunch ? "ACTIVE" : "CANCELLED";

    // -----------------------------
    // Profile + role gate
    // -----------------------------
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id,role,company_id,location_id,disabled_at")
      .eq("id", auth.user.id)
      .maybeSingle<ProfileRow>();

    if (pErr) {
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
      return jsonErr(403, r, "forbidden", "Ingen tilgang til å endre bestillinger med denne rollen.", { role });
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
    // Fetch order (ownership enforced)
    // - ansatte/admin kan kun endre egen ordre
    // - og kun innen eget firma
    // -----------------------------
    const { data: existing, error: exErr } = await sb
      .from("orders")
      .select("id,user_id,company_id,location_id,date,status,note,updated_at")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .eq("user_id", auth.user.id)
      .maybeSingle<OrderRow>();

    if (exErr) {
      return jsonErr(500, r, "db_error", "Kunne ikke lese ordre.", { exErr: exErr.message });
    }
    if (!existing) {
      return jsonErr(404, r, "not_found", "Ordre finnes ikke (eller du har ikke tilgang).", { orderId });
    }

    // -----------------------------
    // Idempotent update
    // -----------------------------
    const already = String(existing.status ?? "").toUpperCase() === desiredStatus;

    const nextNote =
      typeof body.note === "string" ? body.note : body.note === null ? null : existing.note;

    if (already && nextNote === existing.note) {
      return jsonOk({
        ok: true,
        rid: r,
        changed: false,
        order: { id: existing.id, date: existing.date, status: desiredStatus, note: existing.note },
      });
    }

    const { data: updated, error: upErr } = await sb
      .from("orders")
      .update({ status: desiredStatus, note: nextNote })
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .eq("user_id", auth.user.id)
      .select("id,date,status,note,updated_at")
      .maybeSingle<{ id: string; date: string; status: string | null; note: string | null; updated_at: string | null }>();

    if (upErr) {
      return jsonErr(500, r, "db_error", "Kunne ikke oppdatere ordre.", { upErr: upErr.message });
    }
    if (!updated) {
      return jsonErr(409, r, "conflict", "Ordre kunne ikke oppdateres (race/tilgang).");
    }

    return jsonOk({
      ok: true,
      rid: r,
      changed: true,
      order: {
        id: updated.id,
        date: updated.date,
        status: String(updated.status ?? "").toUpperCase(),
        note: updated.note,
        updated_at: updated.updated_at,
      },
    });
  } catch (e: any) {
    return jsonErr(500, r, "unexpected", "Uventet feil i toggle.", { message: e?.message ?? String(e) });
  }
}
