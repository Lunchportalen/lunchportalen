/** FNV-1a 32-bit — deterministic, no Math.random. */
export function hashStringToUint32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deterministicIndex(seed: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  return hashStringToUint32(seed) % poolSize;
}

export function buildSelectionSeed(parts: readonly string[]): string {
  return parts.map((p) => String(p ?? "").trim()).join("\0");
}
