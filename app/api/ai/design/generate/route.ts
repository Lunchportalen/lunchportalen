import { generateDesignFixes } from "@/lib/ai/designGenerator";
import { getCmsDesignTokens } from "@/lib/ai/designTokens";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_BLOCKS = 200;
const MAX_BODY_CHARS = 1_500_000;

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
 * POST { blocks: unknown[] }
 * Returns { updatedBlocks, suggestions } — preview only; client must approve before applying.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_design_generate");
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return errJson(requestId, "Invalid body", 400);
  }

  if (raw.length > MAX_BODY_CHARS) {
    return errJson(requestId, "Body too large", 413);
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return errJson(requestId, "Invalid JSON", 400);
  }

  const o = isPlainObject(body) ? body : null;
  const blocks = o && Array.isArray(o.blocks) ? o.blocks : null;

  if (!blocks) {
    return errJson(requestId, "blocks array is required", 422);
  }

  if (blocks.length > MAX_BLOCKS) {
    return errJson(requestId, `At most ${MAX_BLOCKS} blocks`, 413);
  }

  try {
    const tokens = getCmsDesignTokens();
    const { updatedBlocks, suggestions } = generateDesignFixes(blocks, tokens);
    return okJson(requestId, { updatedBlocks, suggestions }, 200);
  } catch {
    return errJson(requestId, "Design generation failed", 500);
  }
  });
}
