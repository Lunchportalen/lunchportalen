import { generateFullPage, generateSection } from "@/lib/ai/generator";
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
  const rid = makeRid("ai_generate");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    logActivity({
      rid,
      action: "improve",
      status,
      duration: Date.now() - start,
      metadataExtra: { route: "api/ai/generate", ...meta },
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

    const body = payload as { prompt?: unknown; context?: unknown; companyId?: unknown; userId?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const context = body.context;

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
    const aiCtx = { companyId, userId };

    if (context !== undefined && !isPlainObject(context)) {
      logEnd("error", { code: "INVALID_CONTEXT" });
      return errJson(rid, "context must be a JSON object", 422);
    }

    const hasPrompt = prompt.length > 0;
    const hasContext = isPlainObject(context) && Object.keys(context).length > 0;

    if (!hasPrompt && !hasContext) {
      logEnd("error", { code: "EMPTY_INPUT" });
      return errJson(rid, "Provide prompt and/or non-empty context", 422);
    }

    let blocks;
    if (hasPrompt && !hasContext) {
      blocks = (await generateSection(prompt, aiCtx)).blocks;
    } else if (!hasPrompt && hasContext) {
      blocks = (await generateFullPage(context, aiCtx)).blocks;
    } else {
      blocks = (
        await generateFullPage(
          {
            ...(context as Record<string, unknown>),
            _instruction: prompt,
          },
          aiCtx,
        )
      ).blocks;
    }

    logEnd("success", { blockCount: blocks.length });
    return okJson(rid, { blocks }, 200);
  } catch {
    logEnd("error", { code: "ERROR", thrown: true });
    return errJson(rid, "Generation failed", 500);
  }
  });
}
