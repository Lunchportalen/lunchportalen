import "server-only";

import { AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";

const PLACEHOLDER_HOST = "https://placehold.co";

export type AiImageRunContext = { companyId: string; userId: string };

function placeholderImage(alt: string): { url: string; alt: string } {
  const label = alt.trim().slice(0, 36) || "Illustrasjon";
  const safe = encodeURIComponent(label.replace(/\s+/g, " "));
  return {
    url: `${PLACEHOLDER_HOST}/1200x630/e2e8f0/334155/png?text=${safe}`,
    alt: alt.trim().slice(0, 200) || "Plassholder for generert bilde",
  };
}

/**
 * Generates an image URL via OpenAI Images API when configured; otherwise returns a deterministic placeholder.
 * Does not upload or persist files — URL only for editor preview / manual approval.
 */
export async function generateImage(prompt: string, ctx: AiImageRunContext): Promise<{ url: string; alt: string }> {
  const p = typeof prompt === "string" ? prompt.trim() : "";
  const altFallback = p.slice(0, 160) || "AI-generert illustrasjon";

  if (!p) {
    return placeholderImage("Tom prompt");
  }

  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool: AI_RUNNER_TOOL.IMAGE_DALLE_PREVIEW,
      input: { prompt: p },
    });
    const json = result as {
      data?: Array<{ url?: string; revised_prompt?: string }>;
    };
    const url = typeof json?.data?.[0]?.url === "string" ? json.data[0].url : "";
    if (!url) {
      return placeholderImage(altFallback);
    }
    const revised = typeof json?.data?.[0]?.revised_prompt === "string" ? json.data[0].revised_prompt : "";
    const alt = revised.trim().slice(0, 200) || altFallback;
    return { url, alt };
  } catch {
    return placeholderImage(altFallback);
  }
}
