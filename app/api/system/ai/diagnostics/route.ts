/**
 * GET /api/system/ai/diagnostics
 * AI system self-diagnostics: provider, capabilities, safety filter, output validation, governance.
 * Auth: superadmin only (same as system AI health).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { getAiProviderConfig } from "@/lib/ai/provider";
import { listCapabilities } from "@/lib/ai/capabilityRegistry";
import { isUnsafe } from "@/lib/ai/safety/aiSafetyFilter";
import { validateAiOutput } from "@/lib/ai/validation/validateAiOutput";
import {
  AI_POLICY_REQUIRE_OUTPUT_FILTER,
  AI_POLICY_DEFAULT_RATE_LIMIT,
} from "@/lib/ai/governance/aiPolicy";

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

type DiagnosticCheck = {
  name: string;
  status: "pass" | "fail" | "warn";
  message?: string;
  detail?: unknown;
};

export type AiDiagnosticsPayload = {
  ok: true;
  rid: string;
  status: "ok" | "degraded" | "partial";
  checks: {
    provider: DiagnosticCheck;
    capabilities: DiagnosticCheck;
    safetyFilter: DiagnosticCheck;
    outputValidation: DiagnosticCheck;
    governance: DiagnosticCheck;
  };
  summary: string;
};

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);

  if (!hasCtx(s)) {
    return pickResponse(s as { res?: Response; response?: Response } | null);
  }

  const denied = requireRoleOr403(s.ctx, "system.ai.diagnostics", allowedRoles);

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
    const checks: AiDiagnosticsPayload["checks"] = {
      provider: { name: "provider", status: "pass", message: "", detail: undefined },
      capabilities: { name: "capabilities", status: "pass", message: "", detail: undefined },
      safetyFilter: { name: "safetyFilter", status: "pass", message: "", detail: undefined },
      outputValidation: { name: "outputValidation", status: "pass", message: "", detail: undefined },
      governance: { name: "governance", status: "pass", message: "", detail: undefined },
    };

    // Provider
    const provider = getAiProviderConfig();
    if (!provider.enabled) {
      checks.provider.status = "warn";
      checks.provider.message = "AI provider disabled (missing key or config).";
      checks.provider.detail = {
        provider: provider.provider,
        model: provider.model,
        errorCode: provider.errorCode,
      };
    } else {
      checks.provider.detail = {
        provider: provider.provider,
        model: provider.model,
        enabled: true,
      };
    }

    // Capabilities
    const capabilities = listCapabilities();
    if (capabilities.length === 0) {
      checks.capabilities.status = "warn";
      checks.capabilities.message = "No capabilities registered (import capability modules to register).";
    }
    checks.capabilities.detail = {
      count: capabilities.length,
      names: capabilities.map((c) => c.name),
    };

    // Safety filter
    const unsafeTest = isUnsafe("<script>alert(1)</script>");
    const safeTest = isUnsafe("plain text");
    if (unsafeTest.safe !== false || safeTest.safe !== true) {
      checks.safetyFilter.status = "fail";
      checks.safetyFilter.message = "Safety filter did not behave as expected.";
      checks.safetyFilter.detail = { unsafeTest, safeTest };
    } else {
      checks.safetyFilter.detail = { unsafeRejected: true, safeAccepted: true };
    }

    // Output validation
    const schema = {
      type: "object" as const,
      properties: { a: { type: "string" as const } },
      required: ["a" as const],
    };
    const invalidResult = validateAiOutput({}, schema, { allowAdditionalProperties: false });
    const validResult = validateAiOutput({ a: "b" }, schema, { allowAdditionalProperties: false });
    if (!invalidResult.ok && validResult.ok && validResult.data?.a === "b") {
      checks.outputValidation.detail = { schemaCheck: "pass", stripHtmlAvailable: true };
    } else {
      checks.outputValidation.status = "fail";
      checks.outputValidation.message = "Output validation did not behave as expected.";
      checks.outputValidation.detail = {
        invalidResult: invalidResult.ok ? "expected fail" : "fail",
        validResult: validResult.ok ? "pass" : "expected pass",
      };
    }

    // Governance
    checks.governance.detail = {
      requireOutputFilter: AI_POLICY_REQUIRE_OUTPUT_FILTER,
      defaultRateLimit: AI_POLICY_DEFAULT_RATE_LIMIT,
    };

    const failed = (Object.values(checks) as DiagnosticCheck[]).filter((c) => c.status === "fail");
    const warned = (Object.values(checks) as DiagnosticCheck[]).filter((c) => c.status === "warn");

    const status: "ok" | "degraded" | "partial" =
      failed.length > 0 ? "partial" : warned.length > 0 ? "degraded" : "ok";

    const summary =
      failed.length > 0
        ? `${failed.length} check(s) failed, ${warned.length} warning(s).`
        : warned.length > 0
          ? `All critical checks passed; ${warned.length} warning(s).`
          : "All self-diagnostics passed.";

    const payload: AiDiagnosticsPayload = {
      ok: true,
      rid: s.ctx.rid,
      status,
      checks,
      summary,
    };

    return jsonOk(s.ctx.rid, payload, 200);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(s.ctx.rid, "AI diagnostics feilet.", 500, "ai_diagnostics_failed", { message });
  }
}
