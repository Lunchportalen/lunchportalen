export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm, toPeriodYmBounds } from "@/lib/billing/periodYm";
import { osloPreviousPeriodYm } from "@/lib/date/osloPeriod";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

type EsgCounts = {
  delivered: number;
  cancelled: number;
};

type EsgMonthlyUpsert = {
  company_id: string;
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
  generated_at: string;
};

type PreviewRow = {
  companyId: string;
  month: string;
  deliveredCount: number;
  cancelledCount: number;
  deliveryRate: number;
  wasteEstimateKg: number;
  co2EstimateKg: number;
};

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 200;

// Conservativ fail-closed allowlist inntil status-kontrakten er eksplisitt bekreftet.
const DELIVERED_ORDER_STATUSES = ["ACTIVE"] as const;
const CANCELLED_ORDER_STATUSES = ["CANCELLED"] as const;

// Enkel, dokumentert modell:
// - Waste: estimert kg matsvinn per avbestilt måltid
// - CO2: estimert kg CO2 per levert måltid
const WASTE_KG_PER_CANCELLED_MEAL = 0.35;
const CO2_KG_PER_DELIVERED_MEAL = 1.8;

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function dryRunEnabled(req: NextRequest): boolean {
  const v = safeStr(new URL(req.url).searchParams.get("dryRun"));
  return v === "1";
}

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function loadEsgOrderCountsByCompany(
  admin: any,
  periodStart: string,
  periodEndExclusive: string
): Promise<Map<string, EsgCounts>> {
  const counts = new Map<string, EsgCounts>();
  const allowedStatuses = [...DELIVERED_ORDER_STATUSES, ...CANCELLED_ORDER_STATUSES];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("orders")
      .select("company_id,status")
      .in("status", allowedStatuses)
      .gte("date", periodStart)
      .lt("date", periodEndExclusive)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const companyId = safeStr((row as any)?.company_id);
      const status = safeStr((row as any)?.status).toUpperCase();
      if (!companyId) continue;

      const current = counts.get(companyId) ?? { delivered: 0, cancelled: 0 };

      if (DELIVERED_ORDER_STATUSES.includes(status as (typeof DELIVERED_ORDER_STATUSES)[number])) {
        current.delivered += 1;
      } else if (CANCELLED_ORDER_STATUSES.includes(status as (typeof CANCELLED_ORDER_STATUSES)[number])) {
        current.cancelled += 1;
      }

      counts.set(companyId, current);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return counts;
}

async function upsertEsgMonthly(admin: any, rows: EsgMonthlyUpsert[]): Promise<void> {
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await admin.from("esg_monthly").upsert(part, {
      onConflict: "company_id,month",
      ignoreDuplicates: false,
    });

    if (error) throw error;
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (error: any) {
    const code = safeStr(error?.code).toLowerCase();
    const msg = safeStr(error?.message).toLowerCase();

    if (code === "cron_secret_missing" || msg === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i servermiljø.", 500, "CRON_SECRET_MISSING");
    }
    return jsonErr(rid, "Ugyldig eller manglende cron-tilgang.", 403, "CRON_FORBIDDEN");
  }

  const url = new URL(req.url);
  const monthInput = safeStr(url.searchParams.get("month"));
  const resolvedMonth = monthInput || osloPreviousPeriodYm();
  const dryRun = dryRunEnabled(req);

  if (!parsePeriodYm(resolvedMonth)) {
    return jsonErr(rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  const bounds = toPeriodYmBounds(resolvedMonth);
  if (!bounds) {
    return jsonErr(rid, "Ugyldig måned oppgitt.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const countsByCompany = await loadEsgOrderCountsByCompany(
      admin,
      bounds.periodStart,
      bounds.periodEndExclusive
    );

    const companyIds = Array.from(countsByCompany.keys()).sort((a, b) => a.localeCompare(b));
    const generatedAt = new Date().toISOString();

    const upserts: EsgMonthlyUpsert[] = [];
    const preview: PreviewRow[] = [];

    for (const companyId of companyIds) {
      const counts = countsByCompany.get(companyId) ?? { delivered: 0, cancelled: 0 };
      const deliveredCount = Math.max(0, Math.floor(safeNum(counts.delivered)));
      const cancelledCount = Math.max(0, Math.floor(safeNum(counts.cancelled)));
      const denominator = deliveredCount + cancelledCount;
      const deliveryRate = denominator > 0 ? round(deliveredCount / denominator, 3) : 0;
      const wasteEstimateKg = round(cancelledCount * WASTE_KG_PER_CANCELLED_MEAL, 4);
      const co2EstimateKg = round(deliveredCount * CO2_KG_PER_DELIVERED_MEAL, 4);

      const row: EsgMonthlyUpsert = {
        company_id: companyId,
        month: bounds.period,
        delivered_count: deliveredCount,
        cancelled_count: cancelledCount,
        delivery_rate: deliveryRate,
        waste_estimate_kg: wasteEstimateKg,
        co2_estimate_kg: co2EstimateKg,
        generated_at: generatedAt,
      };

      upserts.push(row);

      preview.push({
        companyId,
        month: bounds.period,
        deliveredCount,
        cancelledCount,
        deliveryRate,
        wasteEstimateKg,
        co2EstimateKg,
      });
    }

    if (!dryRun && upserts.length > 0) {
      await upsertEsgMonthly(admin, upserts);
    }

    console.info("[cron.esg.generate]", {
      rid,
      month: bounds.period,
      dryRun,
      processed_companies: companyIds.length,
      upserted: dryRun ? 0 : upserts.length,
      limitation: "CANCELLED_BEFORE_CUTOFF_UNAVAILABLE",
    });

    return jsonOk(rid, {
      month: bounds.period,
      processed_companies: companyIds.length,
      upserted: dryRun ? 0 : upserts.length,
      dryRun,
      limitation: "CANCELLED_BEFORE_CUTOFF_UNAVAILABLE",
      preview: dryRun ? preview.slice(0, 20) : undefined,
    });
  } catch {
    return jsonErr(rid, "Kunne ikke generere ESG per måned.", 500, "ESG_MONTHLY_GENERATE_FAILED");
  }
}

