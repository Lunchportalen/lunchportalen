import "server-only";

import { AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";
import type { AiGeneratedBlock, CMSContentInput } from "@/lib/ai/types";

export type ProposedVariant = {
  id: string;
  blocks: AiGeneratedBlock[];
  hypothesis: string;
};

export type AiVariantRunContext = { companyId: string; userId: string };

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

function collectBlocks(content: CMSContentInput): AiGeneratedBlock[] {
  const raw = content.blocks;
  if (Array.isArray(raw)) return normalizeBlocks(raw);
  const nested = content.data;
  if (isPlainObject(nested) && Array.isArray(nested.blocks)) return normalizeBlocks(nested.blocks);
  return [];
}

function cloneBlocks(blocks: AiGeneratedBlock[]): AiGeneratedBlock[] {
  try {
    return JSON.parse(JSON.stringify(blocks)) as AiGeneratedBlock[];
  } catch {
    return [...blocks];
  }
}

/** Deterministic fallbacks when LLM is unavailable — still safe, suggest-only. */
function heuristicVariants(content: CMSContentInput): ProposedVariant[] {
  const base = collectBlocks(content);
  if (base.length === 0) {
    return [
      {
        id: "v_cta",
        blocks: [
          { type: "hero", data: { title: String(content.title ?? "Ditt budskap"), subtitle: "Klar verdi på én linje." } },
          { type: "cta", data: { label: "Book en uforpliktende prat", href: "#" } },
        ],
        hypothesis: "Minimal side: hero + tydelig CTA (tomt innhold i utgangspunktet).",
      },
    ];
  }

  const a = cloneBlocks(base);
  const b = cloneBlocks(base);
  const c = cloneBlocks(base);

  const first = a[0];
  if (first && isPlainObject(first.data)) {
    const t = first.data.title;
    if (typeof t === "string" && t.length > 0) {
      first.data = { ...first.data, title: `${t} — prøv i dag` };
    }
  }
  a.push({ type: "cta", data: { label: "Start nå", variant: "primary" } });

  if (b.length > 1) {
    [b[0], b[1]] = [b[1], b[0]];
  }
  const heroB = b.find((x) => typeof x.type === "string" && x.type.toLowerCase().includes("hero"));
  if (heroB && isPlainObject(heroB.data) && typeof heroB.data.subtitle === "string") {
    heroB.data = { ...heroB.data, subtitle: `${heroB.data.subtitle} (tydelig neste steg for leseren.)` };
  }

  const ctaBlock = c.find((x) => typeof x.type === "string" && (x.type.toLowerCase() === "cta" || x.type.toLowerCase().includes("cta")));
  if (ctaBlock && isPlainObject(ctaBlock.data)) {
    ctaBlock.data = {
      ...ctaBlock.data,
      label: typeof ctaBlock.data.label === "string" ? `${ctaBlock.data.label} →` : "Se hvordan det fungerer",
    };
  } else {
    c.splice(Math.min(2, c.length), 0, { type: "cta", data: { label: "Få et tilbud", variant: "secondary" } });
  }

  return [
    { id: "v_headline_cta", blocks: a, hypothesis: "Sterkere hero-tittel + ekstra primær-CTA nederst." },
    { id: "v_structure", blocks: b, hypothesis: "Omorganiser toppblokker + klarere undertittel (informasjonshierarki)." },
    { id: "v_cta_copy", blocks: c, hypothesis: "Forbedret CTA-tekst / plassering for lavere friksjon." },
  ];
}

async function llmVariants(content: CMSContentInput, ctx: AiVariantRunContext): Promise<ProposedVariant[] | null> {
  const snapshot = JSON.stringify(content).slice(0, 14_000);
  const system = `You are a Norwegian B2B CMS optimizer for Lunchportalen. Output ONE JSON object with key "variants" (array of 2 or 3 items).
Each item: { "id": string (snake_case), "hypothesis": string (nb), "blocks": array of { "type": string, "data": object } }.
Vary: (1) CTA tone/placement, (2) headline/hero messaging, (3) block order or section emphasis.
No markdown. No prose outside JSON.`;

  const user = `Lag varianter av denne siden (kun forslag, ikke lagret): ${snapshot}`;

  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool: AI_RUNNER_TOOL.VARIANTS_PROPOSE,
      input: { system, user, temperature: 0.75, max_tokens: 4096 },
    });
    const parsed = result;
    if (!isPlainObject(parsed) || !Array.isArray(parsed.variants)) return null;

    const out: ProposedVariant[] = [];
    for (const v of parsed.variants.slice(0, 3)) {
      if (!isPlainObject(v)) continue;
      const id = typeof v.id === "string" ? v.id.trim() : "";
      const hypothesis = typeof v.hypothesis === "string" ? v.hypothesis.trim() : "";
      const blocks = normalizeBlocks(v.blocks);
      if (!id || !hypothesis || blocks.length === 0) continue;
      out.push({ id, hypothesis, blocks });
    }
    return out.length >= 2 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Produce 2–3 proposed variants (never persisted). Uses LLM when configured, else heuristics.
 */
export async function generateVariants(content: CMSContentInput, ctx: AiVariantRunContext): Promise<ProposedVariant[]> {
  const llm = await llmVariants(content, ctx);
  if (llm && llm.length >= 2) return llm;
  return heuristicVariants(content);
}
