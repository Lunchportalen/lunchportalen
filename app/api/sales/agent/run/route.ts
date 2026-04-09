export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { fetchLeadPipelineRows } from "@/lib/db/growthAdminRead";
import { normalizeLeadPipelineRow, type PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { needsFollowUp } from "@/lib/sales/followup";
import { runSalesAgent } from "@/lib/sales/runAgent";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST: kjør salgsagent (utkast kun — ingen utsendelse).
 * Superadmin. Idempotensnøkkel: header `x-idempotency-key` eller body.idempotencyKey.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("sales_agent_run");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  let body: { idempotencyKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const idemHeader = req.headers.get("x-idempotency-key");
  const idempotencyPrefix =
    (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) ||
    (idemHeader && idemHeader.trim()) ||
    rid;

  try {
    const admin = supabaseAdmin();
    const { rows, leadPipelineAvailable } = await fetchLeadPipelineRows(admin, "sales_agent_run");

    if (!leadPipelineAvailable) {
      return jsonOk(
        rid,
        {
          pipelineAvailable: false,
          queue: [],
          selectedLeads: [],
          followUp: [],
          learning: [],
        },
        200,
      );
    }

    const enriched = rows
      .map((r) => normalizeLeadPipelineRow(r))
      .filter((d): d is PipelineDealCard => d != null)
      .map((d) => enrichPipelineDeal(d));

    const actorEmail = gate.ctx.scope?.email ?? null;

    const result = await runSalesAgent(enriched, {
      idempotencyPrefix: idemPrefixSlice(idempotencyPrefix),
      actorEmail,
    });

    const followUp = enriched.map((d) => ({
      dealId: d.id,
      needsFollowUp: needsFollowUp(d),
    }));

    console.log("[SALES_AGENT_API]", { rid, selected: result.selectedLeads.length, idempotencyPrefix: idemPrefixSlice(idempotencyPrefix) });

    await auditLog({
      action: "sales_agent_run",
      entity: "sales",
      metadata: {
        rid,
        queueCount: result.queue.length,
        idempotencyPrefix: idemPrefixSlice(idempotencyPrefix),
      },
    });

    return jsonOk(
      rid,
      {
        pipelineAvailable: true,
        queue: result.queue,
        selectedLeads: result.selectedLeads,
        learning: result.learning,
        followUp,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SALES_AGENT_API_FATAL]", { rid, msg });
    return jsonErr(rid, "Salgsagent feilet.", 500, "SALES_AGENT_FAILED", e);
  }
}

function idemPrefixSlice(s: string): string {
  return s.slice(0, 120);
}
