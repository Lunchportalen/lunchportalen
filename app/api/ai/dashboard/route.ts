import { buildDashboard } from "@/lib/ai/dashboard";
import type { DecisionInputData } from "@/lib/ai/decisionEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

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

function parseNum(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /api/ai/dashboard?conversionRate=&traffic=&engagementScore=&revenueProxy=&seoOrganicDelta=&funnelDropRate=
 * Returns metrics, insights, decisions (with policy + preview), actions — read-only aggregation.
 */
export async function GET(req: Request) {
  return withApiAiEntrypoint(req, "GET", async () => {
  const requestId = makeRid("ai_dashboard");
  try {
    const url = new URL(req.url);
    const override: Partial<DecisionInputData> = {
      conversionRate: parseNum(url.searchParams.get("conversionRate")),
      traffic: parseNum(url.searchParams.get("traffic")),
      engagementScore: parseNum(url.searchParams.get("engagementScore")),
      revenueProxy: parseNum(url.searchParams.get("revenueProxy")),
      seoOrganicDelta: parseNum(url.searchParams.get("seoOrganicDelta")),
      funnelDropRate: parseNum(url.searchParams.get("funnelDropRate")),
    };
    const cleaned = Object.fromEntries(
      Object.entries(override).filter(([, val]) => val !== undefined),
    ) as Partial<DecisionInputData>;

    const bundle = buildDashboard(Object.keys(cleaned).length ? cleaned : undefined);
    const { metrics, insights, decisions, actions } = bundle;

    return okJson(
      requestId,
      {
        metrics,
        insights,
        decisions: decisions.map((d) => ({
          decision: d.decision,
          policy: d.policy,
          preview: {
            executed: d.automationPreview.executed,
            actionPreview: d.automationPreview.actionPreview,
            explain: d.automationPreview.explain,
          },
        })),
        actions,
      },
      200,
    );
  } catch {
    return errJson(requestId, "Dashboard build failed", 500);
  }
  });
}
