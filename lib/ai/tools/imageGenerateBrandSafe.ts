/**
 * Brand-safe image prompt suggestions (production).
 * Returns prompt + alt suggestions only; no image generation, no placeholder URLs, no media_items.
 * Editor can use prompts in an external image tool or upload flow.
 */

export type ImageGenerateInput = {
  locale: string;
  purpose: "hero" | "section" | "social";
  topic: string;
  brand: string;
  style?: "scandi_minimal" | "warm_enterprise";
  count?: 2 | 4;
};

export type ImagePromptCandidate = {
  prompt: string;
  alt: string;
};

export type ImageGenerateOutput = {
  summary: string;
  /** Prompt suggestions only; no URLs or mediaItemIds. */
  prompts: ImagePromptCandidate[];
};

function brandStyleSpec(style: string): Record<string, string> {
  if (style === "warm_enterprise") {
    return { lighting: "soft", composition: "centered", palette: "warm neutrals" };
  }
  return { lighting: "natural", composition: "minimal", palette: "scandi neutral" };
}

function buildPrompt(input: ImageGenerateInput): string {
  const spec = brandStyleSpec(input.style ?? "scandi_minimal");
  return `Brand-safe image for ${input.purpose}: ${input.topic}. Style: ${spec.lighting}, ${spec.composition}, ${spec.palette}.`;
}

function altForCandidate(purpose: string, topic: string, locale: string, index: number): string {
  const t = topic.trim() || "content";
  if (locale === "en") return `${purpose} image for ${t} (option ${index + 1})`;
  return `${purpose}-bilde for ${t} (alternativ ${index + 1})`;
}

/**
 * Returns prompt suggestions for brand-safe images. No media_items, no URLs.
 * Caller may log/store the result; no fake generated assets.
 */
export function imageGenerateBrandSafe(args: { input: ImageGenerateInput }): ImageGenerateOutput {
  const { input } = args;
  const locale = (input.locale || "nb").toLowerCase().startsWith("en") ? "en" : "nb";
  const purpose = input.purpose ?? "hero";
  const topic = (input.topic ?? "").trim() || "Lunchportalen";
  const style = input.style === "warm_enterprise" ? "warm_enterprise" : "scandi_minimal";
  const count = input.count === 4 ? 4 : 2;

  const prompts: ImagePromptCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const basePrompt = buildPrompt({ ...input, topic, style });
    const variant = count > 1 ? ` Variant ${i + 1}: focus on ${i === 0 ? "main subject" : i === 1 ? "context and atmosphere" : "detail and clarity"}.` : "";
    prompts.push({
      prompt: basePrompt + variant,
      alt: altForCandidate(purpose, topic, locale, i),
    });
  }

  const summary =
    locale === "en"
      ? `${prompts.length} prompt suggestion(s) for brand-safe images. Use these in your image tool; no images were generated.`
      : `${prompts.length} promptforslag for merkesikre bilder. Bruk disse i bildeverktøyet ditt; ingen bilder er generert.`;

  return { summary, prompts };
}
