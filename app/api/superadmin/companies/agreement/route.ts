
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

type PlanTier = "BASIS" | "LUXUS";
type AgreementInput = {
  companyId: string;
  plan_tier: PlanTier;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD | null
  binding_months: number; // e.g. 12
  delivery_days: Array<"mon" | "tue" | "wed" | "thu" | "fri">;
  note?: string | null; // intern
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const g = await scopeOr401(req);
  if (g instanceof Response) return g;

  const deny = requireRoleOr403(g.ctx, "api.superadmin.companies.agreement.GET", ["superadmin"]);
  if (deny instanceof Response) return deny;

  const url = new URL(req.url);
  const companyId = safeStr(url.searchParams.get("companyId"));
  if (!companyId) return jsonErr(400, g.ctx, "BAD_INPUT", "Mangler companyId.");

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("companies")
    .select("id, plan_tier, agreement_json")
    .eq("id", companyId)
    .maybeSingle();

  if (error) return jsonErr(500, g.ctx, "DB_ERROR", "Kunne ikke lese avtale.", error);
  if (!data?.id) return jsonErr(404, g.ctx, "NOT_FOUND", "Firma ikke funnet.");

  return jsonOk(g.ctx, { ok: true, data });
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const g = await scopeOr401(req);
  if (g instanceof Response) return g;

  const deny = requireRoleOr403(g.ctx, "api.superadmin.companies.agreement.POST", ["superadmin"]);
  if (deny instanceof Response) return deny;

  const body = (await readJson(req)) as AgreementInput;
  const companyId = safeStr(body?.companyId);
  if (!companyId) return jsonErr(400, g.ctx, "BAD_INPUT", "Mangler companyId.");

  const admin = supabaseAdmin();

  const agreement_json = {
    plan: {
      tier: body.plan_tier,
      days: body.delivery_days.reduce((acc, d) => {
        acc[d] = { enabled: true };
        return acc;
      }, {} as any),
    },
    contract: {
      start_date: body.start_date,
      end_date: body.end_date ?? null,
      binding_months: body.binding_months,
    },
    internal_note: body.note ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("companies")
    .update({
      plan_tier: body.plan_tier,
      agreement_json,
    })
    .eq("id", companyId)
    .select("id, plan_tier, agreement_json, updated_at")
    .maybeSingle();

  if (error) return jsonErr(500, g.ctx, "DB_ERROR", "Kunne ikke oppdatere avtale.", error);
  if (!data?.id) return jsonErr(404, g.ctx, "NOT_FOUND", "Firma ikke funnet.");

  return jsonOk(g.ctx, { ok: true, data });
}


