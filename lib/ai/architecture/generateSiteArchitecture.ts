/**
 * Site architecture generator: recommends page tree, primary/secondary navigation, and landing pages
 * from business type, audience, and primary goals. Deterministic; no LLM. Output is advisory only.
 */

/** Input for the site architecture generator. */
export type GenerateSiteArchitectureInput = {
  /** e.g. "e-commerce", "saas", "restaurant", "consulting", "nonprofit" */
  businessType: string;
  /** e.g. "B2B decision makers", "consumers", "local diners", "donors" */
  audience: string;
  /** e.g. ["drive signups", "showcase menu", "book tables"] */
  primaryGoals: string[];
  /** Optional locale for labels (nb | en). */
  locale?: "nb" | "en" | null;
};

/** A node in the recommended page tree (hierarchical). */
export type PageTreeNode = {
  /** Path segment or full path (e.g. "/" or "/meny" or "/om-oss"). */
  path: string;
  /** Display title. */
  title: string;
  /** Optional short description or purpose. */
  description?: string;
  /** Child pages. */
  children?: PageTreeNode[];
};

/** A single primary navigation item. */
export type PrimaryNavItem = {
  label: string;
  path: string;
  /** Optional order hint (lower = earlier). */
  order?: number;
};

/** A secondary nav item or group. */
export type SecondaryNavItem = {
  label: string;
  path: string;
  /** If set, this item is a group header; children listed separately in architecture. */
  children?: { label: string; path: string }[];
  order?: number;
};

/** A recommended landing page. */
export type LandingPageRecommendation = {
  /** Suggested path/slug. */
  path: string;
  /** Page title. */
  title: string;
  /** Purpose or conversion goal (e.g. "lead capture", "product launch"). */
  purpose: string;
  /** Optional priority for implementation. */
  priority?: "low" | "medium" | "high";
};

/** Output of the site architecture generator. */
export type GenerateSiteArchitectureOutput = {
  /** Hierarchical recommended page structure. */
  recommendedPageTree: PageTreeNode[];
  /** Top-level navigation items. */
  primaryNavigation: PrimaryNavItem[];
  /** Secondary/footer or section navigation. */
  secondaryNavigation: SecondaryNavItem[];
  /** Recommended landing pages and their purposes. */
  landingPages: LandingPageRecommendation[];
  /** Optional summary of the recommendation (locale-aware). */
  summary?: string;
};

const defaultBusinessType = "";
const defaultAudience = "";
const defaultGoals: string[] = [];

function normalizeInput(input: GenerateSiteArchitectureInput): {
  businessType: string;
  audience: string;
  goals: string[];
  isEn: boolean;
} {
  const businessType =
    typeof input.businessType === "string" ? input.businessType.trim() : defaultBusinessType;
  const audience =
    typeof input.audience === "string" ? input.audience.trim() : defaultAudience;
  const goals = Array.isArray(input.primaryGoals)
    ? input.primaryGoals
        .filter((g) => typeof g === "string" && g.trim())
        .map((g) => (g as string).trim())
    : defaultGoals;
  const isEn = input.locale === "en";
  return { businessType, audience, goals, isEn };
}

function buildDefaultPageTree(isEn: boolean): PageTreeNode[] {
  const home = isEn ? "Home" : "Hjem";
  const about = isEn ? "About" : "Om oss";
  const contact = isEn ? "Contact" : "Kontakt";
  const services = isEn ? "Services" : "Tjenester";
  const products = isEn ? "Products" : "Produkter";

  return [
    {
      path: "/",
      title: home,
      description: isEn ? "Main entry and hero." : "Hovedside og hero.",
      children: [
        {
          path: "/om-oss",
          title: about,
          description: isEn ? "Company and team." : "Selskap og team.",
        },
        {
          path: "/tjenester",
          title: services,
          description: isEn ? "Service offerings." : "Tjenestetilbud.",
          children: [],
        },
        {
          path: "/produkter",
          title: products,
          description: isEn ? "Product catalog or list." : "Produktkatalog eller liste.",
          children: [],
        },
        {
          path: "/kontakt",
          title: contact,
          description: isEn ? "Contact and lead capture." : "Kontakt og leadfangst.",
        },
      ],
    },
  ];
}

function buildDefaultPrimaryNav(isEn: boolean): PrimaryNavItem[] {
  return [
    { label: isEn ? "Home" : "Hjem", path: "/", order: 0 },
    { label: isEn ? "About" : "Om oss", path: "/om-oss", order: 1 },
    { label: isEn ? "Services" : "Tjenester", path: "/tjenester", order: 2 },
    { label: isEn ? "Contact" : "Kontakt", path: "/kontakt", order: 3 },
  ];
}

function buildDefaultSecondaryNav(isEn: boolean): SecondaryNavItem[] {
  const privacy = isEn ? "Privacy" : "Personvern";
  const terms = isEn ? "Terms" : "Vilkår";
  return [
    { label: privacy, path: "/personvern", order: 0 },
    { label: terms, path: "/vilkar", order: 1 },
  ];
}

function buildDefaultLandingPages(isEn: boolean): LandingPageRecommendation[] {
  return [
    {
      path: "/",
      title: isEn ? "Home" : "Hjem",
      purpose: isEn ? "Main entry and trust." : "Hovedinngang og tillit.",
      priority: "high",
    },
    {
      path: "/kontakt",
      title: isEn ? "Contact" : "Kontakt",
      purpose: isEn ? "Lead capture and inquiries." : "Leadfangst og henvendelser.",
      priority: "high",
    },
  ];
}

/** Maps business type to extra tree nodes and landing pages. */
function applyBusinessType(
  businessType: string,
  isEn: boolean,
  tree: PageTreeNode[],
  landingPages: LandingPageRecommendation[]
): void {
  const key = businessType.toLowerCase();
  if (key.includes("restaurant") || key.includes("lunch") || key.includes("catering")) {
    const meny = isEn ? "Menu" : "Meny";
    const bestill = isEn ? "Order" : "Bestill";
    const root = tree[0];
    if (root?.children) {
      root.children.push(
        { path: "/meny", title: meny, description: isEn ? "Food and drinks." : "Mat og drikke." },
        { path: "/bestill", title: bestill, description: isEn ? "Order or book." : "Bestilling eller bordbestilling." }
      );
    }
    landingPages.push({
      path: "/meny",
      title: meny,
      purpose: isEn ? "Showcase menu and offerings." : "Vise meny og tilbud.",
      priority: "high",
    });
  }
  if (key.includes("e-commerce") || key.includes("shop") || key.includes("butikk")) {
    const shop = isEn ? "Shop" : "Butikk";
    const root = tree[0];
    if (root?.children) {
      root.children.push({
        path: "/butikk",
        title: shop,
        description: isEn ? "Product catalog and cart." : "Produktkatalog og handlekurv.",
      });
    }
    landingPages.push({
      path: "/butikk",
      title: shop,
      purpose: isEn ? "Product discovery and sales." : "Produktoppdagelse og salg.",
      priority: "high",
    });
  }
  if (key.includes("saas") || key.includes("software")) {
    const pricing = isEn ? "Pricing" : "Priser";
    const root = tree[0];
    if (root?.children) {
      root.children.push(
        { path: "/priser", title: pricing, description: isEn ? "Plans and pricing." : "Planer og priser." }
      );
    }
    landingPages.push({
      path: "/priser",
      title: pricing,
      purpose: isEn ? "Conversion and signups." : "Konvertering og registrering.",
      priority: "high",
    });
  }
}

/**
 * Generates a recommended site architecture from business type, audience, and primary goals.
 * Returns recommended page tree, primary and secondary navigation, and landing pages.
 * Deterministic; safe to call without external services.
 */
export function generateSiteArchitecture(
  input: GenerateSiteArchitectureInput
): GenerateSiteArchitectureOutput {
  const { businessType, audience, goals, isEn } = normalizeInput(input);

  const recommendedPageTree = buildDefaultPageTree(isEn);
  const primaryNavigation = buildDefaultPrimaryNav(isEn);
  const secondaryNavigation = buildDefaultSecondaryNav(isEn);
  const landingPages = buildDefaultLandingPages(isEn);

  applyBusinessType(businessType, isEn, recommendedPageTree, landingPages);

  const summary = isEn
    ? `Recommended architecture for ${businessType || "your business"} targeting ${audience || "your audience"}. Goals: ${goals.length ? goals.join(", ") : "general presence"}.`
    : `Anbefalt struktur for ${businessType || "virksomheten"} med målgruppe ${audience || "din målgruppe"}. Mål: ${goals.length ? goals.join(", ") : "generell tilstedeværelse"}.`;

  return {
    recommendedPageTree,
    primaryNavigation,
    secondaryNavigation,
    landingPages,
    summary,
  };
}
