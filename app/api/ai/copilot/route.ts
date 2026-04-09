import { runCopilot } from "@/lib/ai/copilot";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { buildContext, sliceBlocksForFocus, type CopilotFullPageInput } from "@/lib/ai/context";
import type { CMSContentInput } from "@/lib/ai/types";
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * POST { content?: { title?, blocks? }, context?: { focusBlockId? } }
 * Uses focused window of blocks for speed; same response contract as other /api/ai/* routes.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_copilot");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const contentRaw = o?.content;
  const ctxRaw = o?.context;

  const title =
    isPlainObject(contentRaw) && typeof contentRaw.title === "string" ? contentRaw.title : "";
  const blocks = isPlainObject(contentRaw) && Array.isArray(contentRaw.blocks) ? contentRaw.blocks : [];

  const focusBlockId =
    isPlainObject(ctxRaw) && typeof ctxRaw.focusBlockId === "string" ? ctxRaw.focusBlockId.trim() : "";

  const fullPage: CopilotFullPageInput = { title, blocks };
  const built = buildContext(focusBlockId || null, fullPage);
  const windowBlocks = sliceBlocksForFocus(fullPage, built.focusIndex, 1);
  const cms: CMSContentInput = {
    title,
    blocks: windowBlocks,
  };

  const { suggestions } = runCopilot(cms, built);
  return okJson(requestId, { suggestions }, 200);
  });
}
