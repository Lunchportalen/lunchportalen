/**
 * Tripletex-drevet kredittsjekk: leser forfall/utestående, vurderer risiko, valgfri billing_hold ved CRITICAL.
 * Ingen lokal fakturaberegning. Ingen automatisk oppheving av hold.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { evaluateCreditRisk } from "@/lib/billing/creditRiskEngine";
import { enforceCompanyStatus } from "@/lib/billing/enforcementEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { getCompanyInvoiceStatus } from "@/lib/integrations/tripletexStatusEngine";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAGE = 500;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("credit_check");

    try {
      requireCronAuth(req, { secretEnvVar: "CRON_SECRET", missingCode: "cron_secret_missing" });
    } catch (e: unknown) {
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      const msg = String((e as { message?: unknown })?.message ?? e);
      if (code === "cron_secret_missing" || msg === "cron_secret_missing") {
        return jsonErr(requestId, "CRON_SECRET mangler i servermiljø.", 500, "CRON_SECRET_MISSING");
      }
      return jsonErr(requestId, "Ugyldig eller manglende cron-tilgang.", 403, "CRON_FORBIDDEN");
    }

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "credit_check" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    const admin = supabaseAdmin();
    const rows: Array<{
      companyId: string;
      risk: ReturnType<typeof evaluateCreditRisk>;
      status: Awaited<ReturnType<typeof getCompanyInvoiceStatus>>;
      enforcement: Awaited<ReturnType<typeof enforceCompanyStatus>>;
    }> = [];

    const riskCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, UNKNOWN: 0 };

    opsLog("credit_check_run", { rid: requestId, phase: "start" });

    let offset = 0;
    let total = 0;
    while (true) {
      const { data, error } = await admin.from("companies").select("id").order("id", { ascending: true }).range(offset, offset + PAGE - 1);

      if (error) {
        opsLog("credit_check_run", { rid: requestId, phase: "error", message: safeStr(error.message) });
        return jsonErr(requestId, safeStr(error.message), 500, "COMPANY_LIST_FAILED");
      }

      const batch = Array.isArray(data) ? data : [];
      if (batch.length === 0) break;

      for (const c of batch) {
        const companyId = safeStr((c as { id?: unknown })?.id);
        if (!companyId) continue;
        total += 1;
        const status = await getCompanyInvoiceStatus(companyId, { rid: requestId });
        const risk = evaluateCreditRisk(status);
        const enforcement = await enforceCompanyStatus(companyId, risk, { rid: requestId });
        riskCounts[risk] = (riskCounts[risk] ?? 0) + 1;
        rows.push({ companyId, risk, status, enforcement });
      }

      if (batch.length < PAGE) break;
      offset += PAGE;
    }

    opsLog("credit_check_run", {
      rid: requestId,
      phase: "complete",
      companiesChecked: total,
      riskCounts,
      holdsApplied: rows.filter((r) => r.enforcement.applied).length,
    });

    const criticalCompanies = rows.filter((r) => r.risk === "CRITICAL").map((r) => r.companyId);
    const highCompanies = rows.filter((r) => r.risk === "HIGH").map((r) => r.companyId);

    return jsonOk(
      requestId,
      {
        companiesChecked: total,
        riskCounts,
        holdsApplied: rows.filter((r) => r.enforcement.applied).length,
        criticalCompanyIds: criticalCompanies.slice(0, 200),
        highCompanyIds: highCompanies.slice(0, 200),
      },
      200,
    );
  });
}
