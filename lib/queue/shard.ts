import "server-only";

/**
 * Deterministisk shard-indeks fra nøkkel (samme nøkkel → samme shard).
 */
export function getShard(key: string, total = 4): number {
  const t = Math.max(1, Math.floor(total));
  let hash = 0;
  const s = String(key ?? "");
  for (let i = 0; i < s.length; i += 1) {
    hash += s.charCodeAt(i);
  }
  return Math.abs(hash) % t;
}

export function shardTotal(): number {
  const raw = String(process.env.SHARD_TOTAL ?? "").trim();
  const n = raw.length ? Number.parseInt(raw, 10) : 4;
  return Number.isFinite(n) && n >= 1 ? Math.min(64, n) : 4;
}

export function getNodeShard(nodeId: string, total?: number): number {
  return getShard(nodeId, total ?? shardTotal());
}
