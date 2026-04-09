export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { buildPipelineActionsList } from "@/lib/pipeline/buildPipelineActions";
import { executeApprovedPipelineActions } from "@/lib/pipeline/executeActions";
import { executeClosingProposals } from "@/lib/sales/executeClosing";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const TOP_N = 10;
const AGENT_ACTION_TYPES = new Set(["follow_up_now", "revive"]);
const CLOSING_ACTION_TYPES = new Set<string>(["book_meeting"]);

/** GET: prioriter + generer forslag (ingen kjøring). POST: godkjent kjøring av sales agent (krever confirm). */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("pipeline_actions");

  const built = await buildPipelineActionsList(rid);
  if (!built.ok) {
    return jsonErr(rid, built.error ?? "Kunne ikke bygge pipeline-handlinger.", 503, "PIPELINE_ACTIONS_FAILED");
  }

  return jsonOk(
    rid,
    {
      items: built.items.slice(0, TOP_N),
      total: built.items.length,
      autoExecutionAllowed: process.env.PIPELINE_ALLOW_AUTO_EXECUTION === "true",
      autoMaxPerRun: Math.min(5, Math.max(1, parseInt(process.env.PIPELINE_AUTO_MAX ?? "5", 10) || 5)),
    },
    200,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("pipeline_actions_exec");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }

  const confirm = body.confirm === true;
  const leadIdsRaw = body.leadIds;
  const leadIds = Array.isArray(leadIdsRaw)
    ? leadIdsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (!confirm) {
    return jsonErr(rid, "Bekreft med confirm: true.", 422, "CONFIRM_REQUIRED");
  }

  if (leadIds.length === 0) {
    return jsonErr(rid, "leadIds er påkrevd.", 422, "LEAD_IDS_REQUIRED");
  }

  const built = await buildPipelineActionsList(rid, { skipLog: true });
  if (!built.ok) {
    return jsonErr(rid, built.error ?? "Kunne ikke bygge pipeline-handlinger.", 503, "PIPELINE_ACTIONS_FAILED");
  }

  const itemByLead = new Map((built.items ?? []).map((i) => [i.leadId, i]));

  const forAgent: string[] = [];
  const forClosing: string[] = [];
  for (const id of leadIds) {
    const item = itemByLead.get(id);
    if (!item) continue;
    if (AGENT_ACTION_TYPES.has(item.action.type)) forAgent.push(id);
    else if (CLOSING_ACTION_TYPES.has(item.action.type)) forClosing.push(id);
  }

  if (forAgent.length === 0 && forClosing.length === 0) {
    return jsonErr(
      rid,
      "Ingen av valgte leads har en kjørbar handling (follow_up_now, revive eller book_meeting).",
      422,
      "NO_ACTIONABLE_LEADS",
    );
  }

  const email = typeof gate.ctx.scope.email === "string" ? gate.ctx.scope.email : null;

  const execAgent =
    forAgent.length > 0
      ? await executeApprovedPipelineActions(forAgent, { rid, actorEmail: email })
      : { ok: true, results: [] as Array<{ leadId: string; executed: boolean; error?: string }>, queueLength: undefined as number | undefined };

  const execClosing =
    forClosing.length > 0
      ? await executeClosingProposals(forClosing, {
          rid,
          prioritized: built.prioritized,
          items: built.items,
          mode: "pipeline",
        })
      : { ok: true, results: [] as Array<{ leadId: string; status: string }> };

  const merged = [
    ...execAgent.results.map((r) => ({
      leadId: r.leadId,
      executed: r.executed,
      error: r.error,
      channel: "sales_agent" as const,
    })),
    ...execClosing.results.map((r) => ({
      leadId: r.leadId,
      executed: r.status === "meeting_proposed",
      error: r.status === "failed" ? "closing_failed" : undefined,
      channel: "closing_draft" as const,
      closingStatus: r.status,
    })),
  ];

  return jsonOk(
    rid,
    {
      ok: execAgent.ok && execClosing.ok,
      results: merged,
      queueLength: execAgent.queueLength ?? null,
      closing: {
        ok: execClosing.ok,
        proposed: execClosing.results.filter((r) => r.status === "meeting_proposed").length,
      },
    },
    200,
  );
}
