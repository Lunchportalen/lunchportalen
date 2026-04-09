import { buildFunnel, type FunnelAnalytics, type FunnelContent } from "@/lib/ai/funnelEngine";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_BODY_CHARS = 300_000;

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

function coerceFunnelContent(raw: unknown): FunnelContent {
  if (!isPlainObject(raw)) return {};
  const bt = raw.blockTypes;
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    primaryCta: typeof raw.primaryCta === "string" ? raw.primaryCta : undefined,
    blockTypes: Array.isArray(bt) ? bt.map(String) : undefined,
    hasHero: typeof raw.hasHero === "boolean" ? raw.hasHero : undefined,
    hasLeadForm: typeof raw.hasLeadForm === "boolean" ? raw.hasLeadForm : undefined,
  };
}

function coerceFunnelAnalytics(raw: unknown): FunnelAnalytics {
  if (!isPlainObject(raw)) return {};
  const stepsRaw = raw.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw
        .map((s) => {
          if (!isPlainObject(s)) return null;
          return {
            name: typeof s.name === "string" ? s.name : "Steg",
            users: typeof s.users === "number" ? s.users : undefined,
            rate: typeof s.rate === "number" ? s.rate : undefined,
          };
        })
        .filter(Boolean)
    : undefined;

  return {
    steps: steps as FunnelAnalytics["steps"],
    bounced: typeof raw.bounced === "number" ? raw.bounced : undefined,
    converted: typeof raw.converted === "number" ? raw.converted : undefined,
  };
}

/**
 * POST { content?: object, analytics?: object }
 * Returns { steps, improvements } — analysis only; no CMS mutation.
 */
export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const requestId = makeRid("ai_growth_funnel");
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
  const content = coerceFunnelContent(o?.content);
  const analytics = coerceFunnelAnalytics(o?.analytics);

  try {
    const result = buildFunnel(content, analytics);
    return okJson(requestId, { steps: result.steps, improvements: result.improvements }, 200);
  } catch {
    return errJson(requestId, "Funnel engine failed", 500);
  }
  });
}
