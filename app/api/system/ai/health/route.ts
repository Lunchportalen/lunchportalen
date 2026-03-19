/**
 * GET /api/system/ai/health
 * AI capability health: provider config (no secrets), registered capabilities, status.
 * Auth: superadmin only (same as system health).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { getAiProviderConfig } from "@/lib/ai/provider";
import { listCapabilities } from "@/lib/ai/capabilityRegistry";

const allowedRoles = ["superadmin"] as const;

function pickResponse(x: { res?: Response; response?: Response } | Response | null): Response {
  if (x instanceof Response) return x;
  const r = x?.res ?? x?.response;
  if (r) return r;
  return jsonErr("no_rid", "Role-guard returnerte ingen Response.", 500, "guard_contract_mismatch");
}

function hasCtx(x: unknown): x is { ctx: { rid: string } } {
  return !!x && typeof x === "object" && x !== null && "ctx" in x && (x as { ctx: unknown }).ctx != null;
}

export type AiHealthPayload = {
  ok: true;
  rid: string;
  status: "ok" | "degraded";
  provider: {
    enabled: boolean;
    provider: string;
    model: string;
    errorCode?: string;
  };
  capabilities: Array<{ name: string; description: string }>;
  capabilityCount: number;
};

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);

  if (!hasCtx(s)) {
    return pickResponse(s as { res?: Response; response?: Response } | null);
  }

  const denied = requireRoleOr403(s.ctx, "system.ai.health", allowedRoles);

  if (denied) {
    if (denied instanceof Response) return denied;
    if (typeof denied === "object" && ("res" in denied || "response" in denied)) {
      return pickResponse(denied as { res?: Response; response?: Response });
    }
    return jsonErr(
      s.ctx.rid,
      "Role-guard returnerte ukjent type.",
      500,
      "guard_contract_mismatch",
      { typeofDenied: typeof denied }
    );
  }

  try {
    const provider = getAiProviderConfig();
    const capabilities = listCapabilities();

    const status: "ok" | "degraded" = provider.enabled ? "ok" : "degraded";

    const payload: AiHealthPayload = {
      ok: true,
      rid: s.ctx.rid,
      status,
      provider: {
        enabled: provider.enabled,
        provider: provider.provider,
        model: provider.model,
        ...(provider.errorCode ? { errorCode: provider.errorCode } : {}),
      },
      capabilities: capabilities.map((c) => ({
        name: c.name,
        description: c.description ?? "",
      })),
      capabilityCount: capabilities.length,
    };

    return jsonOk(s.ctx.rid, payload, 200);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(s.ctx.rid, "AI health check feilet.", 500, "ai_health_failed", { message });
  }
}
