import type { NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { generatePageStructure, generatePageFromStructuredInput } from "@/lib/ai/tools/pageBuilder";
import type { PageComposerInput } from "@/lib/ai/tools/pageBuilder";
import { normalizePageBuilderBlocks } from "@/app/(backoffice)/backoffice/content/_components/pageBuilderNormalize";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";

type Body = {
  prompt?: string;
  locale?: string;
  pageId?: string;
  goal?: string;
  audience?: string;
  tone?: string;
  pageType?: string;
  ctaIntent?: string;
  sectionsInclude?: unknown;
  sectionsExclude?: unknown;
};

function hasStructuredInput(o: Body): boolean {
  return (
    typeof o.goal === "string" ||
    typeof o.audience === "string" ||
    (o.tone !== undefined && o.tone !== null) ||
    (o.pageType !== undefined && o.pageType !== null) ||
    (o.ctaIntent !== undefined && o.ctaIntent !== null) ||
    (Array.isArray(o.sectionsInclude) && o.sectionsInclude.length > 0) ||
    (Array.isArray(o.sectionsExclude) && o.sectionsExclude.length > 0)
  );
}

function parseStructuredInput(o: Body): PageComposerInput {
  const locale = typeof o.locale === "string" && o.locale ? o.locale : "nb";
  const tone =
    o.tone === "warm" || o.tone === "neutral" ? o.tone : "enterprise";
  const pageType =
    o.pageType === "contact" || o.pageType === "info" || o.pageType === "pricing" || o.pageType === "generic"
      ? o.pageType
      : "landing";
  const ctaIntent =
    o.ctaIntent === "demo" || o.ctaIntent === "quote" || o.ctaIntent === "start"
      ? o.ctaIntent
      : "contact";
  const sectionsInclude = Array.isArray(o.sectionsInclude)
    ? (o.sectionsInclude as string[]).filter((s) => typeof s === "string")
    : undefined;
  const sectionsExclude = Array.isArray(o.sectionsExclude)
    ? (o.sectionsExclude as string[]).filter((s) => typeof s === "string")
    : undefined;
  return {
    goal: typeof o.goal === "string" ? o.goal.trim() : undefined,
    audience: typeof o.audience === "string" ? o.audience.trim() : undefined,
    tone,
    pageType,
    ctaIntent,
    sectionsInclude: sectionsInclude?.length ? sectionsInclude : undefined,
    sectionsExclude: sectionsExclude?.length ? sectionsExclude : undefined,
    locale,
    prompt: typeof o.prompt === "string" ? o.prompt.trim() : undefined,
  };
}

const METADATA_MAX = 2000;
function truncateMetadata(obj: unknown): Record<string, unknown> {
  const s = JSON.stringify(obj);
  if (s.length <= METADATA_MAX) return (obj ?? {}) as Record<string, unknown>;
  return { _truncated: true, length: s.length, preview: s.slice(0, METADATA_MAX) } as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  return withApiAiEntrypoint(request, "POST", async () => {
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:page-builder`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  let body: Body;
  try {
    body = (await readJson(request)) ?? {};
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON i body.", 400, "BAD_REQUEST");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const locale = typeof body.locale === "string" && body.locale ? body.locale : "nb";

  const useStructured = hasStructuredInput(body);
  if (!useStructured && !prompt) {
    return jsonErr(ctx.rid, "Mangler prompt eller strukturt intent (goal, audience, pageType, osv.).", 400, "BAD_REQUEST");
  }

  let result: Awaited<ReturnType<typeof generatePageStructure>>;
  try {
    if (useStructured) {
      const input = parseStructuredInput(body);
      result = generatePageFromStructuredInput(input);
    } else {
      result = await generatePageStructure(prompt, locale);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Page builder failed";
    return jsonErr(ctx.rid, msg, 500, "PAGE_BUILDER_FAILED", { detail: String(e) });
  }

  const { blocks: rawBlocks, warnings: toolWarnings = [] } = result;
  const { blocks: normalized, warnings: normWarnings } = normalizePageBuilderBlocks(rawBlocks);

  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "page_compose",
        page_id: typeof body.pageId === "string" ? body.pageId : null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "page_builder",
        environment: "preview",
        locale,
        metadata: truncateMetadata({
          blockCount: normalized.length,
          hasStructuredInput: useStructured,
          pageType: useStructured ? parseStructuredInput(body).pageType : undefined,
        }),
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "page-builder", action: "page_compose", error: error.message });
    }
  } catch (e) {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("ai_activity_log.insert_failed", { route: "page-builder", action: "page_compose", error: e instanceof Error ? e.message : String(e) });
  }

  const responsePayload = {
    title: result.title,
    summary: result.summary,
    blocks: normalized,
    notes: result.notes,
    warnings: [...toolWarnings, ...normWarnings],
  };
  const prepared = prepareAiResponseForClient(responsePayload);
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }
  return jsonOk(ctx.rid, prepared.data, 200);
  });
}
