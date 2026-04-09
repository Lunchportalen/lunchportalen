import { logActivity } from "@/lib/ai/logActivity";
import { runAutoOptimization } from "@/lib/ai/optimizer";
import { resolveAiTenantExecutionIds } from "@/lib/auth/resolveAiTenant";
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
  const rid = makeRid("ai_optimize");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    logActivity({
      rid,
      action: "audit",
      status,
      duration: Date.now() - start,
      metadataExtra: { route: "api/ai/optimize", ...meta },
    });
  };

  try {
    let payload: unknown = null;
    try {
      payload = await req.json();
    } catch {
      logEnd("error", { code: "INVALID_JSON" });
      return errJson(rid, "Invalid JSON", 400);
    }

    const body = payload as { content?: unknown; metrics?: unknown; companyId?: unknown; userId?: unknown };
    if (body.content !== undefined && !isPlainObject(body.content)) {
      logEnd("error", { code: "INVALID_CONTENT" });
      return errJson(rid, "content must be a JSON object", 422);
    }

    const tenant = await resolveAiTenantExecutionIds({
      rid,
      bodyCompanyId: typeof body.companyId === "string" ? body.companyId : "",
      bodyUserId: typeof body.userId === "string" ? body.userId : "",
    });
    if (tenant.ok === false) {
      logEnd("error", { code: tenant.err.code });
      return errJson(rid, tenant.err.error, tenant.err.status, tenant.err.message);
    }
    const { companyId, userId } = tenant;

    const result = await runAutoOptimization(body.content === undefined ? {} : body.content, { companyId, userId }, body.metrics);

    logEnd("success", { variantCount: result.variants.length, delta: result.delta });
    return okJson(
      rid,
      {
        currentScore: result.currentScore,
        improvedScore: result.improvedScore,
        delta: result.delta,
        variants: result.variants,
        scores: result.scores,
        recommendations: result.recommendations,
        editorPrep: result.editorPrep,
      },
      200,
    );
  } catch {
    logEnd("error", { code: "ERROR", thrown: true });
    return errJson(rid, "Optimization failed", 500);
  }
  });
}
