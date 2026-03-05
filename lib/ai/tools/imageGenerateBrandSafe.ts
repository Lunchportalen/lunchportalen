/**
 * Phase 32 Media: brand-safe image generator (foundation).
 * Deterministic: creates 2-4 candidate media_items with placeholder URLs; logs via caller.
 */

export type ImageGenerateInput = {
  locale: string;
  purpose: "hero" | "section" | "social";
  topic: string;
  brand: string;
  style?: "scandi_minimal" | "warm_enterprise";
  count?: 2 | 4;
};

export type ImageGenerateOutput = {
  summary: string;
  candidates: Array<{ mediaItemId: string; url: string; alt: string }>;
};

const PLACEHOLDER_URLS = [
  "/matbilder/MelhusCatering-Lunsj-1018143.jpg",
  "/og/og-default-1200x630.jpg",
  "/matbilder/MelhusCatering-Lunsj-1018047.jpg",
  "/og/og-lunsjordning-1200x630.jpg",
];

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

export async function imageGenerateBrandSafe(args: {
  input: ImageGenerateInput;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  createdBy: string | null;
}): Promise<ImageGenerateOutput> {
  const { input, supabase, createdBy } = args;
  const locale = (input.locale || "nb").toLowerCase().startsWith("en") ? "en" : "nb";
  const purpose = input.purpose ?? "hero";
  const topic = (input.topic ?? "").trim() || "Lunchportalen";
  const style = input.style === "warm_enterprise" ? "warm_enterprise" : "scandi_minimal";
  const count = input.count === 4 ? 4 : 2;
  const prompt = buildPrompt({ ...input, topic, style });

  const candidates: Array<{ mediaItemId: string; url: string; alt: string }> = [];
  for (let i = 0; i < count; i++) {
    const url = PLACEHOLDER_URLS[i % PLACEHOLDER_URLS.length];
    const alt = altForCandidate(purpose, topic, locale, i);
    const { data: inserted, error } = await supabase
      .from("media_items")
      .insert({
        type: "image",
        status: "proposed",
        source: "ai",
        url,
        alt,
        caption: null,
        tags: ["ai", purpose, style],
        metadata: { tool: "image.generate.brand_safe", purpose, topic, style, prompt },
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (!error && inserted && typeof (inserted as { id?: string }).id === "string") {
      candidates.push({
        mediaItemId: (inserted as { id: string }).id,
        url,
        alt,
      });
    }
  }

  const summary = locale === "en"
    ? `Generated ${candidates.length} brand-safe image candidate(s) for ${purpose}.`
    : `Genererte ${candidates.length} merkesikre bildekandidat(er) for ${purpose}.`;

  return { summary, candidates };
}