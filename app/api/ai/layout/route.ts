import { generateLayout } from "@/lib/ai/layout";
import { resolveAiTenantExecutionIds } from "@/lib/auth/resolveAiTenant";
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

/**
 * POST { prompt: string }
 * Returns { blocks } — CMS-compatible draft; never saved server-side.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_layout");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const prompt = typeof o?.prompt === "string" ? o.prompt.trim() : "";

  if (!prompt) {
    return errJson(requestId, "prompt is required", 422);
  }

  if (prompt.length > 12_000) {
    return errJson(requestId, "Prompt too long", 413);
  }

  const tenant = await resolveAiTenantExecutionIds({
    rid: requestId,
    bodyCompanyId: typeof o?.companyId === "string" ? o.companyId : "",
    bodyUserId: typeof o?.userId === "string" ? o.userId : "",
  });
  if (tenant.ok === false) {
    return errJson(requestId, tenant.err.error, tenant.err.status, tenant.err.message);
  }
  const { companyId, userId } = tenant;

  try {
    const { blocks } = await generateLayout(prompt, { companyId, userId });
    return okJson(requestId, { blocks }, 200);
  } catch {
    return errJson(requestId, "Layout generation failed", 500);
  }
  });
}
