import "server-only";

import { AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";
import type { AiGeneratedBlock, AiGenerateResult, CMSContentInput } from "@/lib/ai/types";

export type AiGeneratorRunContext = { companyId: string; userId: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeBlocks(raw: unknown): AiGeneratedBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: AiGeneratedBlock[] = [];
  for (const b of raw) {
    if (!isPlainObject(b)) continue;
    const type = typeof b.type === "string" ? b.type.trim() : "";
    if (!type) continue;
    const id = typeof b.id === "string" ? b.id : undefined;
    const data =
      isPlainObject(b.data) ? b.data : isPlainObject(b.props) ? (b.props as Record<string, unknown>) : undefined;
    out.push(id ? { id, type, data } : { type, data });
  }
  return out.slice(0, 40);
}

function ensureSectionClosingCta(blocks: AiGeneratedBlock[]): AiGeneratedBlock[] {
  if (blocks.some((b) => b.type === "cta")) return blocks;
  return [
    ...blocks,
    {
      type: "cta",
      data: {
        title: "Neste steg",
        body: "Ta kontakt for en uforpliktende prat.",
        buttonLabel: "Kontakt oss",
        buttonHref: "/kontakt",
      },
    },
  ];
}

async function callOpenAiStructured(
  ctx: AiGeneratorRunContext,
  tool: string,
  system: string,
  user: string,
  temperature: number,
): Promise<Record<string, unknown> | null> {
  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool,
      input: { system, user, temperature, max_tokens: 4096 },
    });
    if (result && typeof result === "object" && !Array.isArray(result)) return result as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

const BLOCK_SYSTEM = `You are a Norwegian B2B CMS assistant for Lunchportalen. Output ONE JSON object only with key "blocks" (array).
Each block: { "type": string, "data": object }.
Allowed types examples: hero, richText, cta, text, features, testimonial, spacer.
Rules: calm professional Norwegian (nb); short persuasive lines; strong headline in the first block; end with a cta block when possible.
No markdown outside JSON.`;

/**
 * Generate a section from a free-form prompt. Does not save to CMS.
 */
export async function generateSection(prompt: string, ctx: AiGeneratorRunContext): Promise<AiGenerateResult> {
  const p = typeof prompt === "string" ? prompt.trim() : "";
  if (!p) return { blocks: [] };

  const user = `Lag en seksjon (1–4 blokker) basert på: ${p.slice(0, 8000)}`;
  const parsed = await callOpenAiStructured(ctx, AI_RUNNER_TOOL.GEN_SECTION, BLOCK_SYSTEM, user, 0.65);
  if (!parsed) return { blocks: [] };
  return { blocks: ensureSectionClosingCta(normalizeBlocks(parsed.blocks)) };
}

/**
 * Generate a full page outline as blocks from structured context. Does not save to CMS.
 */
export async function generateFullPage(context: CMSContentInput, ctx: AiGeneratorRunContext): Promise<AiGenerateResult> {
  const safe = JSON.stringify(context).slice(0, 12_000);
  const user = `Lag et sideoppsett som blocks-array basert på kontekst (JSON): ${safe}`;
  const parsed = await callOpenAiStructured(
    ctx,
    AI_RUNNER_TOOL.GEN_FULL_PAGE,
    `${BLOCK_SYSTEM} Prefer 5–12 blocks with clear hierarchy: hero → value props → proof → CTA.`,
    user,
    0.65,
  );
  if (!parsed) return { blocks: [] };
  return { blocks: ensureSectionClosingCta(normalizeBlocks(parsed.blocks)) };
}
