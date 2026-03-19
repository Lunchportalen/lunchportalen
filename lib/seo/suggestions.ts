/**
 * Structured SEO suggestion engine.
 * Builds actionable suggestions from page analysis. Never overwrites content; suggestions require explicit user apply.
 * Each suggestion has: type, suggested change, explanation. Invalid output is not produced (deterministic builder).
 */

import type { PageSeoAnalysis } from "@/lib/seo/pageAnalysis";
import { SEO_SCORE_CONSTANTS } from "@/lib/seo/scoring";

export const SEO_SUGGESTION_CONSTANTS = {
  MAX_TITLE: 120,
  RECOMMENDED_TITLE_MIN: 50,
  RECOMMENDED_TITLE_MAX: 60,
  RECOMMENDED_DESC_MIN: 155,
  RECOMMENDED_DESC_MAX: 160,
  TITLE_SUFFIX: " – Lunchportalen",
} as const;

export type SeoSuggestionType =
  | "title_improvement"
  | "meta_description_improvement"
  | "heading_hierarchy"
  | "content_depth"
  | "internal_linking"
  | "missing_structured_content"
  | "weak_cta_intent"
  | "image_alt_missing"
  | "keyword_topic";

/** One structured suggestion: type, suggested change, explanation. No auto-apply. */
export type SeoSuggestionItem = {
  type: SeoSuggestionType;
  label: string;
  before: string;
  suggested: string;
  explanation: string;
  priority: "high" | "medium" | "low";
  metaField?: "seo.title" | "seo.description";
};

export type BuildSeoSuggestionsOptions = {
  locale: "nb" | "en";
  brand: string;
  goal: "lead" | "info" | "signup";
  pageTitle: string;
  /** Current primary keyword from meta.intent (if set). Used to decide whether to suggest keyword. */
  primaryKeyword?: string;
};

function metaDescriptionTemplate(locale: string, brand: string, goal: string): string {
  if (locale === "en") {
    const g = goal === "signup" ? "sign up" : goal === "info" ? "information" : "leads";
    return `${brand} helps workplaces with lunch ordering and delivery. Get ${g}, request a demo, or contact us.`.slice(0, 160);
  }
  const g = goal === "signup" ? "registrering" : goal === "info" ? "informasjon" : "forespørsler";
  return `${brand} hjelper arbeidsplasser med lunsjbestilling og levering. Få ${g}, be om demo eller ta kontakt.`.slice(0, 160);
}

/** Derive a single keyword phrase from title or first heading (no stuffing). */
function suggestPrimaryKeywordFromContext(title: string, firstHeading: string): string | null {
  const src = (firstHeading || title).trim();
  if (!src) return null;
  const trimmed = src.slice(0, 60).trim();
  return trimmed || null;
}

export type BuildSeoSuggestionsResult = {
  suggestions: SeoSuggestionItem[];
  totalDeduction: number;
};

/**
 * Build structured SEO suggestions from page analysis. References page context (title, headings, etc.).
 * Never overwrites content; caller must apply suggestions explicitly.
 */
export function buildSeoSuggestions(
  analysis: PageSeoAnalysis,
  opts: BuildSeoSuggestionsOptions
): BuildSeoSuggestionsResult {
  const { locale, brand, goal, pageTitle, primaryKeyword = "" } = opts;
  const suggestions: SeoSuggestionItem[] = [];
  let totalDeduction = 0;

  const {
    RECOMMENDED_TITLE_MIN,
    RECOMMENDED_TITLE_MAX,
    RECOMMENDED_DESC_MIN,
    RECOMMENDED_DESC_MAX,
    MAX_TITLE,
    TITLE_SUFFIX,
  } = SEO_SUGGESTION_CONSTANTS;

  const seoTitle = analysis.title;
  const seoDescription = analysis.description;

  // —— Title ——
  const titleLen = seoTitle.length;
  if (titleLen === 0) {
    totalDeduction += 25;
    const suggested = pageTitle ? `${pageTitle}${TITLE_SUFFIX}` : (locale === "en" ? "Lunchportalen – Corporate lunch" : "Lunchportalen – Firmalunsj");
    suggestions.push({
      type: "title_improvement",
      label: locale === "en" ? "SEO title" : "SEO-tittel",
      before: pageTitle || "(tom)",
      suggested,
      explanation:
        locale === "en"
          ? "Search results use the page title. Adding a clear SEO title improves click-through and branding."
          : "Søkeresultat bruker sidetittel. En tydelig SEO-tittel bedrer klikk og merkevare.",
      priority: "high",
      metaField: "seo.title",
    });
  } else if (titleLen < RECOMMENDED_TITLE_MIN) {
    totalDeduction += 15;
    const suggested = seoTitle.includes("–") || seoTitle.includes("Lunchportalen") ? seoTitle : `${seoTitle}${TITLE_SUFFIX}`;
    suggestions.push({
      type: "title_improvement",
      label: locale === "en" ? "SEO title" : "SEO-tittel",
      before: seoTitle,
      suggested: suggested.slice(0, MAX_TITLE),
      explanation:
        locale === "en"
          ? `Current title is ${titleLen} characters. Recommended 50–60 for better display in search results.`
          : `Nåværende tittel er ${titleLen} tegn. Anbefalt 50–60 for bedre visning i søk.`,
      priority: "high",
      metaField: "seo.title",
    });
  } else if (titleLen > RECOMMENDED_TITLE_MAX) {
    totalDeduction += 10;
    suggestions.push({
      type: "title_improvement",
      label: locale === "en" ? "SEO title" : "SEO-tittel",
      before: seoTitle,
      suggested: seoTitle.slice(0, RECOMMENDED_TITLE_MAX) + "…",
      explanation:
        locale === "en"
          ? "Long titles are truncated in search results. Shortening keeps the main message visible."
          : "Lange titler klippes i søk. Kortere tittel holder hovedbudskapet synlig.",
      priority: "medium",
      metaField: "seo.title",
    });
  }

  // —— Meta description ——
  const descLen = seoDescription.length;
  if (descLen === 0) {
    totalDeduction += 25;
    const suggested = metaDescriptionTemplate(locale, brand, goal);
    suggestions.push({
      type: "meta_description_improvement",
      label: locale === "en" ? "Meta description" : "Meta-beskrivelse",
      before: locale === "en" ? "(empty)" : "(tom)",
      suggested,
      explanation:
        locale === "en"
          ? "Meta description appears under the title in search results. A short summary improves relevance and clicks."
          : "Meta-beskrivelse vises under tittel i søk. En kort oppsummering styrker relevans og klikk.",
      priority: "high",
      metaField: "seo.description",
    });
  } else if (descLen < RECOMMENDED_DESC_MIN) {
    totalDeduction += 12;
    const suggested = metaDescriptionTemplate(locale, brand, goal);
    suggestions.push({
      type: "meta_description_improvement",
      label: locale === "en" ? "Meta description" : "Meta-beskrivelse",
      before: seoDescription,
      suggested,
      explanation:
        locale === "en"
          ? `Description is ${descLen} characters. Aim for 155–160 so search engines can show a full snippet.`
          : `Beskrivelsen er ${descLen} tegn. Anbefalt 155–160 slik at søkemotorer viser full snippet.`,
      priority: "medium",
      metaField: "seo.description",
    });
  } else if (descLen > RECOMMENDED_DESC_MAX) {
    totalDeduction += 5;
    suggestions.push({
      type: "meta_description_improvement",
      label: locale === "en" ? "Meta description" : "Meta-beskrivelse",
      before: seoDescription,
      suggested: seoDescription.slice(0, RECOMMENDED_DESC_MAX) + "…",
      explanation:
        locale === "en"
          ? "Long descriptions are often cut off. Keeping within 155–160 characters shows the full text in search."
          : "Lange beskrivelser klippes ofte. 155–160 tegn gjør at full tekst vises i søk.",
      priority: "low",
      metaField: "seo.description",
    });
  }

  // —— Heading hierarchy ——
  const firstHeading = analysis.firstHeading;
  if (firstHeading.length > 60) {
    totalDeduction += 8;
    suggestions.push({
      type: "heading_hierarchy",
      label: locale === "en" ? "First heading" : "Første overskrift",
      before: firstHeading,
      suggested: firstHeading.slice(0, 57) + "…",
      explanation:
        locale === "en"
          ? "First heading is over 60 characters. Shorter headings work better as H1 and in snippets."
          : "Første overskrift er over 60 tegn. Kortere overskrifter fungerer bedre som H1 og i snippet.",
      priority: "medium",
    });
  } else if (analysis.blocksAnalyzed > 0 && !firstHeading) {
    totalDeduction += 5;
    suggestions.push({
      type: "heading_hierarchy",
      label: locale === "en" ? "Heading hierarchy" : "Overskriftshierarki",
      before: locale === "en" ? "No clear first heading" : "Ingen tydelig første overskrift",
      suggested: locale === "en" ? "Add a short H1-style heading in the first text block." : "Legg til en kort H1-overskrift i første tekstblokk.",
      explanation:
        locale === "en"
          ? "A clear first heading helps structure the page and can be used in search snippets."
          : "En tydelig første overskrift styrker sidens struktur og kan brukes i søkesnippet.",
      priority: "low",
    });
  }

  // —— Content depth ——
  const { MIN_BODY_WORDS, CONTENT_DEPTH_DEDUCTION } = SEO_SCORE_CONSTANTS;
  if (analysis.blocksAnalyzed >= 1 && analysis.bodyWordCount < MIN_BODY_WORDS) {
    totalDeduction += CONTENT_DEPTH_DEDUCTION;
    suggestions.push({
      type: "content_depth",
      label: locale === "en" ? "Content depth" : "Innholdsdybde",
      before:
        locale === "en"
          ? `${analysis.bodyWordCount} words in body`
          : `${analysis.bodyWordCount} ord i brødtekst`,
      suggested:
        locale === "en"
          ? "Add more body content (aim for at least 50 words) to improve relevance and clarity."
          : "Legg til mer brødtekst (minst 50 ord) for bedre relevans og tydelighet.",
      explanation:
        locale === "en"
          ? "Thin content is often ranked lower; sufficient body text helps search engines and users."
          : "Tynt innhold rangeres ofte lavere; tilstrekkelig brødtekst hjelper søkemotorer og brukere.",
      priority: "medium",
    });
  }

  // —— Internal linking ——
  if (analysis.blocksAnalyzed >= 2 && !analysis.hasInternalLinks) {
    totalDeduction += 5;
    suggestions.push({
      type: "internal_linking",
      label: locale === "en" ? "Internal links" : "Interne lenker",
      before: locale === "en" ? "No internal links detected" : "Ingen interne lenker funnet",
      suggested:
        locale === "en"
          ? "Add 1–2 relevant internal links to other pages (e.g. /hvordan, /kontakt)."
          : "Legg til 1–2 relevante interne lenker til andre sider (f.eks. /hvordan, /kontakt).",
      explanation:
        locale === "en"
          ? "Internal links help users and search engines discover related content and strengthen site structure."
          : "Interne lenker hjelper brukere og søkemotorer å finne relatert innhold og styrke sidestruktur.",
      priority: "low",
    });
  }

  // —— FAQ ——
  if (!analysis.hasFaq && analysis.blocksAnalyzed >= 1) {
    totalDeduction += 8;
    suggestions.push({
      type: "missing_structured_content",
      label: locale === "en" ? "FAQ section" : "FAQ-seksjon",
      before: locale === "en" ? "No FAQ block" : "Ingen FAQ-blokk",
      suggested:
        locale === "en"
          ? "Add a short FAQ section (e.g. «Spørsmål og svar») to improve snippet and clarity."
          : "Legg til en kort FAQ-seksjon (f.eks. «Spørsmål og svar») for bedre snippet og tydelighet.",
      explanation:
        locale === "en"
          ? "FAQ sections can be shown as rich snippets in search and answer common questions clearly."
          : "FAQ-seksjoner kan vises som rike snippet i søk og besvarer vanlige spørsmål tydelig.",
      priority: "medium",
    });
  }

  // —— CTA ——
  if (!analysis.hasCta && analysis.blocksAnalyzed >= 1) {
    totalDeduction += 10;
    suggestions.push({
      type: "missing_structured_content",
      label: locale === "en" ? "Call-to-action" : "Oppfordring til handling",
      before: locale === "en" ? "No CTA block" : "Ingen CTA-blokk",
      suggested:
        locale === "en"
          ? "Add a CTA block with a clear button (e.g. «Request a demo»)."
          : "Legg til en CTA-blokk med tydelig knapp (f.eks. «Be om demo»).",
      explanation:
        locale === "en"
          ? "A clear call-to-action guides visitors to the next step and supports conversion goals."
          : "En tydelig oppfordring til handling leder besøkende til neste steg og støtter konverteringsmål.",
      priority: "high",
    });
  }

  // —— Weak CTA ——
  if (analysis.hasCta) {
    const weak =
      !analysis.ctaButtonLabel ||
      analysis.ctaButtonLabel.toLowerCase() === "klikk her" ||
      analysis.ctaButtonLabel.toLowerCase() === "click here" ||
      !analysis.ctaTitle;
    if (weak) {
      totalDeduction += 8;
      suggestions.push({
        type: "weak_cta_intent",
        label: locale === "en" ? "CTA clarity" : "CTA-tydelighet",
        before: analysis.ctaButtonLabel || analysis.ctaTitle || "(empty)",
        suggested:
          locale === "en"
            ? "Use a specific label (e.g. «Request a demo», «Contact us») and a short headline."
            : "Bruk en konkret knappetekst (f.eks. «Be om demo», «Kontakt oss») og en kort overskrift.",
        explanation:
          locale === "en"
            ? "Generic buttons like «Click here» reduce trust. Specific labels clarify the action and improve clicks."
            : "Generiske knapper som «Klikk her» svekker tillit. Konkrete etiketter tydeliggjør handlingen og øker klikk.",
        priority: "medium",
      });
    }
  }

  // —— Image alt ——
  const imagesMissingAlt = analysis.imageAlts.filter((a) => a.empty);
  if (imagesMissingAlt.length > 0) {
    totalDeduction += Math.min(5 * imagesMissingAlt.length, 15);
    suggestions.push({
      type: "image_alt_missing",
      label: locale === "en" ? "Image alt text" : "Bilde alt-tekst",
      before:
        locale === "en"
          ? `${imagesMissingAlt.length} image(s) without alt text`
          : `${imagesMissingAlt.length} bilde(r) uten alt-tekst`,
      suggested:
        locale === "en"
          ? "Add descriptive alt text to all images for accessibility and SEO."
          : "Legg til beskrivende alt-tekst på alle bilder for tilgjengelighet og SEO.",
      explanation:
        locale === "en"
          ? "Alt text is read by screen readers and used by search engines. Describe the image concisely."
          : "Alt-tekst leses av skjermlesere og brukes av søkemotorer. Beskriv bildet kort.",
      priority: imagesMissingAlt.length > 1 ? "high" : "medium",
    });
  }

  // —— Keyword/topic (from page context; no stuffing) ——
  const hasPrimaryKeyword = typeof primaryKeyword === "string" && primaryKeyword.trim().length > 0;
  const suggestedKeyword = suggestPrimaryKeywordFromContext(analysis.title || pageTitle, analysis.firstHeading);
  if (!hasPrimaryKeyword && suggestedKeyword && analysis.blocksAnalyzed >= 1) {
    suggestions.push({
      type: "keyword_topic",
      label: locale === "en" ? "Primary keyword" : "Hovednøkkelord",
      before: locale === "en" ? "(not set)" : "(ikke satt)",
      suggested: suggestedKeyword,
      explanation:
        locale === "en"
          ? "Based on the page title and first heading, this phrase can help align the page with search intent. Add it in the AI & goals tab → Primary keyword."
          : "Basert på sidetittel og første overskrift kan denne frasen styrke sidens søkeintensjon. Legg inn i fanen AI & mål → Hovednøkkelord.",
      priority: "medium",
    });
  }

  return { suggestions, totalDeduction };
}

/**
 * Normalize raw suggestion-like object to a safe shape. Returns null if too invalid to use.
 * Use when parsing AI or external output; prevents invalid data from crashing consumers.
 */
export function normalizeSeoSuggestionItem(raw: unknown): SeoSuggestionItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type.trim() : "";
  const validTypes: SeoSuggestionType[] = [
    "title_improvement",
    "meta_description_improvement",
    "heading_hierarchy",
    "content_depth",
    "internal_linking",
    "missing_structured_content",
    "weak_cta_intent",
    "image_alt_missing",
    "keyword_topic",
  ];
  if (!validTypes.includes(type as SeoSuggestionType)) return null;
  const suggested = typeof o.suggested === "string" ? o.suggested.trim() : "";
  const label = typeof o.label === "string" ? o.label.trim() : type;
  const before = typeof o.before === "string" ? o.before : "";
  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  const priority = o.priority === "high" || o.priority === "low" ? o.priority : "medium";
  const metaField =
    o.metaField === "seo.title" || o.metaField === "seo.description" ? o.metaField : undefined;
  return {
    type: type as SeoSuggestionType,
    label: label || type,
    before,
    suggested,
    explanation,
    priority,
    ...(metaField && { metaField }),
  };
}
