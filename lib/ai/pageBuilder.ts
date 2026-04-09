import "server-only";

/**
 * Page CMS AI: component JSON only — validated via {@link validateComponents} / {@link normalizeValidatedBlocksToCmsFlat}.
 * No HTML/JSX in model output (rejected before parse).
 */
import {
  extractBlocksArrayFromModelJson,
  normalizeValidatedBlocksToCmsFlat,
  rejectRawMarkupInModelResponse,
  validateBlocks,
} from "@/lib/ai/blockSchema";
import {
  buildPageBuilderUserPrompt,
  pageBuilderSystemPrompt,
  type PageBuilderUserPromptOptions,
} from "@/lib/ai/pageBuilderPrompts";
import {
  buildDeterministicLayout,
  ensureTrailingCta,
  type AiLayoutRunContext,
  type CmsSerializedBlock,
} from "@/lib/ai/layout";
import { AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";
import { enrichPageBuilderBlocks } from "@/lib/ai/enrichPageBuilderBlocks";
import {
  makeTenantAiCacheKey,
  peekTransientAiJson,
  storeTransientAiJson,
} from "@/lib/ai/transientAiJsonCache";

/** Serialized blocks returned to the editor / API (flat CMS shape + id). */
export type PageBuilderDraftBlock = Record<string, unknown>;

async function callOpenAiPageJson(
  ctx: AiLayoutRunContext,
  user: string,
  mode: "soft" | "strict",
): Promise<unknown | null> {
  const userSlice = user.slice(0, 12_000);
  if (mode === "soft") {
    const cacheKey = makeTenantAiCacheKey(ctx.companyId, ctx.userId, "PAGE_CMS_SOFT", userSlice);
    const hit = peekTransientAiJson(cacheKey);
    if (hit != null && (typeof hit === "object" || Array.isArray(hit))) {
      return hit;
    }
  }
  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool: AI_RUNNER_TOOL.PAGE_CMS,
      input: {
        system: pageBuilderSystemPrompt(),
        user: userSlice,
        temperature: 0.55,
        max_tokens: 4096,
      },
    });
    if (mode === "soft" && result != null && (typeof result === "object" || Array.isArray(result))) {
      storeTransientAiJson(makeTenantAiCacheKey(ctx.companyId, ctx.userId, "PAGE_CMS_SOFT", userSlice), result);
    }
    if (result != null && (typeof result === "object" || Array.isArray(result))) {
      return result;
    }
    if (mode === "strict") {
      throw new Error("Modellen returnerte ikke gyldig JSON for CMS-blokker.");
    }
    return null;
  } catch (e) {
    if (mode === "strict") {
      throw e;
    }
    return null;
  }
}

/**
 * Parses model JSON, rejects HTML leakage, validates against {@link BLOCK_SCHEMA},
 * assigns ids, maps AI field names to CMS fields. Never returns raw markup.
 */
function parseAndNormalizeSchemaBlocks(parsed: unknown): PageBuilderDraftBlock[] {
  const serialized = JSON.stringify(parsed ?? null);
  rejectRawMarkupInModelResponse(serialized);

  const rawBlocks = extractBlocksArrayFromModelJson(parsed);
  const validated = validateBlocks(rawBlocks);
  const flat = normalizeValidatedBlocksToCmsFlat(validated) as PageBuilderDraftBlock[];
  return enrichPageBuilderBlocks(flat);
}

function derivePageTitleFromBlocks(blocks: PageBuilderDraftBlock[], fallback: string): string {
  const first = blocks[0];
  if (!first) return fallback.slice(0, 200);
  const t = typeof first.title === "string" ? first.title.trim() : "";
  if (t) return t.slice(0, 200);
  const h = typeof first.heading === "string" ? first.heading.trim() : "";
  if (h) return h.slice(0, 200);
  const tx = typeof first.text === "string" ? first.text.trim() : "";
  if (tx) return tx.slice(0, 200);
  return fallback.slice(0, 200);
}

/**
 * Strict full page draft: validates AI JSON against {@link BLOCK_SCHEMA}, no deterministic fallback.
 * Used for preview-first editor flows.
 */
export async function generatePageStrict(
  prompt: string,
  ctx: AiLayoutRunContext,
  opts?: PageBuilderUserPromptOptions,
): Promise<{ title: string; blocks: PageBuilderDraftBlock[] }> {
  const p = typeof prompt === "string" ? prompt.trim() : "";
  if (!p) {
    throw new Error("MISSING_PROMPT");
  }

  const user = buildPageBuilderUserPrompt(p, opts);
  const parsed = await callOpenAiPageJson(ctx, user, "strict");
  if (!parsed) {
    throw new Error("Kunne ikke lese svar fra modellen.");
  }

  const blocks = parseAndNormalizeSchemaBlocks(parsed);
  if (blocks.length === 0) {
    throw new Error("Ingen gyldige blokker etter normalisering.");
  }

  const title = derivePageTitleFromBlocks(blocks, "Ny side");
  return { title, blocks };
}

/**
 * Full page draft (title + blocks). Preview-only; never persisted here.
 * Soft path: deterministic fallback when AI output is empty or invalid.
 */
export async function generatePage(
  prompt: string,
  ctx: AiLayoutRunContext,
): Promise<{ title: string; blocks: Array<CmsSerializedBlock | PageBuilderDraftBlock> }> {
  const p = typeof prompt === "string" ? prompt.trim() : "";
  const fallbackTitle = p.split("\n")[0]?.trim().slice(0, 120) || "Ny side";

  if (!p) {
    return { title: fallbackTitle, blocks: [] };
  }

  const user = buildPageBuilderUserPrompt(p);
  const parsed = await callOpenAiPageJson(ctx, user, "soft");

  if (parsed != null) {
    try {
      const schemaBlocks = parseAndNormalizeSchemaBlocks(parsed);
      if (schemaBlocks.length > 0) {
        const title = derivePageTitleFromBlocks(schemaBlocks, fallbackTitle);
        return { title, blocks: schemaBlocks };
      }
    } catch {
      /* fall back to deterministic layout — still blocks only, never raw HTML */
    }
  }

  let blocks: CmsSerializedBlock[] = buildDeterministicLayout(p);
  let title = fallbackTitle;
  if (blocks[0]?.type === "hero") {
    title = blocks[0].title.slice(0, 120) || title;
  }

  blocks = ensureTrailingCta(blocks);
  return { title, blocks };
}
