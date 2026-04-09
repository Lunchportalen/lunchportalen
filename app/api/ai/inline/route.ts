import { renderGhostText } from "@/lib/ai/ghostText";
import { generateInlineCompletion, type InlineContext } from "@/lib/ai/inline";
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * POST { text: string, context?: { pageTitle?, heading?, blockId? } }
 * Returns suffix-only completion for ghost UI (no duplication of typed prefix).
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_inline");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const text = typeof o?.text === "string" ? o.text : "";
  const ctxRaw = o?.context;

  const context: InlineContext = {};
  if (isPlainObject(ctxRaw)) {
    if (typeof ctxRaw.pageTitle === "string") context.pageTitle = ctxRaw.pageTitle;
    if (typeof ctxRaw.heading === "string") context.heading = ctxRaw.heading;
    if (typeof ctxRaw.blockId === "string") context.blockId = ctxRaw.blockId;
  }

  try {
    const { completion: raw } = generateInlineCompletion(text, context);
    const completion = renderGhostText(text, raw).slice(0, 320);
    return okJson(requestId, { completion }, 200);
  } catch {
    return okJson(requestId, { completion: "" }, 200);
  }
  });
}
