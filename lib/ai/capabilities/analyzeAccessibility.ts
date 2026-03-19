/**
 * Interface accessibility analyzer capability: analyzeAccessibility.
 * Analyzes an interface snapshot (elements: headings, images, buttons, links, forms)
 * for accessibility issues. Returns issues, criteria, score, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeAccessibility";

const analyzeAccessibilityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Interface accessibility analyzer: from a list of interface elements (headings, images, buttons, links, form controls) with attributes, detects accessibility issues (missing alt, multiple H1, unlabeled controls, etc.). Returns issues with severity, criteria pass/fail, score (0-100), and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Analyze accessibility input",
    properties: {
      elements: {
        type: "array",
        description: "Interface elements to analyze",
        items: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              description: "heading | image | button | link | form_control | landmark",
            },
            id: { type: "string" },
            level: { type: "number", description: "Heading level 1-6" },
            alt: { type: "string", description: "Image alt text" },
            text: { type: "string", description: "Visible or accessible name" },
            ariaLabel: { type: "string" },
            labelAssociated: { type: "boolean", description: "Form control has associated label" },
            role: { type: "string" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["elements"],
  },
  outputSchema: {
    type: "object",
    description: "Accessibility analysis result",
    required: ["issues", "criteria", "accessibilityScore", "summary", "generatedAt"],
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "severity", "message", "recommendation", "elementRef"],
          properties: {
            code: { type: "string" },
            severity: { type: "string", enum: ["critical", "serious", "moderate"] },
            message: { type: "string" },
            recommendation: { type: "string" },
            elementRef: { type: "string" },
          },
        },
      },
      criteria: {
        type: "object",
        description: "WCAG-related criteria pass/fail",
        required: ["oneH1", "headingsOrdered", "imagesHaveAlt", "buttonsLabeled", "linksLabeled", "formControlsLabeled"],
        properties: {
          oneH1: { type: "boolean" },
          headingsOrdered: { type: "boolean" },
          imagesHaveAlt: { type: "boolean" },
          buttonsLabeled: { type: "boolean" },
          linksLabeled: { type: "boolean" },
          formControlsLabeled: { type: "boolean" },
        },
      },
      accessibilityScore: { type: "number", description: "0-100, higher = fewer issues" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Analysis only; does not mutate interface or content.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeAccessibilityCapability);

export type AccessibilityElementInput = {
  type: "heading" | "image" | "button" | "link" | "form_control" | "landmark";
  id?: string | null;
  level?: number | null;
  alt?: string | null;
  text?: string | null;
  ariaLabel?: string | null;
  labelAssociated?: boolean | null;
  role?: string | null;
};

export type AnalyzeAccessibilityInput = {
  elements: AccessibilityElementInput[];
  locale?: "nb" | "en" | null;
};

export type AccessibilityIssueOut = {
  code: string;
  severity: "critical" | "serious" | "moderate";
  message: string;
  recommendation: string;
  elementRef: string;
};

export type AccessibilityCriteria = {
  oneH1: boolean;
  headingsOrdered: boolean;
  imagesHaveAlt: boolean;
  buttonsLabeled: boolean;
  linksLabeled: boolean;
  formControlsLabeled: boolean;
};

export type AnalyzeAccessibilityOutput = {
  issues: AccessibilityIssueOut[];
  criteria: AccessibilityCriteria;
  accessibilityScore: number;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const GENERIC_ALTS = ["image", "picture", "bilde", "photo", "img", ""];

function isMeaningfulAlt(alt: string): boolean {
  const t = alt.toLowerCase().trim();
  return t.length >= 2 && !GENERIC_ALTS.includes(t);
}

function hasAccessibleName(el: AccessibilityElementInput): boolean {
  const text = safeStr(el.text);
  const aria = safeStr(el.ariaLabel);
  return text.length > 0 || aria.length > 0;
}

/**
 * Analyzes interface elements for accessibility issues. Deterministic; no external calls.
 */
export function analyzeAccessibility(input: AnalyzeAccessibilityInput): AnalyzeAccessibilityOutput {
  const elements = Array.isArray(input.elements) ? input.elements : [];
  const isEn = input.locale === "en";

  const issues: AccessibilityIssueOut[] = [];
  const criteria: AccessibilityCriteria = {
    oneH1: true,
    headingsOrdered: true,
    imagesHaveAlt: true,
    buttonsLabeled: true,
    linksLabeled: true,
    formControlsLabeled: true,
  };

  const headings: { index: number; level: number; id?: string }[] = [];
  let h1Count = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el || typeof el !== "object") continue;

    const type = el.type;
    const ref = safeStr(el.id) || `#${i}`;

    if (type === "heading") {
      const level = Math.min(6, Math.max(1, Number(el.level) || 1));
      headings.push({ index: i, level, id: el.id ?? undefined });
      if (level === 1) h1Count++;
      if (!safeStr(el.text) && !safeStr(el.ariaLabel)) {
        issues.push({
          code: "heading_empty",
          severity: "serious",
          message: isEn ? "Heading has no visible or accessible text." : "Overskrift har ingen synlig eller tilgjengelig tekst.",
          recommendation: isEn ? "Add text content or aria-label." : "Legg til tekst eller aria-label.",
          elementRef: ref,
        });
        criteria.headingsOrdered = false;
      }
    }

    if (type === "image") {
      const alt = safeStr(el.alt);
      if (alt.length === 0) {
        issues.push({
          code: "image_missing_alt",
          severity: "critical",
          message: isEn ? "Image has no alt text." : "Bilde mangler alt-tekst.",
          recommendation: isEn ? "Add meaningful alt text, or alt=\"\" if decorative." : "Legg til meningsfull alt-tekst, eller alt=\"\" hvis dekorativt.",
          elementRef: ref,
        });
        criteria.imagesHaveAlt = false;
      } else if (!isMeaningfulAlt(alt)) {
        issues.push({
          code: "image_generic_alt",
          severity: "serious",
          message: isEn ? "Image alt text is generic or too short." : "Alt-tekst er generisk eller for kort.",
          recommendation: isEn ? "Use descriptive alt text for content images." : "Bruk beskrivende alt-tekst for innholdsbilder.",
          elementRef: ref,
        });
        criteria.imagesHaveAlt = false;
      }
    }

    if (type === "button") {
      if (!hasAccessibleName(el)) {
        issues.push({
          code: "button_no_name",
          severity: "critical",
          message: isEn ? "Button has no accessible name." : "Knapp har ikke tilgjengelig navn.",
          recommendation: isEn ? "Add visible text or aria-label." : "Legg til synlig tekst eller aria-label.",
          elementRef: ref,
        });
        criteria.buttonsLabeled = false;
      }
    }

    if (type === "link") {
      if (!hasAccessibleName(el)) {
        issues.push({
          code: "link_no_text",
          severity: "critical",
          message: isEn ? "Link has no visible or accessible text." : "Lenke har ingen synlig eller tilgjengelig tekst.",
          recommendation: isEn ? "Add link text or aria-label." : "Legg til lenketekst eller aria-label.",
          elementRef: ref,
        });
        criteria.linksLabeled = false;
      }
    }

    if (type === "form_control") {
      if (el.labelAssociated !== true && !hasAccessibleName(el)) {
        issues.push({
          code: "form_control_unlabeled",
          severity: "critical",
          message: isEn ? "Form control has no associated label or accessible name." : "Skjemakontroll har ikke tilknyttet etikett eller tilgjengelig navn.",
          recommendation: isEn ? "Use <label> with for/id or aria-label/aria-labelledby." : "Bruk <label> med for/id eller aria-label/aria-labelledby.",
          elementRef: ref,
        });
        criteria.formControlsLabeled = false;
      }
    }
  }

  if (h1Count === 0 && elements.some((e) => e?.type === "heading")) {
    issues.push({
      code: "no_h1",
      severity: "serious",
      message: isEn ? "Page has no H1 heading." : "Siden har ingen H1-overskrift.",
      recommendation: isEn ? "Add exactly one H1 that describes the page topic." : "Legg til nøyaktig én H1 som beskriver sidens tema.",
      elementRef: "page",
    });
    criteria.oneH1 = false;
  } else if (h1Count > 1) {
    issues.push({
      code: "multiple_h1",
      severity: "serious",
      message: isEn ? "Page has more than one H1." : "Siden har mer enn én H1.",
      recommendation: isEn ? "Use a single H1 per view; use H2–H6 for structure." : "Bruk én H1 per visning; bruk H2–H6 for struktur.",
      elementRef: "page",
    });
    criteria.oneH1 = false;
  }

  let prevLevel = 0;
  for (const h of headings) {
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      issues.push({
        code: "heading_skip",
        severity: "moderate",
        message: isEn ? "Heading level skips (e.g. H2 to H4)." : "Overskriftnivå hopper (f.eks. H2 til H4).",
        recommendation: isEn ? "Use sequential heading levels (H2 then H3)." : "Bruk sekvensielle nivåer (H2 deretter H3).",
        elementRef: h.id ?? `heading_${h.index}`,
      });
      criteria.headingsOrdered = false;
    }
    prevLevel = h.level;
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const seriousCount = issues.filter((i) => i.severity === "serious").length;
  const moderateCount = issues.filter((i) => i.severity === "moderate").length;
  const criteriaPassed = Object.values(criteria).filter(Boolean).length;
  const criteriaTotal = Object.keys(criteria).length;
  const accessibilityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - criticalCount * 15 - seriousCount * 8 - moderateCount * 3))
  );

  const summary = isEn
    ? `Accessibility: score ${accessibilityScore}/100. ${issues.length} issue(s) (${criticalCount} critical, ${seriousCount} serious, ${moderateCount} moderate). ${criteriaPassed}/${criteriaTotal} criteria passed.`
    : `Tilgjengelighet: score ${accessibilityScore}/100. ${issues.length} problem(er) (${criticalCount} kritiske, ${seriousCount} alvorlige, ${moderateCount} moderate). ${criteriaPassed}/${criteriaTotal} kriterier bestått.`;

  return {
    issues,
    criteria,
    accessibilityScore,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeAccessibilityCapability, CAPABILITY_NAME };
