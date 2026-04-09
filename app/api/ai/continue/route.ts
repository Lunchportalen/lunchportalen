import { generateContinuation, type ContinuationContext } from "@/lib/ai/continuation";
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
 * Returns multi-line continuation; never auto-applied by the server.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_continue");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const text = typeof o?.text === "string" ? o.text : "";
  const ctxRaw = o?.context;

  const context: ContinuationContext = {};
  if (isPlainObject(ctxRaw)) {
    if (typeof ctxRaw.pageTitle === "string") context.pageTitle = ctxRaw.pageTitle;
    if (typeof ctxRaw.heading === "string") context.heading = ctxRaw.heading;
    if (typeof ctxRaw.blockId === "string") context.blockId = ctxRaw.blockId;
  }

  try {
    const { continuation } = generateContinuation(text, context);
    return okJson(requestId, { continuation }, 200);
  } catch {
    return okJson(requestId, { continuation: "" }, 200);
  }
  });
}
