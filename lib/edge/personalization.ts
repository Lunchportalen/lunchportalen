/**
 * Edge-safe (no Node APIs). Segment hint only — no I/O.
 */
export function edgePersonalize(headers: Headers | { get(name: string): string | null }): {
  userSegment: string;
} {
  const h = "get" in headers ? headers : { get: () => null };
  const seg = String(h.get("x-segment") ?? "").trim();
  return {
    userSegment: seg || "default",
  };
}
