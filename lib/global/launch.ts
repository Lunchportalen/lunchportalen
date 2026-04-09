/**
 * Pilot-lansering: maks 5 poster, ingen persist — returnerer utkast for godkjenning.
 */
import type { MarketDef } from "@/lib/global/markets";
import { adaptContent } from "@/lib/global/adaptContent";

export const PILOT_MAX_POSTS = 5;

export type PilotDraftPost = Record<string, unknown> & {
  content: Record<string, unknown>;
};

const MAX = PILOT_MAX_POSTS;

export async function launchPilotMarket(market: MarketDef, posts: Record<string, unknown>[]): Promise<PilotDraftPost[]> {
  const adapted: PilotDraftPost[] = [];
  const list = Array.isArray(posts) ? posts : [];

  for (const p of list.slice(0, MAX)) {
    if (!p || typeof p !== "object") continue;
    const { text } = await adaptContent(p as Record<string, unknown>, market);
    const base = p as Record<string, unknown>;
    const prevContent =
      base.content && typeof base.content === "object" && !Array.isArray(base.content)
        ? (base.content as Record<string, unknown>)
        : {};
    adapted.push({
      ...base,
      content: {
        ...prevContent,
        text,
        market: market.id,
        pilot: true,
        adaptationMode: "deterministic_pilot",
      },
    });
  }

  return adapted;
}
