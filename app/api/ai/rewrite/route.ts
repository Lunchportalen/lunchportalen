import { rewriteText } from "@/lib/ai/rewrite";
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
 * POST { text: string, intent?: string }
 * Rewrites selection-sized text; never auto-applied by the server.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_rewrite");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const text = typeof o?.text === "string" ? o.text : "";
  const intent = typeof o?.intent === "string" && o.intent.trim() ? o.intent.trim() : "clearer";

  if (text.length > 12000) {
    return errJson(requestId, "Text too long", 413);
  }

  try {
    const { rewritten } = rewriteText(text, intent);
    return okJson(requestId, { rewritten }, 200);
  } catch {
    return okJson(requestId, { rewritten: text }, 200);
  }
  });
}
