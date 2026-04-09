// STATUS: KEEP

// lib/seo/routes.ts

export const SEO_TAGS = [
  "core",
  "how",
  "pricing",
  "system",
  "alt_kantine",
  "local",
  "seo",
] as const;

export type SeoTag = (typeof SEO_TAGS)[number];

export type SeoRoute = {
  path: `/${string}` | "/";
  title: string;
  description: string;
  tags: SeoTag[];
  /** Sett true hvis siden ikke skal indekseres eller vises i sitemap/relaterte */
  noindex?: boolean;
  /** Brukes til å prioritere i "relaterte sider" */
  weight?: number;
};

/* =========================================================
   Canonical SEO routes (single source of truth)
========================================================= */

export const SEO_ROUTES: SeoRoute[] = [
  {
    path: "/",
    title: "Lunchportalen",
    description: "Firmalunsj med kontroll og forutsigbarhet – uten støy.",
    tags: ["core"],
    weight: 100,
  },
  {
    path: "/hvordan",
    title: "Slik fungerer Lunchportalen",
    description: "Avtale, onboarding, bestilling og cut-off kl. 08:00 – hele modellen.",
    tags: ["how", "core"],
    weight: 90,
  },

  // SEO / strategiske landingssider
  {
    path: "/lunsjordning",
    title: "Lunsjordning for bedrift",
    description: "Fast ramme, mindre admin og mindre matsvinn – tydelig flyt for ansatte.",
    tags: ["seo", "core"],
    weight: 80,
  },
  {
    path: "/alternativ-til-kantine",
    title: "Alternativ til kantine",
    description: "Kantine uten kjøkkeninvestering – strukturert lunsjløsning med kontroll.",
    tags: ["seo", "alt_kantine"],
    weight: 80,
  },
  {
    path: "/system-for-lunsjbestilling",
    title: "System for lunsjbestilling",
    description: "Digital lunsjportal med verifisert lagring og tydelig cut-off 08:00.",
    tags: ["seo", "system"],
    weight: 80,
  },

  // Lokale sider (SXO)
  {
    path: "/lunsj-levering-oslo",
    title: "Lunsj levering Oslo",
    description: "Bedriftslunsj med fast ramme, cut-off 08:00 og full kontroll for admin.",
    tags: ["seo", "local"],
    weight: 70,
  },
  {
    path: "/lunsjordning-trondheim",
    title: "Lunsjordning Trondheim",
    description: "Lunsj til ansatte med forutsigbar drift – mindre admin og mindre svinn.",
    tags: ["seo", "local"],
    weight: 70,
  },
  {
    path: "/lunch-levering-bergen",
    title: "Lunch levering Bergen",
    description: "Lunchordning for firma – tydelig flyt, cut-off 08:00 og kontroll.",
    tags: ["seo", "local"],
    weight: 70,
  },
];

/* =========================================================
   Helpers (used by sitemap, related links, nav/footer, etc.)
========================================================= */

export function isSeoRoute(path: string): boolean {
  return SEO_ROUTES.some((r) => r.path === path);
}

export function getSeoRoute(path: string): SeoRoute | null {
  return SEO_ROUTES.find((r) => r.path === path) ?? null;
}

export function getIndexableRoutes(): SeoRoute[] {
  return SEO_ROUTES.filter((r) => !r.noindex);
}

export function getRoutesByTag(tag: SeoTag): SeoRoute[] {
  return SEO_ROUTES.filter((r) => r.tags.includes(tag) && !r.noindex);
}

export function getRelatedRoutes(opts: {
  currentPath: string;
  tags?: SeoTag[];
  limit?: number;
}): SeoRoute[] {
  const { currentPath, tags = ["seo"], limit = 6 } = opts;

  const score = (r: SeoRoute) => {
    let s = r.weight ?? 0;
    for (const t of tags) if (r.tags.includes(t)) s += 50;
    if (r.tags.includes("core")) s += 10;
    return s;
  };

  return SEO_ROUTES
    .filter((r) => !r.noindex && r.path !== currentPath)
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
}

/** For sitemap priority / frequency */
export function getSitemapHints(route: SeoRoute): {
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
} {
  const isHome = route.path === "/";
  const isCore = route.tags.includes("core");
  const isLocal = route.tags.includes("local");

  const priority = isHome ? 1.0 : isCore ? 0.9 : isLocal ? 0.7 : 0.8;
  const changeFrequency = isHome ? "daily" : isCore ? "weekly" : "monthly";

  return { priority, changeFrequency };
}
