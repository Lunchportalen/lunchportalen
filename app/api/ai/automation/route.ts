import type { NextRequest } from "next/server";
import { runAutomation, type AutomationMode } from "@/lib/ai/automationEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import type { DecisionResult } from "@/lib/ai/decisionEngine";
import { makeRid } from "@/lib/http/rid";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { trySecurityContextFromRequest } from "@/lib/security/context";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_BODY_CHARS = 200_000;

function okJson(ridValue: string, data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, rid: ridValue, data }), { status, headers: JSON_HEADERS });
}

function errJson(ridValue: string, error: string, status: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      rid: ridValue,
      error,
      message: message ?? error,
      status,
    }),
    { status, headers: JSON_HEADERS },
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

const DECISION_TYPES = new Set([
  "increase_cta_visibility",
  "create_seo_page",
  "pause_underperforming_variant",
  "refresh_content",
  "funnel_optimize",
  "no_action",
]);

function coerceDecision(raw: unknown): DecisionResult | null {
  if (!isPlainObject(raw)) return null;
  const t = raw.decisionType;
  if (typeof t !== "string" || !DECISION_TYPES.has(t)) return null;
  const recommendation = typeof raw.recommendation === "string" ? raw.recommendation : "";
  const reason = typeof raw.reason === "string" ? raw.reason : "";
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;
  const basedOn = Array.isArray(raw.basedOn) ? raw.basedOn.map(String) : [];
  if (!recommendation || !reason) return null;
  return {
    decisionType: t as DecisionResult["decisionType"],
    recommendation,
    confidence,
    reason,
    basedOn,
  };
}

/**
 * POST { decision, mode: "preview" | "execute", approved?: boolean }
 * Returns { result } — default preview; execute never publishes or spends.
 */
export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_automation");
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return errJson(requestId, "Invalid body", 400);
  }

  if (raw.length > MAX_BODY_CHARS) {
    return errJson(requestId, "Body too large", 413);
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = isPlainObject(body) ? body : null;
  const decision = coerceDecision(o?.decision);
  if (!decision) {
    return errJson(requestId, "valid decision object is required", 422);
  }

  const mode = o?.mode === "execute" || o?.mode === "preview" ? (o.mode as AutomationMode) : null;
  if (!mode) {
    return errJson(requestId, 'mode must be "preview" or "execute"', 422);
  }

  const approved = o?.approved === true;

  try {
    const result = runAutomation(decision, { mode, approved });
    void trySecurityContextFromRequest(req).then((sec) => {
      scheduleAuditEvent({
        companyId: sec.companyId,
        userId: sec.userId,
        action: "ai.automation.run",
        resource: "automation_engine",
        metadata: { ip: sec.ip, mode, approved, decisionType: decision.decisionType },
      });
    });
    return okJson(requestId, { result }, 200);
  } catch {
    return errJson(requestId, "Automation engine failed", 500);
  }
  });
}
