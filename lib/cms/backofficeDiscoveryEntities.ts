/**
 * U20 — Filtrer og ranger faktiske entiteter for command palette (fusjon med manifest).
 */
import type { BackofficeNavItem } from "@/lib/cms/backofficeExtensionRegistry";

export type DiscoveryEntityBundle = {
  contentPages: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    updated_at: string | null;
  }>;
  mediaItems: Array<{
    id: string;
    alt: string;
    url: string;
    status: string;
    source: string;
    created_at: string;
  }>;
};

function scoreBlobMatch(blob: string, query: string): number {
  const ql = query.trim().toLowerCase();
  if (!ql) return 0;
  let score = 0;
  if (blob.includes(ql)) score += 100;
  for (const w of ql.split(/\s+/).filter((x) => x.length >= 2)) {
    if (blob.includes(w)) score += 25;
  }
  return score;
}

function mediaDisplayLabel(m: DiscoveryEntityBundle["mediaItems"][number]): string {
  const a = m.alt?.trim();
  if (a) return a;
  try {
    const u = new URL(m.url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last || m.id.slice(0, 8);
  } catch {
    return m.id.slice(0, 8);
  }
}

/**
 * Når query er tom: ingen entiteter (unngå støy). Ellers: ranger treff og mapp til palett-rader.
 */
export function entityRowsForDiscoveryPalette(
  bundle: DiscoveryEntityBundle | null,
  query: string
): BackofficeNavItem[] {
  const q = query.trim();
  if (!q || !bundle) return [];

  const ql = q.toLowerCase();
  const out: { item: BackofficeNavItem; score: number }[] = [];

  for (const p of bundle.contentPages) {
    const blob = `${p.title} ${p.slug} ${p.status} side innhold`.toLowerCase();
    const score = scoreBlobMatch(blob, ql);
    if (score <= 0) continue;
    out.push({
      item: {
        label: p.title?.trim() ? `Side · ${p.title}` : `Side · ${p.slug || p.id.slice(0, 8)}`,
        href: `/backoffice/content/${p.id}`,
        iconName: "content",
        groupId: "content",
        extensionId: `u20.entity.content_page.${p.id}`,
      },
      score,
    });
  }

  for (const m of bundle.mediaItems) {
    const label = mediaDisplayLabel(m);
    const blob = `${label} ${m.url} ${m.status} ${m.source} media bilde`.toLowerCase();
    const score = scoreBlobMatch(blob, ql);
    if (score <= 0) continue;
    out.push({
      item: {
        label: `Media · ${label}`,
        href: `/backoffice/media?u20id=${encodeURIComponent(m.id)}`,
        iconName: "media",
        groupId: "content",
        extensionId: `u20.entity.media.${m.id}`,
      },
      score,
    });
  }

  out.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label, "nb"));
  return out.map((x) => x.item);
}

/**
 * Flett manifest-treff (allerede filtrert/ranket) med entiteter: entiteter etter nav, begge beholdt.
 */
export function mergeDiscoveryPaletteItems(
  manifestRanked: readonly BackofficeNavItem[],
  entityRows: readonly BackofficeNavItem[]
): BackofficeNavItem[] {
  if (!entityRows.length) return [...manifestRanked];
  const seen = new Set(manifestRanked.map((x) => x.href));
  const extra = entityRows.filter((e) => !seen.has(e.href));
  return [...manifestRanked, ...extra];
}
