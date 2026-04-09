import { createExperiment } from "@/lib/ai/experiment";
import { logActivity } from "@/lib/ai/logActivity";
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
  const rid = makeRid("ai_experiments");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    logActivity({
      rid,
      action: "audit",
      status,
      duration: Date.now() - start,
      metadataExtra: { route: "api/ai/experiments", ...meta },
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

    const body = payload as { contentId?: unknown; content?: unknown; companyId?: unknown; userId?: unknown };
    const contentId = typeof body.contentId === "string" ? body.contentId.trim() : "";
    if (!contentId) {
      logEnd("error", { code: "INVALID_CONTENT_ID" });
      return errJson(rid, "contentId is required", 422);
    }
    if (body.content === undefined || !isPlainObject(body.content)) {
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

    const experiment = await createExperiment(contentId, body.content as Record<string, unknown>, {
      companyId,
      userId,
    });

    logEnd("success", { experimentId: experiment.id, variantCount: experiment.variants.length });
    return okJson(rid, { experiment }, 200);
  } catch {
    logEnd("error", { code: "ERROR", thrown: true });
    return errJson(rid, "Experiment preparation failed", 500);
  }
  });
}
