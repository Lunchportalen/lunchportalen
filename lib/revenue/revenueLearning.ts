/**
 * Leser ordre-basert læring inn i SoMe-prompt (hint, ikke styring).
 */
import "server-only";

import { collectRevenueData } from "@/lib/revenue/collect";
import { buildRevenueModel } from "@/lib/revenue/model";
import { extractRevenuePatterns } from "@/lib/revenue/patterns";
import { findWinners } from "@/lib/revenue/winners";

let cache: { at: number; text: string } | null = null;
const TTL_MS = 15 * 60 * 1000;

export async function getRevenueHooksForPrompt(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.text;
  }
  try {
    const data = await collectRevenueData();
    if (data.posts.length === 0) {
      cache = { at: Date.now(), text: "" };
      return "";
    }
    const model = buildRevenueModel(data);
    const winners = findWinners(model).slice(0, 5);
    if (winners.length === 0) {
      cache = { at: Date.now(), text: "" };
      return "";
    }
    const patterns = extractRevenuePatterns(winners);
    const text = patterns
      .map((p, i) => `${i + 1}. ${p.hook || "(tom tekst)"} — omsetning ${Math.round(p.revenue)} (post ${p.postId.slice(0, 8)}…)`)
      .join("\n");
    const out = text.trim();
    cache = { at: Date.now(), text: out };
    return out;
  } catch {
    return "";
  }
}
