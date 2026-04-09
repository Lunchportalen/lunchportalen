/**
 * Lead-kilde-ID for attributjon: innhold → klikk → demo → avtale → omsetning.
 * Sporbar og forklarbar uten DB-migrering (kan speiles til server senere).
 */

export const LEAD_SRC_QUERY_KEY = "src";

/** Stabil ID for en kalenderpost (brukes i ?src=). */
export function leadSourceIdFromPostId(postId: string): string {
  const id = String(postId ?? "").trim();
  return id.startsWith("post_") ? id : `post_${id}`;
}

/** SoMe-utkast uten kalender-rad (f.eks. AI CEO-rad) — knyttet til produkt/side. */
export function leadSourceIdFromProductId(productId: string): string {
  const id = String(productId ?? "").trim() || "unknown";
  return `post_prod_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/**
 * Legger til ?src=<leadSourceId> (bevarer eksisterende query). Kun http(s).
 */
export function appendLeadSourceToUrl(rawUrl: string, leadSourceId: string): string {
  const u = String(rawUrl ?? "").trim();
  if (!u || u === "#") return u || "#";
  if (!/^https?:\/\//i.test(u)) return u;
  try {
    const parsed = new URL(u);
    parsed.searchParams.set(LEAD_SRC_QUERY_KEY, leadSourceId);
    return parsed.toString();
  } catch {
    return u;
  }
}

/** Les leadSourceId fra landing-URL (f.eks. etter klikk). */
export function parseLeadSourceIdFromSearchParams(search: string): string | null {
  const q = search.startsWith("?") ? search : `?${search}`;
  try {
    const p = new URLSearchParams(q);
    const v = p.get(LEAD_SRC_QUERY_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
