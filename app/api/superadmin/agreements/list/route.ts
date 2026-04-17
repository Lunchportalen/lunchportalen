// app/api/superadmin/agreements/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  deriveSuperadminAgreementListRowPresentation,
  indexLedgerAgreementsByCompanyId,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

function safeStr(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function normalizeLimit(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(500, Math.trunc(n)));
}

function normalizeStatus(v: unknown): "PENDING" | "ACTIVE" | "REJECTED" | "PAUSED" | "TERMINATED" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "PENDING" || s === "ACTIVE" || s === "REJECTED" || s === "PAUSED" || s === "TERMINATED") return s;
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
    const statusRaw = safeStr(url.searchParams.get("status")).toUpperCase();
    const statusSingle = normalizeStatus(statusRaw);
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
        activated_at,
        rejection_reason,
        companies:company_id ( name, status )
      `
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (statusRaw === "REJECTED") {
      q = q.in("status", ["REJECTED", "TERMINATED"]);
    } else if (statusSingle) {
      q = q.eq("status", statusSingle);
    }
    if (companyId) q = q.eq("company_id", companyId);

    const { data, error } = await q;

    if (error) {
      return jsonErr(rid, "Kunne ikke hente avtaler.", 500, "AGREEMENTS_LIST_FAILED");
    }

    const rawRows = data ?? [];
    const companyIds = [...new Set(rawRows.map((a: any) => safeStr(a.company_id)).filter(Boolean))];
    let pendingIdByCompany = new Map<string, string>();
    let activeIdByCompany = new Map<string, string>();
    if (companyIds.length) {
      const { data: ledgerRows, error: ledgerErr } = await admin
        .from("agreements")
        .select("id,company_id,status,created_at")
        .in("company_id", companyIds)
        .in("status", ["PENDING", "ACTIVE"]);
      if (ledgerErr) {
        return jsonErr(rid, "Kunne ikke hente ledger-status for avtaler.", 500, "AGREEMENTS_LEDGER_LOOKUP_FAILED");
      }
      const idx = indexLedgerAgreementsByCompanyId((ledgerRows ?? []) as Record<string, unknown>[]);
      pendingIdByCompany = idx.pendingIdByCompany;
      activeIdByCompany = idx.activeIdByCompany;
    }

    const companyFieldFromJoin = (comp: unknown, key: "name" | "status"): string | null => {
      if (comp && typeof comp === "object" && !Array.isArray(comp)) {
        const v = (comp as Record<string, unknown>)[key];
        return key === "status" ? safeStr(v).toUpperCase() || null : safeStr(v) || null;
      }
      if (Array.isArray(comp) && comp[0] && typeof comp[0] === "object") {
        const v = (comp[0] as Record<string, unknown>)[key];
        return key === "status" ? safeStr(v).toUpperCase() || null : safeStr(v) || null;
      }
      return null;
    };

    const agreements = rawRows.map((a: any) => {
      const id = safeStr(a.id);
      const company_id = safeStr(a.company_id);
      const company_status = companyFieldFromJoin(a.companies, "status");
      const company_name = companyFieldFromJoin(a.companies, "name") || "Firma";
      const ledger_pending_agreement_id = pendingIdByCompany.get(company_id) ?? null;
      const ledger_active_agreement_id = activeIdByCompany.get(company_id) ?? null;
      const pres = deriveSuperadminAgreementListRowPresentation({
        agreement_id: id,
        agreement_status: safeStr(a.status),
        company_status,
        ledger_pending_agreement_id,
        ledger_active_agreement_id,
      });
      return {
        id,
        company_id,
        company_name,
        company_status,
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
        activated_at: a.activated_at ?? null,
        rejection_reason: a.rejection_reason ?? null,
        ledger_pending_agreement_id,
        ledger_active_agreement_id,
        pipeline_stage_label: pres.pipeline_stage_label,
        next_label: pres.next_label,
        next_href: pres.next_href,
      };
    });

    return jsonOk(rid, { agreements }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke hente avtaler.", 500, "AGREEMENTS_LIST_UNEXPECTED");
  }
}

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-rid") || "rid_missing";
  return jsonErr(rid, "Bruk GET.", 405, "METHOD_NOT_ALLOWED");
}
