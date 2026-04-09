import "server-only";

const EDGE_CACHE: Record<string, unknown> = {};
const MAX_KEYS = 200;
const keyOrder: string[] = [];

function touchKey(key: string): void {
  const i = keyOrder.indexOf(key);
  if (i >= 0) keyOrder.splice(i, 1);
  keyOrder.push(key);
  while (keyOrder.length > MAX_KEYS) {
    const oldest = keyOrder.shift();
    if (oldest && oldest in EDGE_CACHE) {
      delete EDGE_CACHE[oldest];
      console.log("[EDGE_CACHE_EVICT]", { key: oldest });
    }
  }
}

export function getEdge(key: string): unknown {
  const k = String(key ?? "").trim();
  if (!k) return undefined;
  if (k in EDGE_CACHE) {
    console.log("[EDGE_CACHE_HIT]", { key: k });
    touchKey(k);
    return EDGE_CACHE[k];
  }
  return undefined;
}

export function setEdge(key: string, value: unknown): void {
  const k = String(key ?? "").trim();
  if (!k) return;
  EDGE_CACHE[k] = value;
  touchKey(k);
  console.log("[EDGE_CACHE_SET]", { key: k });
}
