/**
 * Kunnskapsgraf fra logger: combo og marked skilles med US (unit separator) for å tåle `|` i combo-nøkkel.
 */
export const GRAPH_KEY_SEPARATOR = "\u001f";

export type LearningNode = {
  revenue: number;
  count: number;
};

export type LearningGraph = Record<string, LearningNode>;

export type ActivityLogLike = {
  action?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function makeGraphKey(combo: string, market: string): string {
  const c = typeof combo === "string" ? combo.trim() : "";
  const m = typeof market === "string" && market.trim() ? market.trim() : "default";
  return `${c}${GRAPH_KEY_SEPARATOR}${m}`;
}

export function parseGraphKey(key: string): { combo: string; market: string } {
  const i = key.indexOf(GRAPH_KEY_SEPARATOR);
  if (i < 0) return { combo: key, market: "default" };
  return { combo: key.slice(0, i), market: key.slice(i + GRAPH_KEY_SEPARATOR.length) };
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Aggregerer `mvo_learning`-rader til graf-noder per (combo, marked). Ingen kryss-marked mixing i nøkkelen.
 */
export function buildLearningGraph(logs: ActivityLogLike[]): LearningGraph {
  const graph: LearningGraph = {};

  for (const l of logs) {
    if (l.action !== "mvo_learning") continue;
    const m = l.metadata;
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const meta = m as Record<string, unknown>;
    const comboRaw = meta.combo ?? meta.best_key;
    const combo = typeof comboRaw === "string" ? comboRaw : comboRaw != null ? String(comboRaw) : "";
    const marketRaw = meta.market_id ?? meta.market;
    const market =
      typeof marketRaw === "string" && marketRaw.trim()
        ? marketRaw.trim()
        : "default";

    const key = makeGraphKey(combo || "unknown", market);
    if (!graph[key]) {
      graph[key] = { revenue: 0, count: 0 };
    }
    graph[key].revenue += num(meta.revenue ?? meta.best_revenue);
    graph[key].count += 1;
  }

  return graph;
}

/** Beste combo per marked (høyeste aggregert omsetning for det markedet). */
export function bestCombosPerMarket(graph: LearningGraph): Record<string, { combo: string; revenue: number; count: number }> {
  const byMarket: Record<string, { combo: string; revenue: number; count: number }> = {};

  for (const [key, node] of Object.entries(graph)) {
    const { combo, market } = parseGraphKey(key);
    const cur = byMarket[market];
    if (!cur || node.revenue > cur.revenue) {
      byMarket[market] = { combo, revenue: node.revenue, count: node.count };
    }
  }

  return byMarket;
}

export function sumGraphRevenue(graph: LearningGraph): number {
  let s = 0;
  for (const n of Object.values(graph)) {
    s += n.revenue;
  }
  return s;
}
