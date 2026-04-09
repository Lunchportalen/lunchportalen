/**
 * Deterministisk teksttilpasning per marked (ingen LLM — samme input → samme output).
 * For pilot: språk + rolig B2B-tone via statiske innledninger.
 */
import type { MarketDef } from "@/lib/global/markets";

export type AdaptContentResult = {
  text: string;
  mode: "deterministic_pilot";
};

const LOCAL_INTRO: Record<string, string> = {
  no: "",
  sv: "Professionellt lunchbudskap för B2B: ",
  da: "Professionelt frokostbudskab til B2B: ",
};

function readPostText(post: Record<string, unknown>): string {
  const c = post.content;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const t = (c as Record<string, unknown>).text;
    if (typeof t === "string") return t.slice(0, 8000);
  }
  return "";
}

/**
 * Tilpasser innhold til markeds språk/tone uten nettverkskall.
 */
export async function adaptContent(post: Record<string, unknown>, market: MarketDef): Promise<AdaptContentResult> {
  const raw = readPostText(post);
  const intro = LOCAL_INTRO[market.language] ?? `[${market.language.toUpperCase()}] `;
  const text = `${intro}${raw}`.trim();
  return { text: text || raw, mode: "deterministic_pilot" };
}
