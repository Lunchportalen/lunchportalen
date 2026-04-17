/**
 * Canonical URL path for public editorial HTML (matches public route).
 * Used by metadata fail-closed, JSON-LD WebPage url, and DOM verification.
 */
export function canonicalPathForPublicEditorialSlug(slug: string): string {
  const n = String(slug ?? "").trim().toLowerCase();
  if (!n || n === "home") return "/";
  return `/${n.replace(/^\/+/, "")}`;
}
