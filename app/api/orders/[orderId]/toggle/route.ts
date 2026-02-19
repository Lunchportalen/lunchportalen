// app/api/orders/[orderId]/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireRule } from "@/lib/agreement/requireRule";
import { immutabilityStatusForDate } from "@/lib/orders/immutability";
import { cutoffStatusForDate } from "@/lib/date/oslo";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";

/* =========================================================
   Response helpers (fasit)
========================================================= */

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

/* =========================================================
   Types
========================================================= */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type ToggleBody = {
  // Ã¢Å“â€¦ Idempotent: klienten sender ÃƒÂ¸nsket slutt-tilstand
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
  slot?: string | null;
};

/* =========================================================
   POST: /api/orders/[orderId]/toggle
========================================================= */

export async function POST(req: NextRequest, ctx: { params: { orderId: string } }) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = makeRid();

  try {
    const orderId = String(ctx?.params?.orderId ?? "").trim();
    if (!orderId) {
      return jsonErr(r, "Ugyldig orderId.", 400, { code: "bad_request", detail: { orderId } });
    }

    const sb = await supabaseServer();

    // -----------------------------
    // Auth
    // -----------------------------
    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user) {
      return jsonErr(r, "Ikke innlogget.", 401, { code: "unauthorized", detail: { authErr: authErr?.message } });
    }

    // -----------------------------
    // Input (idempotent)
    // -----------------------------
    const body = (await readJson(req)) as ToggleBody;
    if (typeof body.wantsLunch !== "boolean") {
      return jsonErr(r, "Mangler wantsLunch (boolean). Send ÃƒÂ¸nsket slutt-tilstand (idempotent).", 400, { code: "bad_request", detail: { received: body } });
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
      return jsonErr(r, "Ingen tilgang til ÃƒÂ¥ endre bestillinger med denne rollen.", 403, { code: "forbidden", detail: { role } });
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
    // Fetch order (ownership enforced)
    // - ansatte/admin kan kun endre egen ordre
    // - og kun innen eget firma
    // -----------------------------
    const { data: existing, error: exErr } = await sb
      .from("orders")
      .select("id,user_id,company_id,location_id,date,status,note,updated_at,slot")
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle<OrderRow>();

    if (exErr) {
      return jsonErr(r, "Kunne ikke lese ordre.", 500, { code: "db_error", detail: { exErr: exErr.message } });
    }
    if (!existing) {
      return jsonErr(r, "Ordre finnes ikke (eller du har ikke tilgang).", 404, { code: "not_found", detail: { orderId } });
    }
    if (String(existing.user_id ?? "") !== auth.user.id) {
      return jsonErr(r, "Du har ikke tilgang til denne ordren.", 403, { code: "forbidden", detail: { orderId } });
    }

    // -----------------------------
    // Immutability after 08:05 (Oslo)
    // -----------------------------
    const cutoff = cutoffStatusForDate(existing.date);
    if (cutoff === "PAST") {
      return jsonErr(r, "Datoen er passert og kan ikke endres.", 403, "DATE_LOCKED_PAST");
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonErr(r, "Endringer er lÃƒÂ¥st etter kl. 08:00 i dag.", 403, "LOCKED_AFTER_0800");
    }

    const imm = immutabilityStatusForDate(existing.date);
    if (imm.locked) {
      const msg =
        imm.lockCode === "DATE_LOCKED_PAST"
          ? "Datoen er passert og kan ikke endres."
          : "Endringer er lÃƒÂ¥st etter kl. 08:05 i dag.";
      return jsonErr(r, msg, 423, imm.lockCode ?? "LOCKED");
    }

    // -----------------------------
    // Agreement rules gate (fail-closed)
    // -----------------------------
    const slotVal = String((existing as any)?.slot ?? "").trim() || "lunch";
    const dayKey = weekdayKeyOslo(existing.date);
    if (!dayKey) {
      return jsonErr(r, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: existing.date } });
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
    // Idempotent update
    // -----------------------------
    const already = String(existing.status ?? "").toUpperCase() === desiredStatus;

    const nextNote =
      typeof body.note === "string" ? body.note : body.note === null ? null : existing.note;

    if (already && nextNote === existing.note) {
      return jsonOk(r, {
        changed: false,
        order: { id: existing.id, date: existing.date, status: desiredStatus, note: existing.note },
      });
    }

    const rpcRes = desiredStatus === "ACTIVE"
      ? await lpOrderSet(sb as any, { p_date: existing.date, p_slot: slotVal, p_note: nextNote ?? null })
      : await lpOrderCancel(sb as any, { p_date: existing.date });

    if (!rpcRes.ok) {
      return jsonErr(r, "Kunne ikke oppdatere ordre.", 500, {
        code: rpcRes.code ?? "ORDER_RPC_FAILED",
        detail: { upErr: rpcRes.error?.message ?? "rpc_failed" },
      });
    }

    const { data: updated, error: upErr } = await sb
      .from("orders")
      .select("id,date,status,note,updated_at")
      .eq("id", existing.id)
      .eq("company_id", companyId)
      .eq("user_id", auth.user.id)
      .maybeSingle<{ id: string; date: string; status: string | null; note: string | null; updated_at: string | null }>();

    if (upErr || !updated) {
      return jsonErr(r, "Ordre kunne ikke oppdateres (race/tilgang).", 409, "conflict");
    }

    return jsonOk(r, {
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
    return jsonErr(r, "Uventet feil i toggle.", 500, { code: "unexpected", detail: { message: e?.message ?? String(e) } });
  }
}




