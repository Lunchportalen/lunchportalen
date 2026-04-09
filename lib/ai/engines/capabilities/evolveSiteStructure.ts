/**
 * AI site evolution engine capability: evolveSiteStructure.
 * Suggests incremental evolution of site structure: add pages/sections, merge or retire pages,
 * reorder navigation, improve discoverability. Consumes current structure and optional goals.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "evolveSiteStructure";

const evolveSiteStructureCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI site evolution engine: suggests incremental evolution of site structure from current pages and nav. Outputs add page/section, merge, retire, reorder nav, improve discoverability—with rationale and priority. Consumes current structure and optional goals. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Evolve site structure input",
    properties: {
      currentPages: {
        type: "array",
        description: "Current pages (path, title, optional purpose)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            purpose: { type: "string" },
          },
        },
      },
      currentNav: {
        type: "array",
        description: "Current primary nav (path, label)",
        items: {
          type: "object",
          properties: { path: { type: "string" }, label: { type: "string" } },
        },
      },
      goals: {
        type: "array",
        description: "Optional evolution goals (e.g. add_blog, add_pricing, simplify_nav, improve_discoverability)",
        items: { type: "string" },
      },
      businessType: { type: "string", description: "Optional (e.g. saas, restaurant, e-commerce)" },
      audience: { type: "string", description: "Optional target audience" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxSuggestions: { type: "number", description: "Max evolution steps to return (default 15)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Site structure evolution suggestions",
    required: ["evolutions", "summary"],
    properties: {
      evolutions: {
        type: "array",
        items: {
          type: "object",
          required: ["kind", "message", "priority", "rationale"],
          properties: {
            kind: { type: "string", description: "add_page | add_section | merge_pages | retire_page | reorder_nav | add_to_nav | improve_discoverability" },
            message: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            rationale: { type: "string" },
            path: { type: "string" },
            suggestedPath: { type: "string" },
            suggestedTitle: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is evolution suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(evolveSiteStructureCapability);

export type CurrentPageInput = {
  path: string;
  title: string;
  purpose?: string | null;
};

export type EvolveSiteStructureInput = {
  currentPages?: CurrentPageInput[] | null;
  currentNav?: Array<{ path: string; label?: string | null }> | null;
  goals?: string[] | null;
  businessType?: string | null;
  audience?: string | null;
  locale?: "nb" | "en" | null;
  maxSuggestions?: number | null;
};

export type EvolutionKind =
  | "add_page"
  | "add_section"
  | "merge_pages"
  | "retire_page"
  | "reorder_nav"
  | "add_to_nav"
  | "improve_discoverability";

export type StructureEvolution = {
  kind: EvolutionKind;
  message: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  path?: string | null;
  suggestedPath?: string | null;
  suggestedTitle?: string | null;
};

export type EvolveSiteStructureOutput = {
  evolutions: StructureEvolution[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normPath(p: string): string {
  return (p ?? "").trim().replace(/\/$/, "") || "/";
}

/**
 * Suggests site structure evolution from current state and optional goals. Deterministic; no external calls.
 */
export function evolveSiteStructure(input: EvolveSiteStructureInput = {}): EvolveSiteStructureOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxSuggestions = Math.min(30, Math.max(1, Math.floor(Number(input.maxSuggestions) ?? 15)));

  const pages = Array.isArray(input.currentPages)
    ? input.currentPages.filter(
        (p): p is CurrentPageInput =>
          p != null && typeof p === "object" && typeof (p as CurrentPageInput).path === "string"
      )
    : [];
  const navPaths = new Set(
    (Array.isArray(input.currentNav) ? input.currentNav : [])
      .map((n) => normPath((n as { path?: string }).path ?? ""))
      .filter(Boolean)
  );
  const pagePaths = new Set(pages.map((p) => normPath(p.path)));
  const goals = Array.isArray(input.goals)
    ? input.goals.map((g) => (typeof g === "string" ? g.trim().toLowerCase() : "")).filter(Boolean)
    : [];
  const businessType = safeStr(input.businessType).toLowerCase();
  const audience = safeStr(input.audience);

  const evolutions: StructureEvolution[] = [];
  const seen = new Set<string>();

  const add = (
    kind: EvolutionKind,
    message: string,
    priority: StructureEvolution["priority"],
    rationale: string,
    opts?: { path?: string; suggestedPath?: string; suggestedTitle?: string }
  ) => {
    const key = `${kind}:${opts?.path ?? ""}:${opts?.suggestedPath ?? ""}`;
    if (seen.has(key) || evolutions.length >= maxSuggestions) return;
    seen.add(key);
    evolutions.push({
      kind,
      message,
      priority,
      rationale,
      path: opts?.path,
      suggestedPath: opts?.suggestedPath,
      suggestedTitle: opts?.suggestedTitle,
    });
  };

  const hasPath = (p: string) => pagePaths.has(normPath(p));
  const inNav = (p: string) => navPaths.has(normPath(p));

  if (!hasPath("/")) {
    add(
      "add_page",
      isEn ? "Add a dedicated home page (/) if missing." : "Legg til en egen hjemmeside (/) dersom den mangler.",
      "high",
      isEn ? "Home is the main entry; ensure it exists and is in nav." : "Hjem er hovedinngangen; sikre at den finnes og er i menyen.",
      { suggestedPath: "/", suggestedTitle: isEn ? "Home" : "Hjem" }
    );
  }

  if (!hasPath("/kontakt") && !hasPath("/contact")) {
    add(
      "add_page",
      isEn ? "Add a contact page (/kontakt or /contact)." : "Legg til en kontaktside (/kontakt eller /contact).",
      "high",
      isEn ? "Contact is a key conversion and trust page." : "Kontakt er en viktig konverterings- og tillitsside.",
      { suggestedPath: "/kontakt", suggestedTitle: isEn ? "Contact" : "Kontakt" }
    );
  }

  if ((businessType.includes("saas") || businessType.includes("software")) && !hasPath("/priser") && !hasPath("/pricing")) {
    add(
      "add_page",
      isEn ? "Add a pricing page (/priser or /pricing) for SaaS." : "Legg til en prisside (/priser eller /pricing) for SaaS.",
      "high",
      isEn ? "Pricing pages support conversion and qualify leads." : "Prissider støtter konvertering og kvalifiserer leads.",
      { suggestedPath: "/priser", suggestedTitle: isEn ? "Pricing" : "Priser" }
    );
  }

  if (goals.includes("add_blog") && !pagePaths.has("/blog") && !pages.some((p) => normPath(p.path).startsWith("/blog"))) {
    add(
      "add_section",
      isEn ? "Add a blog section (/blog) for content marketing." : "Legg til en bloggseksjon (/blog) for innholdsmarkedsføring.",
      "medium",
      isEn ? "Blog supports SEO and thought leadership." : "Blogg støtter SEO og tankeledelse.",
      { suggestedPath: "/blog", suggestedTitle: isEn ? "Blog" : "Blogg" }
    );
  }

  if (goals.includes("add_pricing") && !hasPath("/priser") && !hasPath("/pricing")) {
    add(
      "add_page",
      isEn ? "Add a pricing or plans page." : "Legg til en prisside eller pakkeside.",
      "medium",
      isEn ? "Explicit pricing improves conversion clarity." : "Tydelig prising forbedrer konverteringsklarhet.",
      { suggestedPath: "/priser", suggestedTitle: isEn ? "Pricing" : "Priser" }
    );
  }

  for (const p of pages) {
    const path = normPath(p.path);
    if (path === "/") continue;
    if (!inNav(path) && pagePaths.has(path)) {
      add(
        "add_to_nav",
        isEn ? `Add «${p.title}» (${path}) to primary navigation.` : `Legg «${p.title}» (${path}) til i hovedmenyen.`,
        "medium",
        isEn ? "Pages in nav are more discoverable." : "Sider i menyen er lettere å finne.",
        { path }
      );
    }
  }

  if (navPaths.size > 7 && goals.includes("simplify_nav")) {
    add(
      "reorder_nav",
      isEn ? "Simplify primary nav: consider grouping or reducing to 5–7 items." : "Forenkle hovedmeny: vurder gruppering eller redusering til 5–7 elementer.",
      "medium",
      isEn ? "Fewer top-level items reduce cognitive load." : "Færre toppnivå-elementer reduserer kognitiv belastning.",
      { path: "" }
    );
  }

  if (goals.includes("improve_discoverability") && !inNav("/kontakt") && hasPath("/kontakt")) {
    add(
      "improve_discoverability",
      isEn ? "Ensure Contact is in primary nav for discoverability." : "Sikre at Kontakt er i hovedmenyen for finnbarhet.",
      "high",
      isEn ? "Key conversion pages should be one click from home." : "Viktige konverteringssider bør være ett klikk fra hjem.",
      { path: "/kontakt" }
    );
  }

  if (pages.length > 10 && !goals.includes("add_blog")) {
    add(
      "add_section",
      isEn ? "Consider a blog or resources section to organize content and support SEO." : "Vurder en blogg- eller ressursseksjon for å organisere innhold og støtte SEO.",
      "low",
      isEn ? "Structured content sections improve findability." : "Strukturerte innholdsseksjoner forbedrer finnbarhet.",
      { suggestedPath: "/ressurser", suggestedTitle: isEn ? "Resources" : "Ressurser" }
    );
  }

  evolutions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const summary = isEn
    ? `Site evolution: ${evolutions.length} suggestion(s). Review and apply incrementally.`
    : `Nettstedsutvikling: ${evolutions.length} forslag. Gå gjennom og bruk inkrementelt.`;

  return {
    evolutions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { evolveSiteStructureCapability, CAPABILITY_NAME };
