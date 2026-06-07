/**
 * Resolve poststed from 4-digit Norwegian postal code via existing Geonorge-backed
 * `/api/address/search` (no new external data source).
 */
export async function resolveCityFromPostal(postalCode: string): Promise<string | null> {
  const normalized = String(postalCode ?? "").replace(/\D/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(normalized)) return null;

  try {
    const res = await fetch(`/api/address/search?q=${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { items?: Array<{ subtitle?: string | null }> };
    };

    if (json.ok === false) return null;

    const items = json.data?.items ?? [];
    for (const item of items) {
      const subtitle = String(item.subtitle ?? "").trim();
      const match = subtitle.match(/^\d{4}\s+(.+?)(?:\s+\(|$)/);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}
