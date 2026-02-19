// app/api/superadmin/agreements/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function normalizeLimit(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(500, Math.trunc(n)));
}

function normalizeStatus(v: unknown): "PENDING" | "ACTIVE" | "TERMINATED" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "PENDING" || s === "ACTIVE" || s === "TERMINATED") return s;
  return null;
}

export async function GET(req: NextRequest) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.read", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const url = new URL(req.url);
    const status = normalizeStatus(url.searchParams.get("status"));
    const limit = normalizeLimit(url.searchParams.get("limit"));
    const companyId = safeStr(url.searchParams.get("companyId"));

    const admin = supabaseAdmin();

    let q = admin
      .from("agreements")
      .select(
        `
        id,
        company_id,
        location_id,
        status,
        tier,
        delivery_days,
        starts_at,
        ends_at,
        slot_start,
        slot_end,
        binding_months,
        notice_months,
        price_per_employee,
        created_at,
        updated_at,
        companies:company_id ( name )
      `
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);
    if (companyId) q = q.eq("company_id", companyId);

    const { data, error } = await q;

    if (error) {
      return jsonErr(rid, "Kunne ikke hente avtaler.", 500, "AGREEMENTS_LIST_FAILED");
    }

    const agreements = (data ?? []).map((a: any) => ({
      id: safeStr(a.id),
      company_id: safeStr(a.company_id),
      company_name: safeStr(a.companies?.name, "Firma"),
      location_id: a.location_id ?? null,
      status: safeStr(a.status).toUpperCase(),
      tier: safeStr(a.tier).toUpperCase(),
      delivery_days: Array.isArray(a.delivery_days) ? a.delivery_days : [],
      starts_at: a.starts_at ?? null,
      ends_at: a.ends_at ?? null,
      slot_start: a.slot_start ?? null,
      slot_end: a.slot_end ?? null,
      binding_months: a.binding_months ?? null,
      notice_months: a.notice_months ?? null,
      price_per_employee: a.price_per_employee ?? null,
      created_at: a.created_at ?? null,
      updated_at: a.updated_at ?? null,
    }));

    return jsonOk(rid, { agreements }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke hente avtaler.", 500, "AGREEMENTS_LIST_UNEXPECTED");
  }
}

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-rid") || "rid_missing";
  return jsonErr(rid, "Bruk GET.", 405, "METHOD_NOT_ALLOWED");
}
