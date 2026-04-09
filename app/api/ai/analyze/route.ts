import { runAIAnalysis } from "@/lib/ai/engine";
import { logActivity } from "@/lib/ai/logActivity";
import { makeRid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const rid = makeRid("ai_analyze");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    logActivity({
      rid,
      action: "audit",
      status,
      duration: Date.now() - start,
      metadataExtra: { route: "api/ai/analyze", ...meta },
    });
  };

  try {
    let payload: unknown = null;
    try {
      payload = await req.json();
    } catch {
      logEnd("error", { code: "INVALID_JSON" });
      return errJson(rid, "Invalid_JSON", 400);
    }

    const body = payload as { content?: unknown };
    const content = body?.content;

    if (content !== undefined && !isPlainObject(content)) {
      logEnd("error", { code: "INVALID_CONTENT" });
      return errJson(rid, "INVALID_CONTENT", 422, "content must be a JSON object");
    }

    const result = await runAIAnalysis(content === undefined ? {} : content);

    logEnd("success", { score: result.score });
    return okJson(
      rid,
      {
        score: result.score,
        baseScore: result.baseScore,
        seo: result.seo,
        cro: result.cro,
        suggestions: result.suggestions,
        editorPrep: result.editorPrep,
        learnedInsights: result.learnedInsights,
      },
      200,
    );
  } catch {
    logEnd("error", { code: "ERROR", thrown: true });
    return errJson(rid, "ANALYSIS_FAILED", 500);
  }
  });
}
