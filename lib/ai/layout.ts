import "server-only";

import { designTokensPromptFragment } from "@/lib/ai/designTokens";
import { AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";
import {
  type CmsSerializedBlock,
  normalizeLayoutBlocks,
  ensureTrailingCta,
  buildDeterministicLayout,
} from "@/lib/ai/normalizeCmsBlocks";

export type AiLayoutRunContext = { companyId: string; userId: string };

export type { CmsSerializedBlock };
export { normalizeLayoutBlocks, ensureTrailingCta, buildDeterministicLayout };

const LAYOUT_SYSTEM = `You are a Norwegian CMS assistant for Lunchportalen. Output ONE JSON object with key "blocks" (array only).
Each element: { "type": "hero"|"richText"|"image"|"cta", "data": object }.

Block data shapes (all string fields UTF-8 Norwegian where applicable):
- hero: { "title", "subtitle"?, "imageUrl"?, "imageAlt"?, "ctaLabel"?, "ctaHref"? }
- richText: { "heading"?, "body" } — body may use \\n\\n between paragraphs
- image: { "assetPath" (URL or path), "alt"?, "caption"? }
- cta: { "title", "body"?, "buttonLabel", "buttonHref" }

Rules:
- 3–6 blocks, minimal noise; short lines (1–2 sentences per richText body chunk).
- Order: hero → richText (1–2) → optional image → cta last
- Always end with a cta block; headline must feel specific, not generic.
- No markdown outside JSON
${designTokensPromptFragment()}`;

async function callOpenAiLayoutJson(ctx: AiLayoutRunContext, user: string): Promise<{ blocks?: unknown } | null> {
  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool: AI_RUNNER_TOOL.LAYOUT_CMS,
      input: { system: LAYOUT_SYSTEM, user: user.slice(0, 12_000), temperature: 0.55, max_tokens: 4096 },
    });
    if (result && typeof result === "object" && !Array.isArray(result)) return result as { blocks?: unknown };
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a block layout (preview-only). Does not save or publish.
 */
export async function generateLayout(prompt: string, ctx: AiLayoutRunContext): Promise<{ blocks: CmsSerializedBlock[] }> {
  const p = typeof prompt === "string" ? prompt.trim() : "";
  if (!p) {
    return { blocks: [] };
  }

  const user = `Lag et sideoppsett (blokker) basert på:\n${p}`;
  const parsed = await callOpenAiLayoutJson(ctx, user);
  const rawBlocks = parsed?.blocks;
  let blocks = normalizeLayoutBlocks(rawBlocks);
  if (blocks.length === 0) {
    blocks = buildDeterministicLayout(p);
  }
  blocks = ensureTrailingCta(blocks);
  return { blocks };
}
