/**
 * Avleder enkle mønstre fra faktiske poster (jsonb content v1).
 * success = minst én konvertering i metrics eller eksplisitt orders > 0 i input.
 */
export type SocialPostShape = {
  id: string;
  content?: unknown;
};

export type ExtractedPattern = {
  hook: string;
  success: boolean;
  postId: string;
};

function readText(content: unknown): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const c = content as Record<string, unknown>;
  if (typeof c.text === "string" && c.text.trim()) return c.text.trim();
  return "";
}

function readMetrics(content: unknown): { conversions: number } {
  if (!content || typeof content !== "object" || Array.isArray(content)) return { conversions: 0 };
  const c = content as Record<string, unknown>;
  const m = c.metrics;
  if (!m || typeof m !== "object" || Array.isArray(m)) return { conversions: 0 };
  const conv = (m as Record<string, unknown>).conversions;
  const n = typeof conv === "number" && Number.isFinite(conv) ? conv : 0;
  return { conversions: Math.max(0, Math.floor(n)) };
}

export function extractPatterns(posts: SocialPostShape[], orderCountByPostId: Record<string, number>): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = [];
  for (const p of Array.isArray(posts) ? posts : []) {
    if (!p?.id) continue;
    const text = readText(p.content);
    const hook = text.slice(0, 50);
    const m = readMetrics(p.content);
    const oc = Math.max(0, Math.floor(orderCountByPostId[p.id] ?? 0));
    const success = m.conversions > 0 || oc > 0;
    if (!success) continue;
    patterns.push({ hook, success, postId: p.id });
  }
  return patterns;
}
