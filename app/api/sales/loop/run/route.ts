export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { executeSalesLoop } from "@/lib/sales/executeLoop";
import { runSalesLoop } from "@/lib/sales/loop";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * POST: plan (default) eller godkjent utkast-lagring — aldri e-post/LinkedIn her.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("sales_loop");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const mode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "plan";
  const run = await runSalesLoop(rid);

  if (!run.ok) {
    return jsonErr(rid, run.error ?? "Sales loop feilet.", 503, "SALES_LOOP_FAILED");
  }

  if (mode !== "execute") {
    return jsonOk(
      rid,
      {
        dryRun: run.dryRun,
        salesLoopMode: run.salesLoopMode ?? null,
        prioritized: run.prioritizedPreview,
        actions: run.actions,
        readyToCloseCount: run.readyToCloseCount,
        maxActionsPerRun: 10,
      },
      200,
    );
  }

  const confirm = body.confirm === true;
  if (!confirm) {
    return jsonErr(rid, "Utførelse krever confirm: true.", 422, "CONFIRM_REQUIRED");
  }

  const leadIdsRaw = body.leadIds;
  const leadIds = Array.isArray(leadIdsRaw)
    ? [...new Set(leadIdsRaw.filter((x): x is string => typeof x === "string" && x.length > 0))]
    : [];

  if (leadIds.length === 0) {
    return jsonErr(rid, "leadIds er påkrevd for utførelse.", 422, "LEAD_IDS_REQUIRED");
  }

  const allowed = new Set(run.actions.map((a) => a.leadId));
  const filtered = leadIds.filter((id) => allowed.has(id));

  if (filtered.length === 0) {
    return jsonErr(
      rid,
      "Ingen av leadIds matcher gjeldende salgsloop-forslag (maks 10, cooldown kan gjelde).",
      422,
      "NO_MATCHING_LEADS",
    );
  }

  const toRun = run.actions
    .filter((a) => filtered.includes(a.leadId))
    .map((a) => ({ ...a, approved: true }));

  const exec = await executeSalesLoop(toRun, { rid });

  return jsonOk(
    rid,
    {
      dryRun: run.dryRun,
      results: exec.results,
      ok: exec.ok,
    },
    200,
  );
}
