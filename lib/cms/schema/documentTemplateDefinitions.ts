/**
 * U97 — Kanonisk template / rendering-profil-binding per Document Type (Umbraco-lignende).
 * Ikke Razor — eksplisitt CMS-kontrakt som innhold og editor kan vise.
 */

export type DocumentTemplateDefinition = {
  alias: string;
  title: string;
  description: string;
  /** F.eks. Next route segment eller layout-profil-key — kun metadata i RC. */
  renderingProfileKey: string;
};

const BASELINE: readonly DocumentTemplateDefinition[] = [
  {
    alias: "marketing_page_default",
    title: "Marketing-side (standard)",
    description: "Full bredde marketing-layout med standard header/footer-binding.",
    renderingProfileKey: "marketing_default",
  },
  {
    alias: "marketing_page_minimal",
    title: "Marketing-side (minimal)",
    description: "Enklere marketing-surface — færre seksjoner i standard preview.",
    renderingProfileKey: "marketing_minimal",
  },
  {
    alias: "compact_landing_default",
    title: "Kompakt landing",
    description: "Landing med smalt blokkspektrum — matcher compact_page.",
    renderingProfileKey: "compact_landing",
  },
  {
    alias: "micro_landing_default",
    title: "Micro landing",
    description: "Minimal landing — hard cap på blokker.",
    renderingProfileKey: "micro_landing",
  },
];

const BY_ALIAS = new Map(BASELINE.map((t) => [t.alias, t]));

export function listDocumentTemplateDefinitions(): readonly DocumentTemplateDefinition[] {
  return BASELINE;
}

export function listDocumentTemplateAliases(): string[] {
  return BASELINE.map((t) => t.alias);
}

export function getDocumentTemplateDefinition(alias: string): DocumentTemplateDefinition | undefined {
  const k = String(alias ?? "").trim();
  return k ? BY_ALIAS.get(k) : undefined;
}
