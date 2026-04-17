import {
  COMPONENT_REGISTRY,
  isRegistryEnumDef,
  type RegistryFieldDef,
} from "@/lib/cms/blocks/componentRegistry";
import { designTokensPromptFragment } from "@/lib/ai/designTokens";

function describeField(def: RegistryFieldDef): string {
  if (isRegistryEnumDef(def)) {
    return def.map((s) => `"${s}"`).join(" | ");
  }
  return def;
}

function componentContractLines(): string {
  return Object.entries(COMPONENT_REGISTRY)
    .map(([type, meta]) => {
      const fieldLines = Object.entries(meta.fields)
        .map(([name, def]) => `    - "${name}": ${describeField(def)} (string; enum must be exact)`)
        .join("\n");
      return `- "${type}" (${meta.label}):\n${fieldLines}`;
    })
    .join("\n\n");
}

export function pageBuilderSystemPrompt(): string {
  return `You are a Norwegian CMS content assistant for Lunchportalen.

You are NOT a developer. You do NOT output layout, HTML, JSX, CSS, or markdown fences.
You ONLY pick predefined components and fill their fields — like an Umbraco backoffice editor.

Return ONLY valid JSON. Root MUST be: { "blocks": [ ... ] } (not a bare array).

Each block is a flat object: { "type": "<component>", ...fields }.
- "type" MUST be one of the keys below.
- Include EVERY field listed for that type. Use "" for empty strings where allowed.
- Do NOT add keys that are not listed for that type.
- All scalar values are JSON strings (including enums).

Quality bar (non-negotiable):
- First hero/banner must carry a sharp, specific headline (not generic filler).
- Copy is short: hero title ≤ 12 words; body lines ≤ 2 sentences where possible.
- Always include a clear CTA path: either a dedicated cta_block OR hero/banner with ctaLabel + ctaHref filled.
- Prefer 4–8 blocks: hero → 1–3 value sections → proof or detail → closing CTA.

Allowed components and fields:

${componentContractLines()}

Mappings after save (for your awareness only — still output the AI field names above):
- text_block → richText (title → heading, body → body). Field \`variant\` is accepted but not stored on richText.
- cta_block → CTA (ctaLabel → buttonLabel, ctaHref → buttonHref). Field \`variant\` is accepted but not stored on CTA.
- hero_split → hero_full (image → imageId)
- split_block → cards (two columns from left/right fields)
- image_block → image
- grid_2 / grid_3 → grid (card fields → items[]); optional subtitle is merged into section title text
- feature_grid → cards (three feature rows)
- faq_block → zigzag (three Q/A steps, text-only)
- quote_block → persisted as quote_block (editorial pull-quote; not testimonial_block)
- newsletter_signup → persisted as newsletter_signup (email + submit; not generic cta_block)
- form_embed → persisted as form_embed (iframe / internt skjema / lagret snippet — ikke newsletter_signup)
- testimonial_block → persisted as testimonial_block with testimonialsJson (array of quote/author/role/company/image/alt/logo rows); legacy AI fields quote/author/role/image still map to a single-row JSON
- hero_bleed.backgroundImage / banner.backgroundImage / image_block.image / grid images: URL, path, or cms:* key
- \`variant\`: "left" | "right" | "center" | "minimal" — \`minimal\` maps to centered layout where the editor has no separate token; banner is always rendered with system-owned center layout but you must still send \`variant\`.

Norwegian UTF-8 text. No explanations outside JSON.
${designTokensPromptFragment()}`;
}

export type PageBuilderUserPromptOptions = {
  pageTypeHint?: string;
  existingBlocksSummary?: string;
  menuContextHint?: string;
};

export function buildPageBuilderUserPrompt(intent: string, opts?: PageBuilderUserPromptOptions): string {
  const base = intent.trim();
  const parts: string[] = [`Lag CMS-komponenter (blokker) basert på:\n${base}`];

  if (opts?.pageTypeHint?.trim()) {
    parts.push(`\n[Sidekontekst — side-/dokumenttype]\n${opts.pageTypeHint.trim()}`);
  }
  if (opts?.existingBlocksSummary?.trim()) {
    parts.push(`\n[Eksisterende blokker — ikke kopier ordrett; bruk som kontekst]\n${opts.existingBlocksSummary.trim()}`);
  }
  if (opts?.menuContextHint?.trim()) {
    parts.push(`\n[CMS-meny / navigasjonskontekst]\n${opts.menuContextHint.trim()}`);
  }

  parts.push(
    '\nReturner KUN JSON-objektet med nøkkelen "blocks" som beskrevet (ingen HTML/JSX, ingen ekstra felt).',
  );

  return parts.join("");
}
