/**
 * Block accessibility checker capability: checkBlockAccessibility.
 * Checks a single block (hero, richText, cta, image, form, divider) for accessibility:
 * alt text, link/button names, heading context, form labels. Returns score, issues, and summary.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "checkBlockAccessibility";

const checkBlockAccessibilityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Checks a block for accessibility: image alt text, link/button names, heading context, form labels. Returns accessibility score (0-100), issues with severity and suggestion, and summary. Supports hero, richText, cta, image, form, divider. Deterministic; no LLM.",
  requiredContext: ["block"],
  inputSchema: {
    type: "object",
    description: "Check block accessibility input",
    properties: {
      block: {
        type: "object",
        description: "Block to check (id, type, data)",
        properties: {
          id: { type: "string" },
          type: { type: "string", description: "hero, richText, cta, image, form, divider" },
          data: { type: "object" },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      headingLevelHint: { type: "number", description: "Optional: expected heading level (1-6) for this block" },
    },
    required: ["block"],
  },
  outputSchema: {
    type: "object",
    description: "Block accessibility result",
    required: ["accessibilityScore", "issues", "summary"],
    properties: {
      accessibilityScore: { type: "number", description: "0-100 (higher = fewer issues)" },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "message", "suggestion", "severity"],
          properties: {
            code: { type: "string", description: "e.g. missing_alt, link_no_text, form_no_id" },
            message: { type: "string" },
            suggestion: { type: "string" },
            severity: { type: "string", description: "critical | serious | moderate" },
            field: { type: "string", description: "Relevant data field if any" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(checkBlockAccessibilityCapability);

export type CheckBlockAccessibilityBlockInput = {
  id: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type CheckBlockAccessibilityInput = {
  block: CheckBlockAccessibilityBlockInput;
  locale?: "nb" | "en" | null;
  headingLevelHint?: number | null;
};

export type AccessibilityIssue = {
  code: string;
  message: string;
  suggestion: string;
  severity: "critical" | "serious" | "moderate";
  field?: string | null;
};

export type CheckBlockAccessibilityOutput = {
  accessibilityScore: number;
  issues: AccessibilityIssue[];
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const GENERIC_ALTS = ["image", "picture", "bilde", "photo", "bilde", "img", ""];

function isGenericAlt(alt: string): boolean {
  const t = alt.toLowerCase().trim();
  return GENERIC_ALTS.includes(t) || t.length < 3;
}

/**
 * Checks a block for accessibility issues. Deterministic; no external calls.
 */
export function checkBlockAccessibility(input: CheckBlockAccessibilityInput): CheckBlockAccessibilityOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const block = input.block && typeof input.block === "object" ? input.block : { id: "", type: "", data: {} };
  const data = block.data && typeof block.data === "object" && !Array.isArray(block.data) ? (block.data as Record<string, unknown>) : {};
  const type = (block.type ?? "").trim().toLowerCase();

  const issues: AccessibilityIssue[] = [];

  function add(
    code: string,
    message: string,
    suggestion: string,
    severity: AccessibilityIssue["severity"],
    field?: string | null
  ) {
    issues.push({ code, message, suggestion, severity, field: field ?? undefined });
  }

  if (type === "hero") {
    const title = str(data.title ?? data.heading ?? "");
    const imageUrl = str(data.imageUrl ?? data.src ?? "");
    const imageAlt = str(data.imageAlt ?? data.alt ?? "");

    if (imageUrl && !imageAlt) {
      add(
        "missing_alt",
        isEn ? "Hero image has no alt text; screen readers cannot describe it." : "Hero-bilde mangler alt-tekst; skjermlesere kan ikke beskrive det.",
        isEn ? "Add imageAlt (or alt) with a short description of the image." : "Legg til imageAlt (eller alt) med en kort beskrivelse av bildet.",
        "critical",
        "imageAlt"
      );
    } else if (imageUrl && isGenericAlt(imageAlt)) {
      add(
        "generic_alt",
        isEn ? "Hero image alt text is too generic (e.g. «image»); describe what the image shows." : "Hero-bilde alt-tekst er for generisk (f.eks. «bilde»); beskriv hva bildet viser.",
        isEn ? "Use descriptive alt text (e.g. «Team having lunch in office»)." : "Bruk beskrivende alt-tekst (f.eks. «Team som spiser lunsj på kontoret»).",
        "serious",
        "imageAlt"
      );
    }

    const ctaLabel = str(data.ctaLabel ?? "");
    const ctaHref = str(data.ctaHref ?? "");
    if (ctaHref && !ctaLabel) {
      add(
        "link_no_text",
        isEn ? "Hero CTA link has no visible text; assistive tech cannot announce purpose." : "Hero-CTA-lenke har ingen synlig tekst; hjelpeteknologi kan ikke annonsere formål.",
        isEn ? "Add ctaLabel so the link has a discernible name." : "Legg til ctaLabel slik at lenken har et gjenkjennelig navn.",
        "critical",
        "ctaLabel"
      );
    }

    if (!title && !imageUrl) {
      add(
        "hero_no_heading",
        isEn ? "Hero has no heading or image; landmark may lack context." : "Hero har verken overskrift eller bilde; landemerke kan mangle kontekst.",
        isEn ? "Add a title (or heading) for the main page heading (e.g. H1)." : "Legg til en tittel (eller overskrift) for hovedoverskriften (f.eks. H1).",
        "serious",
        "title"
      );
    }
  }

  if (type === "richtext" || type === "richText") {
    const heading = str(data.heading ?? data.title ?? "");
    const body = str(data.body ?? "");

    if (body.length > 0 && !heading && body.length > 200) {
      add(
        "section_no_heading",
        isEn ? "Long text section has no heading; screen reader users may miss structure." : "Lang tekstseksjon har ingen overskrift; skjermlesere kan miste struktur.",
        isEn ? "Add a heading (e.g. H2) to mark the section." : "Legg til en overskrift (f.eks. H2) for å markere seksjonen.",
        "moderate",
        "heading"
      );
    }

    if (heading && heading.length > 150) {
      add(
        "heading_too_long",
        isEn ? "Heading is very long; may be announced in full and harm navigation." : "Overskriften er veldig lang; kan bli lest i sin helhet og hemme navigasjon.",
        isEn ? "Keep headings concise (e.g. under 80 characters)." : "Hold overskrifter konsise (f.eks. under 80 tegn).",
        "moderate",
        "heading"
      );
    }
  }

  if (type === "cta") {
    const buttonLabel = str(data.buttonLabel ?? data.ctaLabel ?? "");
    const href = str(data.buttonHref ?? data.ctaHref ?? data.href ?? "");

    if (href && !buttonLabel) {
      add(
        "link_no_text",
        isEn ? "CTA link has no visible text; link purpose is not announced." : "CTA-lenke har ingen synlig tekst; lenkens formål annonseres ikke.",
        isEn ? "Add buttonLabel (or ctaLabel) so the link has a discernible name." : "Legg til buttonLabel (eller ctaLabel) slik at lenken har et gjenkjennelig navn.",
        "critical",
        "buttonLabel"
      );
    }

    if (buttonLabel && !href) {
      add(
        "link_empty_href",
        isEn ? "CTA has label but no href; link does not navigate." : "CTA har etikett men ingen href; lenken navigerer ikke.",
        isEn ? "Set buttonHref (or href) to the target URL." : "Sett buttonHref (eller href) til mål-URL.",
        "serious",
        "buttonHref"
      );
    }

    if (buttonLabel && (buttonLabel.toLowerCase() === "click here" || buttonLabel.toLowerCase() === "klikk her")) {
      add(
        "link_generic_text",
        isEn ? "«Click here» is not accessible; link purpose must be clear from the text." : "«Klikk her» er ikke tilgjengelig; lenkens formål må fremgå av teksten.",
        isEn ? "Use action-specific text (e.g. «Request demo», «Contact us»)." : "Bruk handlingsspesifikk tekst (f.eks. «Be om demo», «Kontakt oss»).",
        "serious",
        "buttonLabel"
      );
    }
  }

  if (type === "image") {
    const alt = str(data.alt ?? data.imageAlt ?? "");
    const src = str(data.src ?? data.imageUrl ?? data.assetPath ?? "");

    if (src && !alt) {
      add(
        "missing_alt",
        isEn ? "Image has no alt text; required for accessibility." : "Bilde mangler alt-tekst; påkrevd for tilgjengelighet.",
        isEn ? "Add alt (or imageAlt) with a short description. Use empty string only for decorative images." : "Legg til alt (eller imageAlt) med en kort beskrivelse. Bruk tom streng kun for dekorative bilder.",
        "critical",
        "alt"
      );
    } else if (src && isGenericAlt(alt)) {
      add(
        "generic_alt",
        isEn ? "Image alt text is generic; describe what the image shows." : "Bilde alt-tekst er generisk; beskriv hva bildet viser.",
        isEn ? "Use meaningful alt text. Use empty string if the image is purely decorative." : "Bruk meningsfull alt-tekst. Bruk tom streng hvis bildet er rent dekorativt.",
        "serious",
        "alt"
      );
    }
  }

  if (type === "form") {
    const formId = str(data.formId ?? "");
    const title = str(data.title ?? "");

    if (!formId) {
      add(
        "form_no_id",
        isEn ? "Form block has no formId; form cannot be identified by assistive tech." : "Skjemablokk mangler formId; skjema kan ikke identifiseres av hjelpeteknologi.",
        isEn ? "Set formId to the form key so the form has an accessible name/label." : "Sett formId til skjemanøkkel slik at skjemaet får et tilgjengelig navn/etikett.",
        "critical",
        "formId"
      );
    }

    if (!title && formId) {
      add(
        "form_no_label",
        isEn ? "Form has no title; a short title helps users understand the form purpose." : "Skjema har ingen tittel; en kort tittel hjelper brukere å forstå skjemaets formål.",
        isEn ? "Add an optional title (e.g. «Request a demo») for context." : "Legg til en valgfri tittel (f.eks. «Be om demo») for kontekst.",
        "moderate",
        "title"
      );
    }
  }

  if (type === "divider") {
    add(
      "divider_decorative",
      isEn ? "Divider is typically decorative; ensure it is not announced as content (e.g. aria-hidden or role=presentation in render)." : "Skillelinje er vanligvis dekorativ; sørg for at den ikke annonseres som innhold (f.eks. aria-hidden eller role=presentation i render).",
      isEn ? "In the component that renders the divider, use aria-hidden=\"true\" if it has no semantic meaning." : "I komponenten som renderer skillelinjen, bruk aria-hidden=\"true\" hvis den ikke har semantisk betydning.",
      "moderate",
      null
    );
  }

  if (type && !["hero", "richtext", "cta", "image", "form", "divider"].includes(type)) {
    add(
      "unknown_type",
      isEn ? `Block type «${type}» has no accessibility rules; review manually.` : `Blokktype «${type}» har ingen tilgjengelighetsregler; vurder manuelt.`,
      isEn ? "Ensure images have alt, links have discernible names, and forms are labeled." : "Sørg for at bilder har alt, lenker har gjenkjennelige navn og skjemaer er merket.",
      "moderate",
      null
    );
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const seriousCount = issues.filter((i) => i.severity === "serious").length;
  const moderateCount = issues.filter((i) => i.severity === "moderate").length;
  const deduction = criticalCount * 25 + seriousCount * 15 + moderateCount * 5;
  const accessibilityScore = Math.max(0, Math.min(100, 100 - deduction));

  const summary = isEn
    ? `Accessibility score: ${accessibilityScore}/100. ${issues.length} issue(s) (${criticalCount} critical, ${seriousCount} serious, ${moderateCount} moderate).`
    : `Tilgjengelighetsscore: ${accessibilityScore}/100. ${issues.length} problem(er) (${criticalCount} kritiske, ${seriousCount} alvorlige, ${moderateCount} moderate).`;

  return {
    accessibilityScore,
    issues,
    summary,
  };
}

export { checkBlockAccessibilityCapability, CAPABILITY_NAME };
