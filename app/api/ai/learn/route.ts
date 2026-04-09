import { learnFromExperiment } from "@/lib/ai/learning";
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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * POST { experimentId } — aggregate results → learning signals → ai_learning_patterns.
 * Same shape as /api/ai/analyze: validate JSON, call domain code. Does not modify CMS pages.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_learn");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const experimentId = typeof o?.experimentId === "string" ? o.experimentId.trim() : "";
  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) kreves.", 422);
  }

  const out = await learnFromExperiment(experimentId);
  if (out.ok === false) {
    return errJson(requestId, out.error, 422);
  }

  try {
    const { onEvent } = await import("@/lib/pos/eventHandler");
    onEvent({ type: "variant_performance_updated", experiment_id: experimentId });
  } catch {
    /* POS etter vellykket læring */
  }

  return okJson(requestId, { learned: true }, 200);
  });
}
