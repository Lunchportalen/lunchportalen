/**
 * AI SEO improvement suggestions capability: seoImprove.
 * Returns: missing headings, weak intro, keyword gaps, internal link suggestions.
 * Import this module to register the capability.
 */

import type { PageSeoAnalysis } from "@/lib/seo/pageAnalysis";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "seoImprove";

const seoImproveCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Returns AI SEO improvement suggestions: missing headings, weak intro, keyword gaps, and internal link suggestions. Based on page analysis.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "SEO improve input",
    required: ["analysis"],
    properties: {
      analysis: {
        type: "object",
        description: "PageSeoAnalysis from analyzePageForSeo (title, headings, bodyContent, etc.)",
      },
      primaryKeyword: { type: "string", description: "Primary keyword for gap detection" },
      locale: { type: "string", description: "Locale (nb | en) for suggestion copy" },
    },
  },
  outputSchema: {
    type: "object",
    description: "SEO improvement suggestions",
    required: ["missingHeadings", "weakIntro", "keywordGaps", "internalLinkSuggestions"],
    properties: {
      missingHeadings: { type: "array", items: { type: "string" } },
      weakIntro: { type: "object" },
      keywordGaps: { type: "array", items: { type: "string" } },
      internalLinkSuggestions: { type: "array", items: { type: "object" } },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(seoImproveCapability);

export type SeoImproveInput = {
  analysis: PageSeoAnalysis | null | undefined;
  primaryKeyword?: string | null;
  locale?: "nb" | "en";
};

export type SeoImproveOutput = {
  missingHeadings: string[];
  weakIntro: { detected: boolean; suggestion: string };
  keywordGaps: string[];
  internalLinkSuggestions: Array<{ anchorText: string; targetPath: string; reason: string }>;
};

const INTRO_MIN_LENGTH = 150;
const MIN_HEADINGS_RECOMMENDED = 2;
const INTERNAL_LINK_SUGGESTIONS: Array<{ path: string; anchorNb: string; anchorEn: string }> = [
  { path: "/kontakt", anchorNb: "Kontakt oss", anchorEn: "Contact us" },
  { path: "/hvordan", anchorNb: "Slik fungerer det", anchorEn: "How it works" },
  { path: "/om-oss", anchorNb: "Om oss", anchorEn: "About us" },
];

function isAnalysisValid(a: PageSeoAnalysis | null | undefined): a is PageSeoAnalysis {
  return (
    a != null &&
    typeof a === "object" &&
    Array.isArray(a.headings) &&
    typeof a.bodyWordCount === "number"
  );
}

function emptyOutput(locale: "nb" | "en"): SeoImproveOutput {
  const isEn = locale === "en";
  return {
    missingHeadings: [],
    weakIntro: {
      detected: false,
      suggestion: isEn ? "Intro length is adequate." : "Introteksten er tilstrekkelig lang.",
    },
    keywordGaps: [],
    internalLinkSuggestions: [],
  };
}

/**
 * Returns SEO improvement suggestions: missing headings, weak intro, keyword gaps, internal link suggestions.
 * Deterministic from page analysis; no LLM.
 */
export function seoImprove(input: SeoImproveInput): SeoImproveOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";

  if (!isAnalysisValid(input.analysis)) {
    return emptyOutput(locale);
  }

  const a = input.analysis;
  const missingHeadings: string[] = [];
  const keywordGaps: string[] = [];
  const internalLinkSuggestions: Array<{ anchorText: string; targetPath: string; reason: string }> = [];

  // —— Missing headings ——
  const headingCount = (a.headings ?? []).length;
  if (headingCount === 0) {
    missingHeadings.push(
      isEn
        ? "Add at least one H2-style heading (e.g. in a richText block) to structure the page."
        : "Legg til minst én H2-overskrift (f.eks. i en richText-blokk) for å strukturere siden."
    );
  } else if (headingCount < MIN_HEADINGS_RECOMMENDED) {
    missingHeadings.push(
      isEn
        ? "Add one more section heading to improve scannability and hierarchy."
        : "Legg til én overskrift til for bedre skanbarhet og hierarki."
    );
  }

  const firstHeading = (a.firstHeading ?? "").trim();
  if (firstHeading.length > 70) {
    missingHeadings.push(
      isEn
        ? "Shorten the first heading to under 70 characters for better display in search."
        : "Forkort første overskrift til under 70 tegn for bedre visning i søk."
    );
  }

  // —— Weak intro ——
  const bodyContent = (a.bodyContent ?? "").trim();
  const weakIntroDetected = bodyContent.length > 0 && bodyContent.length < INTRO_MIN_LENGTH;
  const weakIntroSuggestion = weakIntroDetected
    ? isEn
      ? "Expand the opening paragraph to at least 150 characters to clarify the page topic for users and search engines."
      : "Utvid åpningsavsnittet til minst 150 tegn for å tydeliggjøre sidens tema for brukere og søkemotorer."
    : isEn
      ? "Intro length is adequate."
      : "Introteksten er tilstrekkelig lang.";

  // —— Keyword gaps ——
  const primaryKeyword = typeof input.primaryKeyword === "string" ? input.primaryKeyword.trim().toLowerCase() : "";
  if (primaryKeyword) {
    const title = (a.title ?? "").toLowerCase();
    const firstH = (a.firstHeading ?? "").toLowerCase();
    const body = (a.bodyContent ?? "").toLowerCase();
    if (!title.includes(primaryKeyword)) {
      keywordGaps.push(
        isEn ? `Consider including the primary keyword «${primaryKeyword}» in the SEO title.` : `Vurder å inkludere hovednøkkelordet «${primaryKeyword}» i SEO-tittelen.`
      );
    }
    if (!firstH.includes(primaryKeyword) && firstH) {
      keywordGaps.push(
        isEn ? `Consider using the primary keyword in the first heading.` : `Vurder å bruke hovednøkkelordet i første overskrift.`
      );
    }
    if (!body.includes(primaryKeyword) && body.length > 100) {
      keywordGaps.push(
        isEn ? `Use the primary keyword naturally in the body content.` : `Bruk hovednøkkelordet naturlig i brødteksten.`
      );
    }
  }

  // —— Internal link suggestions ——
  const hasInternalLinks = a.hasInternalLinks === true && (a.internalLinkCount ?? 0) > 0;
  if (!hasInternalLinks && a.blocksAnalyzed >= 1) {
    for (const { path, anchorNb, anchorEn } of INTERNAL_LINK_SUGGESTIONS) {
      internalLinkSuggestions.push({
        anchorText: isEn ? anchorEn : anchorNb,
        targetPath: path,
        reason: isEn
          ? "Internal links help users and search engines discover related content."
          : "Interne lenker hjelper brukere og søkemotorer å finne relatert innhold.",
      });
    }
  }

  return {
    missingHeadings,
    weakIntro: { detected: weakIntroDetected, suggestion: weakIntroSuggestion },
    keywordGaps,
    internalLinkSuggestions,
  };
}

export { seoImproveCapability, CAPABILITY_NAME };
