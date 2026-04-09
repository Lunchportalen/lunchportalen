/**
 * Ekstraherer rå `blocks[]` fra page body payload (flat, envelope eller JSON-streng).
 * Delt av bodyParse og block allowlist — én sann implementasjon.
 */

export function extractBlocksSource(body: unknown): unknown[] | null {
  if (body == null) return null;
  if (typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.blocks)) return obj.blocks;
    if (obj.blocksBody !== undefined && obj.blocksBody !== null) {
      const blocksBody = obj.blocksBody;
      if (typeof blocksBody === "object" && !Array.isArray(blocksBody) && Array.isArray((blocksBody as Record<string, unknown>).blocks)) {
        return (blocksBody as Record<string, unknown>).blocks as unknown[];
      }
      if (typeof blocksBody === "string") {
        try {
          const parsed = JSON.parse(blocksBody) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as Record<string, unknown>).blocks)) {
            return (parsed as Record<string, unknown>).blocks as unknown[];
          }
        } catch {
          return null;
        }
      }
    }
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return null;
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.blocks)) return obj.blocks;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function extractBlockTypeKeysFromBodyPayload(body: unknown): string[] {
  const source = extractBlocksSource(body);
  if (!source) return [];
  const keys: string[] = [];
  for (const item of source) {
    if (item != null && typeof item === "object" && !Array.isArray(item)) {
      const t = String((item as Record<string, unknown>).type ?? "").trim();
      if (t) keys.push(t);
    }
  }
  return keys;
}
