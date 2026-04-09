/**
 * Scale / multi-market catalog — additive to `lib/global/markets.ts`.
 * Metrics reuse the same post→market attribution as `trackMarketPerformance` (ingen ny heuristikk).
 */
import "server-only";

import { trackMarketPerformance } from "@/lib/global/marketPerformance";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { collectRevenueData } from "@/lib/revenue/collect";

export type Market = {
  id: string;
  name: string;
  country: string;
  currency: string;
  active: boolean;
  performance: {
    revenue: number;
    conversion: number;
    growth: number;
  };
};

/** Fire markeder — ID er små bokstaver (samme konvensjon som `lib/global/markets`). */
export const DEFAULT_MARKETS: readonly Market[] = [
  {
    id: "no",
    name: "Norway",
    country: "NO",
    currency: "NOK",
    active: true,
    performance: { revenue: 0, conversion: 0, growth: 0 },
  },
  {
    id: "se",
    name: "Sweden",
    country: "SE",
    currency: "SEK",
    active: false,
    performance: { revenue: 0, conversion: 0, growth: 0 },
  },
  {
    id: "dk",
    name: "Denmark",
    country: "DK",
    currency: "DKK",
    active: false,
    performance: { revenue: 0, conversion: 0, growth: 0 },
  },
  {
    id: "de",
    name: "Germany",
    country: "DE",
    currency: "EUR",
    active: false,
    performance: { revenue: 0, conversion: 0, growth: 0 },
  },
];

/** Samme nøkkel som i `lib/global/marketPerformance.ts` (duplisert for å unngå eksport-endring der). */
function postMarketKey(post: Record<string, unknown>): string {
  const c = post.content;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const m = (c as Record<string, unknown>).market;
    if (typeof m === "string" && m.trim()) return m.trim().toLowerCase();
  }
  const meta = post.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const mid = (meta as Record<string, unknown>).market_id ?? (meta as Record<string, unknown>).market;
    if (typeof mid === "string" && mid.trim()) return mid.trim().toLowerCase();
  }
  return "unknown";
}

function countPostsByMarket(posts: Record<string, unknown>[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    if (!p || typeof p !== "object") continue;
    const k = postMarketKey(p as Record<string, unknown>);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export type MarketPerformanceResult =
  | {
      ok: true;
      marketId: string;
      /** Forklaring av tallene (ingen skjult modell). */
      explain: string;
      performance: Market["performance"];
    }
  | { ok: false; error: string };

/**
 * Henter faktisk ytelse for et marked: omsetning og ordre fra `trackMarketPerformance`,
 * **conversion** = ordre / max(antall innlegg i markedet, 1) (proxy fra innholdssporing),
 * **growth** = 0 når ingen tidsserie er tilgjengelig (eksplisitt — ikke antatt vekst).
 */
export async function getMarketPerformance(marketId: string): Promise<MarketPerformanceResult> {
  const id = typeof marketId === "string" ? marketId.trim().toLowerCase() : "";
  if (!id) return { ok: false, error: "missing_market_id" };

  const def = DEFAULT_MARKETS.find((m) => m.id === id);
  if (!def) return { ok: false, error: "unknown_market" };

  if (!hasSupabaseAdminConfig()) {
    return {
      ok: true,
      marketId: id,
      explain: "Ingen Supabase admin — ytelse satt til null (fail-closed).",
      performance: { revenue: 0, conversion: 0, growth: 0 },
    };
  }

  try {
    const data = await collectRevenueData();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const byMarket = trackMarketPerformance(posts as Record<string, unknown>[], orders as Record<string, unknown>[]);
    const row = byMarket[id] ?? { revenue: 0, orders: 0 };
    const postCounts = countPostsByMarket(posts as Record<string, unknown>[]);
    const postsInMarket = postCounts[id] ?? 0;
    const conversion = row.orders / Math.max(postsInMarket, 1);
    const growth = 0;

    return {
      ok: true,
      marketId: id,
      explain:
        `Omsetning og ordre fra ordre koblet til innlegg med marked «${id}». ` +
        `Conversion = ordre (${row.orders}) / max(innlegg i marked (${postsInMarket}), 1). ` +
        `Growth er 0 uten historisk sammenligning (v1).`,
      performance: {
        revenue: row.revenue,
        conversion,
        growth,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Slår opp katalograd uten I/O. */
export function getMarketDefinition(marketId: string): Market | undefined {
  const id = typeof marketId === "string" ? marketId.trim().toLowerCase() : "";
  if (!id) return undefined;
  return DEFAULT_MARKETS.find((m) => m.id === id);
}
