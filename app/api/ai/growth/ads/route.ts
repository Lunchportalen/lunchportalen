import { generateAds } from "@/lib/ai/adsEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_BODY_CHARS = 100_000;

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
 * POST { product: string, audience?: string, locale?: "nb"|"en" }
 * Returns { headlines, descriptions } — copy only; no campaigns or spend.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_growth_ads");
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
  const product = typeof o?.product === "string" ? o.product.trim() : "";
  if (!product) {
    return errJson(requestId, "product is required", 422);
  }

  const audience = typeof o.audience === "string" ? o.audience.trim() : undefined;
  const locale = o.locale === "en" || o.locale === "nb" ? o.locale : undefined;

  try {
    const out = generateAds({ product, audience, locale });
    return okJson(requestId, { headlines: out.headlines, descriptions: out.descriptions }, 200);
  } catch {
    return errJson(requestId, "Ads generation failed", 500);
  }
  });
}
