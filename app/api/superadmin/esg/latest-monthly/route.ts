export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm } from "@/lib/billing/periodYm";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type MonthlyRow = {
  company_id: string;
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function resolveMonth(admin: any, monthInput: string): Promise<string | null> {
  if (monthInput) return monthInput;

  const { data, error } = await admin
    .from("esg_monthly")
    .select("month")
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return safeStr((data as any)?.month) || null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const rid = ctx.rid;

  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const url = new URL(req.url);
  const monthInput = safeStr(url.searchParams.get("month"));

  if (monthInput && !parsePeriodYm(monthInput)) {
    return jsonErr(rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const month = await resolveMonth(admin, monthInput);

    if (!month) {
      return jsonOk(rid, {
        month: null,
        items: [],
      });
    }

    const { data, error } = await admin
      .from("esg_monthly")
      .select("company_id,month,delivered_count,cancelled_count,delivery_rate,waste_estimate_kg,co2_estimate_kg")
      .eq("month", month)
      .order("delivery_rate", { ascending: false });

    if (error) {
      return jsonErr(rid, "Kunne ikke hente ESG-liste.", 500, "ESG_READ_FAILED");
    }

    const rows = (Array.isArray(data) ? data : []) as MonthlyRow[];
    const companyIds = Array.from(
      new Set(
        rows
          .map((row) => safeStr((row as any).company_id))
          .filter(Boolean)
      )
    );

    const companyNames = new Map<string, string>();
    for (const part of chunk(companyIds, 200)) {
      const { data: companies, error: companyError } = await admin
        .from("companies")
        .select("id,name")
        .in("id", part);

      if (companyError) {
        return jsonErr(rid, "Kunne ikke hente firmanavn.", 500, "COMPANY_READ_FAILED");
      }

      for (const company of Array.isArray(companies) ? companies : []) {
        const id = safeStr((company as any).id);
        if (!id) continue;
        companyNames.set(id, safeStr((company as any).name) || "Ukjent firma");
      }
    }

    const items = rows.map((row) => {
      const companyId = safeStr((row as any).company_id);
      return {
        company: {
          id: companyId,
          name: companyNames.get(companyId) ?? "Ukjent firma",
        },
        month: safeStr((row as any).month),
        delivered_count: Math.max(0, Math.floor(safeNum((row as any).delivered_count))),
        cancelled_count: Math.max(0, Math.floor(safeNum((row as any).cancelled_count))),
        delivery_rate: safeNum((row as any).delivery_rate),
        waste_estimate_kg: safeNum((row as any).waste_estimate_kg),
        co2_estimate_kg: safeNum((row as any).co2_estimate_kg),
      };
    });

    return jsonOk(rid, {
      month,
      items,
    });
  } catch {
    return jsonErr(rid, "Uventet feil ved henting av ESG-oversikt.", 500, "ESG_SUPERADMIN_FAILED");
  }
}

