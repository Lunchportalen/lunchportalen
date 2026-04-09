/**
 * 14-dagers fakturagrunnlag per firma (logg + valgfri direkte Tripletex når BIWEEKLY_TRIPLETEX_DIRECT_INVOICE_ENABLED=true).
 * Månedlig faktura via /api/cron/invoices/generate forblir primær Tripletex-kø for de fleste miljøer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { biweeklyInvoiceWindowFromToday, generateCompanyInvoice } from "@/lib/billing/invoiceEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAGE = 500;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("invoice_biweekly");

    try {
      requireCronAuth(req, { secretEnvVar: "CRON_SECRET", missingCode: "cron_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (code === "cron_secret_missing" || msg === "cron_secret_missing") {
        return jsonErr(requestId, "CRON_SECRET mangler i servermiljø.", 500, "CRON_SECRET_MISSING");
      }
      return jsonErr(requestId, "Ugyldig eller manglende cron-tilgang.", 403, "CRON_FORBIDDEN");
    }

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "invoice_companies_biweekly" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    const window = biweeklyInvoiceWindowFromToday();
    const admin = supabaseAdmin();
    const summaries: Array<{ companyId: string; result: Awaited<ReturnType<typeof generateCompanyInvoice>> }> = [];

    let offset = 0;
    while (true) {
      const { data, error } = await admin.from("companies").select("id").order("id", { ascending: true }).range(offset, offset + PAGE - 1);

      if (error) {
        opsLog("invoice_biweekly_companies_failed", { rid: requestId, message: safeStr(error.message) });
        return jsonErr(requestId, safeStr(error.message), 500, "COMPANY_LIST_FAILED");
      }

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const companyId = safeStr((row as { id?: unknown })?.id);
        if (!companyId) continue;
        const result = await generateCompanyInvoice(companyId, { rid: requestId }, window);
        summaries.push({ companyId, result });
      }

      if (rows.length < PAGE) break;
      offset += PAGE;
    }

    opsLog("invoice_biweekly_cron_complete", {
      rid: requestId,
      window,
      companies: summaries.length,
    });

    return jsonOk(
      requestId,
      {
        window,
        processed: summaries.length,
        summaries,
      },
      200,
    );
  });
}
