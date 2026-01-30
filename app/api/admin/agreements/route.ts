// app/api/admin/agreements/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type AgreementStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function normalizeTier(v: unknown): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

function normalizeStatus(v: unknown): AgreementStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED" || s === "DRAFT") return s;
  return "DRAFT";
}

function normalizeDeliveryDays(v: unknown): DayKey[] {
  if (!v) return DAY_KEYS.slice();
  if (Array.isArray(v)) {
    const set = new Set<DayKey>();
    for (const x of v) {
      const s = String(x ?? "").trim().toLowerCase();
      if (DAY_KEYS.includes(s as DayKey)) set.add(s as DayKey);
    }
    return set.size ? Array.from(set) : DAY_KEYS.slice();
  }
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    if (Array.isArray(parsed)) return normalizeDeliveryDays(parsed);
  } catch {}
  return DAY_KEYS.slice();
}

type AgreementRow = {
  id: string;
  company_id: string;
  status: AgreementStatus;
  plan_tier: Tier;
  price_per_cuvert_nok: number;
  delivery_days: any; // jsonb
  binding_months: number;
  notice_months: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function viewModel(a: AgreementRow) {
  return {
    id: a.id,
    company_id: a.company_id,
    status: normalizeStatus(a.status),
    plan_tier: normalizeTier(a.plan_tier),
    price_per_cuvert_nok: Number(a.price_per_cuvert_nok ?? 0),
    delivery_days: normalizeDeliveryDays(a.delivery_days),
    binding_months: Number(a.binding_months ?? 0),
    notice_months: Number(a.notice_months ?? 0),
    start_date: a.start_date,
    end_date: a.end_date ?? null,
    notes: a.notes ?? null,
    meta: {
      created_at: a.created_at,
      updated_at: a.updated_at,
    },
  };
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.agreements.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const url = new URL(req.url);

  const requestedCompanyId = safeStr(url.searchParams.get("company_id")) || null;

  let companyId: string | null = null;

  if (scope.role === "superadmin") {
    if (!requestedCompanyId) return jsonErr(400, rid, "BAD_REQUEST", "Superadmin må angi ?company_id= for avtaleoppslag.");
    if (!isUuid(requestedCompanyId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig company_id.");
    companyId = requestedCompanyId;
  } else {
    const denyScope = requireCompanyScopeOr403(a.ctx);
    if (denyScope) return denyScope;

    const myCompanyId = safeStr(scope.companyId);
    if (!isUuid(myCompanyId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig company_id.");
    companyId = myCompanyId;
  }

  try {
    const sb = await supabaseServer();

    const { data: rows, error } = await sb
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return jsonErr(500, rid, "AGREEMENTS_READ_FAILED", "Kunne ikke hente avtaler.", { message: error.message });

    const list = (rows ?? []) as AgreementRow[];
    const active = list.find((x) => String(x.status).toUpperCase() === "ACTIVE") ?? null;
    const latest = list[0] ?? null;

    return jsonOk({
      ok: true,
      rid,
      company_id: companyId,
      readOnly: scope.role !== "superadmin",
      current: active ? viewModel(active) : latest ? viewModel(latest) : null,
      active: active ? viewModel(active) : null,
      latest: latest ? viewModel(latest) : null,
      history: list.map(viewModel),
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}

export async function PUT(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.agreements.write", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  return jsonErr(
    405,
    rid,
    "METHOD_NOT_ALLOWED",
    "Dette endepunktet er read-only. Avtaler endres kun av superadmin i egne superadmin-ruter.",
    { method: "PUT" }
  );
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.agreements.write", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  return jsonErr(405, rid, "METHOD_NOT_ALLOWED", "Bruk GET (les).", { method: "POST" });
}

export async function DELETE(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.agreements.write", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  return jsonErr(405, rid, "METHOD_NOT_ALLOWED", "Bruk GET (les).", { method: "DELETE" });
}
