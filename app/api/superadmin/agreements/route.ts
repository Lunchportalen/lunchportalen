export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { isIsoDate } from "@/lib/date/oslo";

type CreateAgreementBody = {
  company_id?: unknown;
  location_id?: unknown;
  tier?: unknown;
  delivery_days?: unknown;
  starts_at?: unknown;
  slot_start?: unknown;
  slot_end?: unknown;
  binding_months?: unknown;
  notice_months?: unknown;
  price_per_employee?: unknown;
};

type CreateRpcOut = {
  agreement_id?: unknown;
  company_id?: unknown;
  status?: unknown;
} | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  const s = safeStr(v);
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

function normalizeTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function isHHMM(v: unknown) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(safeStr(v));
}

function asInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asPrice(v: unknown) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function mapRpcError(messageRaw: unknown) {
  const m = safeStr(messageRaw).toUpperCase();

  if (m.includes("COMPANY_NOT_FOUND")) {
    return { status: 404, code: "COMPANY_NOT_FOUND", message: "Fant ikke firma." };
  }
  if (m.includes("LOCATION_REQUIRED")) {
    return { status: 409, code: "LOCATION_REQUIRED", message: "Firmaet mangler lokasjon." };
  }
  if (m.includes("LOCATION_INVALID")) {
    return { status: 409, code: "LOCATION_INVALID", message: "Lokasjon er ikke gyldig for firmaet." };
  }
  if (
    m.includes("TIER_INVALID") ||
    m.includes("STARTS_AT_REQUIRED") ||
    m.includes("SLOT_RANGE_INVALID") ||
    m.includes("BINDING_MONTHS_INVALID") ||
    m.includes("NOTICE_MONTHS_INVALID") ||
    m.includes("PRICE_PER_EMPLOYEE_INVALID") ||
    m.includes("DELIVERY_DAYS_INVALID") ||
    m.includes("DELIVERY_DAYS_REQUIRED")
  ) {
    return { status: 400, code: "BAD_INPUT", message: "Ugyldige avtaleverdier." };
  }

  return { status: 500, code: "AGREEMENT_CREATE_FAILED", message: "Kunne ikke opprette avtale." };
}

export async function POST(req: NextRequest) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.create", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const body = (await readJson(req)) as CreateAgreementBody;

    const companyId = safeStr(body.company_id);
    const locationId = safeStr(body.location_id) || null;
    const tier = normalizeTier(body.tier);
    const startsAt = safeStr(body.starts_at);
    const slotStart = safeStr(body.slot_start);
    const slotEnd = safeStr(body.slot_end);
    const bindingMonths = asInt(body.binding_months, 12);
    const noticeMonths = asInt(body.notice_months, 3);
    const pricePerEmployee = asPrice(body.price_per_employee);

    if (!isUuid(companyId)) return jsonErr(rid, "Ugyldig firma.", 400, "BAD_INPUT");
    if (locationId && !isUuid(locationId)) return jsonErr(rid, "Ugyldig lokasjon.", 400, "BAD_INPUT");
    if (!tier) return jsonErr(rid, "Ugyldig avtalenivå.", 400, "BAD_INPUT");
    if (!startsAt || !isIsoDate(startsAt)) return jsonErr(rid, "Ugyldig startdato.", 400, "BAD_INPUT");
    if (!isHHMM(slotStart) || !isHHMM(slotEnd)) return jsonErr(rid, "Ugyldig leveringsvindu.", 400, "BAD_INPUT");
    if (!Number.isFinite(pricePerEmployee) || pricePerEmployee <= 0) {
      return jsonErr(rid, "Pris per ansatt må være større enn 0.", 400, "BAD_INPUT");
    }

    const deliveryNorm = normalizeDeliveryDaysStrict(body.delivery_days);
    if (deliveryNorm.days.length === 0 || deliveryNorm.unknown.length > 0) {
      return jsonErr(rid, "Ugyldige leveringsdager.", 400, "BAD_INPUT");
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("lp_agreement_create_pending", {
      p_company_id: companyId,
      p_location_id: locationId,
      p_tier: tier,
      p_delivery_days: deliveryNorm.days,
      p_slot_start: slotStart,
      p_slot_end: slotEnd,
      p_starts_at: startsAt,
      p_binding_months: bindingMonths,
      p_notice_months: noticeMonths,
      p_price_per_employee: pricePerEmployee,
    });

    if (error) {
      const mapped = mapRpcError(error.message);
      return jsonErr(rid, mapped.message, mapped.status, mapped.code);
    }

    const out = (data ?? null) as CreateRpcOut;
    const agreementId = safeStr(out?.agreement_id);
    const status = safeStr(out?.status).toUpperCase() || "PENDING";

    if (!agreementId) {
      return jsonErr(rid, "Kunne ikke opprette avtale.", 500, "AGREEMENT_CREATE_BAD_RESPONSE");
    }

    return jsonOk(
      rid,
      {
        agreementId,
        status,
        message: "Avtale opprettet som Venter.",
      },
      200
    );
  } catch {
    return jsonErr(rid, "Kunne ikke opprette avtale.", 500, "AGREEMENT_CREATE_UNEXPECTED");
  }
}

export async function GET(req: NextRequest) {
  const rid = req.headers.get("x-rid") || "rid_missing";
  return jsonErr(rid, "Bruk POST.", 405, "METHOD_NOT_ALLOWED");
}
