import { runSeoEngine, type SiteData } from "@/lib/ai/seoEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_BODY_CHARS = 500_000;

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

function coerceSiteData(raw: unknown): SiteData {
  if (!isPlainObject(raw)) return {};
  const pagesRaw = raw.pages;
  const pages = Array.isArray(pagesRaw)
    ? pagesRaw
        .map((p) => {
          if (!isPlainObject(p)) return null;
          return {
            path: typeof p.path === "string" ? p.path : "/",
            title: typeof p.title === "string" ? p.title : undefined,
            keywordHints: Array.isArray(p.keywordHints) ? p.keywordHints.map(String) : undefined,
            impressions: typeof p.impressions === "number" ? p.impressions : undefined,
            clicks: typeof p.clicks === "number" ? p.clicks : undefined,
          };
        })
        .filter(Boolean)
    : undefined;

  return {
    domain: typeof raw.domain === "string" ? raw.domain : undefined,
    locale: typeof raw.locale === "string" ? raw.locale : undefined,
    pages: pages as SiteData["pages"],
    existingKeywords: Array.isArray(raw.existingKeywords) ? raw.existingKeywords.map(String) : undefined,
    competitors: Array.isArray(raw.competitors) ? raw.competitors.map(String) : undefined,
  };
}

/**
 * POST { siteData?: object }
 * Returns { opportunities, keywords, contentIdeas } — suggestions only; no publish.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_growth_seo");
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
  const siteData = coerceSiteData(o?.siteData ?? o);

  try {
    const result = runSeoEngine(siteData);
    return okJson(
      requestId,
      {
        opportunities: result.opportunities,
        keywords: result.keywords,
        contentIdeas: result.contentIdeas,
      },
      200,
    );
  } catch {
    return errJson(requestId, "SEO engine failed", 500);
  }
  });
}
