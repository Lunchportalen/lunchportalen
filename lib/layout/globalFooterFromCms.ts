export type FooterLink = { label: string; href: string };

export type FooterColumn = { head: string; links: FooterLink[] };

export type AppFooterViewModel = {
  links: FooterLink[];
  columns: FooterColumn[];
  bottomText: string | null;
};

function cmsFooterData(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const root = json as Record<string, unknown>;
  if (root.ok !== true) return null;
  const inner = root.data;
  if (inner && typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return null;
}

function normalizeLinks(raw: unknown): FooterLink[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const href = typeof o.href === "string" ? o.href.trim() : "";
    if (!label || !href) continue;
    out.push({ label, href });
  }
  return out;
}

function normalizeColumns(raw: unknown): FooterColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterColumn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const head =
      typeof o.head === "string"
        ? o.head.trim()
        : typeof o.title === "string"
          ? o.title.trim()
          : typeof o.label === "string"
            ? o.label.trim()
            : "";
    const links = normalizeLinks(o.links);
    if (!head && links.length === 0) continue;
    out.push({ head, links });
  }
  return out;
}

/** Shared by server `AppFooter` and client preview chrome. */
export function footerShellViewModelFromCmsJson(cmsJson: unknown): AppFooterViewModel {
  const data = cmsFooterData(cmsJson);
  const links = data ? normalizeLinks(data.links ?? data.footerLinks) : [];
  const columns = data ? normalizeColumns(data.columns) : [];
  const bottomTextRaw =
    data && typeof data.bottomText === "string"
      ? data.bottomText
      : data && typeof data.footerText === "string"
        ? data.footerText
        : null;
  const bottomText =
    typeof bottomTextRaw === "string" && bottomTextRaw.trim() !== "" ? bottomTextRaw.trim() : null;

  return { links, columns, bottomText };
}
