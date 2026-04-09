/**
 * U19 — Precomputert discovery-indeks over `BACKOFFICE_EXTENSION_REGISTRY` (samme kilde som palett).
 * Rankering ved treff — ikke Elasticsearch/ny søkemotorplattform.
 */
import {
  BACKOFFICE_EXTENSION_REGISTRY,
  type BackofficeExtensionEntry,
  type BackofficeNavItem,
} from "@/lib/cms/backofficeExtensionRegistry";

/** href → normalisert søkeblob (tokens + metadata). */
const HREF_TO_DISCOVERY_BLOB: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const e of BACKOFFICE_EXTENSION_REGISTRY) {
    if (!e.surface.palette) continue;
    m.set(e.href, buildDiscoveryBlob(e));
  }
  return m;
})();

function buildDiscoveryBlob(e: BackofficeExtensionEntry): string {
  const parts = [e.label, e.href, e.collectionKey ?? "", e.id, ...(e.discoveryAliases ?? [])];
  return parts.join(" ").toLowerCase();
}

function scoreMatch(blob: string, query: string): number {
  const ql = query.trim().toLowerCase();
  if (!ql) return 0;
  let score = 0;
  if (blob.includes(ql)) score += 100;
  for (const w of ql.split(/\s+/).filter((x) => x.length >= 2)) {
    if (blob.includes(w)) score += 25;
  }
  return score;
}

/**
 * Sekundær rank: primære TopBar-ruter lett foran discovery-only (samme treffscore).
 */
function primaryBoost(href: string): number {
  const e = BACKOFFICE_EXTENSION_REGISTRY.find((x) => x.href === href);
  return e?.surface.topBar ? 3 : 0;
}

/**
 * Sorter treff etter indeksert relevans (U19). Tom query → rekkefølge uendret.
 */
export function rankDiscoveryNavItems(items: readonly BackofficeNavItem[], query: string): BackofficeNavItem[] {
  const q = query.trim();
  if (!q) return [...items];
  const ql = q.toLowerCase();
  return [...items].sort((a, b) => {
    const blobA = HREF_TO_DISCOVERY_BLOB.get(a.href) ?? `${a.label} ${a.href}`.toLowerCase();
    const blobB = HREF_TO_DISCOVERY_BLOB.get(b.href) ?? `${b.label} ${b.href}`.toLowerCase();
    const sa = scoreMatch(blobA, ql) + primaryBoost(a.href);
    const sb = scoreMatch(blobB, ql) + primaryBoost(b.href);
    if (sb !== sa) return sb - sa;
    return a.label.localeCompare(b.label, "nb");
  });
}

/** Antall indekserte palett-rader (til test/dok). */
export function getBackofficeDiscoveryIndexSize(): number {
  return HREF_TO_DISCOVERY_BLOB.size;
}
