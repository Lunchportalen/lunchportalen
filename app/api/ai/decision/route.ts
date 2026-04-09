import type { NextRequest } from "next/server";
import { makeDecision, type DecisionInputData } from "@/lib/ai/decisionEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
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

function coerceDecisionData(raw: unknown): DecisionInputData {
  if (!isPlainObject(raw)) return {};
  const o = raw;
  const variantPerformance = Array.isArray(o.variantPerformance)
    ? o.variantPerformance
        .map((v) => {
          if (!isPlainObject(v)) return null;
          return {
            id: typeof v.id === "string" ? v.id : String(v.id ?? ""),
            lift: typeof v.lift === "number" ? v.lift : Number(v.lift),
          };
        })
        .filter((x): x is { id: string; lift: number } => x != null && !Number.isNaN(x.lift))
    : undefined;

  return {
    conversionRate: typeof o.conversionRate === "number" ? o.conversionRate : undefined,
    traffic: typeof o.traffic === "number" ? o.traffic : undefined,
    engagementScore: typeof o.engagementScore === "number" ? o.engagementScore : undefined,
    revenueProxy: typeof o.revenueProxy === "number" ? o.revenueProxy : undefined,
    experimentWinRates: Array.isArray(o.experimentWinRates)
      ? o.experimentWinRates.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
      : undefined,
    variantPerformance,
    seoOrganicDelta: typeof o.seoOrganicDelta === "number" ? o.seoOrganicDelta : undefined,
    funnelDropRate: typeof o.funnelDropRate === "number" ? o.funnelDropRate : undefined,
    notes: typeof o.notes === "string" ? o.notes.slice(0, 4000) : undefined,
  };
}

/**
 * POST { data?: object }
 * Returns { decision } — explainable recommendation only.
 */
export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_decision");
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
  const data = coerceDecisionData(o?.data ?? o);
  const includeIntelligence = o?.includeIntelligence === true;

  try {
    const decision = makeDecision(data);
    void trySecurityContextFromRequest(req).then((sec) => {
      scheduleAuditEvent({
        companyId: sec.companyId,
        userId: sec.userId,
        action: "ai.decision.run",
        resource: "decision_engine",
        metadata: { ip: sec.ip, bodyChars: raw.length },
      });
    });
    if (includeIntelligence) {
      const { getSystemIntelligence } = await import("@/lib/ai/intelligence");
      const intel = await getSystemIntelligence({ limit: 500, recentEventLimit: 40 });
      return okJson(
        requestId,
        {
          decision,
          intelligence: {
            signals: intel.signals,
            trends: intel.trends,
            recentEvents: intel.recentEvents.slice(0, 35),
            learningHistory: intel.learningHistory.slice(0, 20),
            generatedAt: intel.generatedAt,
          },
        },
        200,
      );
    }

    return okJson(requestId, { decision }, 200);
  } catch {
    return errJson(requestId, "Decision engine failed", 500);
  }
  });
}
