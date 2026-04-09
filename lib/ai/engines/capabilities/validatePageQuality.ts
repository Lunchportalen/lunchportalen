/**
 * AI page QA checker capability: validatePageQuality.
 * Runs deterministic QA checks on a page (title, meta, blocks): structure, accessibility,
 * conversion, SEO, and content. Returns quality score, passed flag, issues by category, and summary.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "validatePageQuality";

const validatePageQualityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Page QA checker: validates page quality across structure, accessibility, conversion, SEO, and content. Returns quality score (0-100), passed flag, issues with category and severity, and summary. Uses page (title, meta, blocks). Deterministic; no LLM.",
  requiredContext: ["page"],
  inputSchema: {
    type: "object",
    description: "Validate page quality input",
    properties: {
      page: {
        type: "object",
        description: "Page to validate (title, meta, blocks)",
        properties: {
          title: { type: "string" },
          meta: {
            type: "object",
            properties: { description: { type: "string" } },
          },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      strictMode: { type: "boolean", description: "If true, passed requires no high/critical issues" },
    },
    required: ["page"],
  },
  outputSchema: {
    type: "object",
    description: "Page quality validation result",
    required: ["qualityScore", "passed", "issues", "summary"],
    properties: {
      qualityScore: { type: "number", description: "0-100 (higher = better)" },
      passed: { type: "boolean", description: "True if QA passed (score >= threshold and no critical)" },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "message", "suggestion", "severity", "category"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            suggestion: { type: "string" },
            severity: { type: "string", description: "critical | high | medium | low" },
            category: { type: "string", description: "structure | accessibility | conversion | seo | content" },
            blockId: { type: "string" },
          },
        },
      },
      checks: {
        type: "object",
        description: "Per-dimension pass/fail (structure, accessibility, conversion, seo, content)",
        properties: {
          structure: { type: "boolean" },
          accessibility: { type: "boolean" },
          conversion: { type: "boolean" },
          seo: { type: "boolean" },
          content: { type: "boolean" },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is validation only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(validatePageQualityCapability);

export type ValidatePageQualityPageInput = {
  title?: string | null;
  meta?: { description?: string | null } | null;
  blocks?: Array<{ id: string; type?: string | null; data?: Record<string, unknown> | null }> | null;
};

export type ValidatePageQualityInput = {
  page: ValidatePageQualityPageInput;
  locale?: "nb" | "en" | null;
  strictMode?: boolean | null;
};

export type PageQualityIssue = {
  code: string;
  message: string;
  suggestion: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "structure" | "accessibility" | "conversion" | "seo" | "content";
  blockId?: string | null;
};

export type ValidatePageQualityOutput = {
  qualityScore: number;
  passed: boolean;
  issues: PageQualityIssue[];
  checks: {
    structure: boolean;
    accessibility: boolean;
    conversion: boolean;
    seo: boolean;
    content: boolean;
  };
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const GENERIC_CTA = ["klikk her", "click here", "submit", "send", "les mer", "read more", "ok"];

function isGenericCta(label: string): boolean {
  const t = label.toLowerCase().trim();
  return GENERIC_CTA.some((g) => t === g || t.includes(g));
}

const SCORE_PASS_THRESHOLD = 70;
const CRITICAL_DEDUCT = 18;
const HIGH_DEDUCT = 12;
const MEDIUM_DEDUCT = 6;
const LOW_DEDUCT = 2;

/**
 * Validates page quality: structure, accessibility, conversion, SEO, content. Deterministic; no external calls.
 */
export function validatePageQuality(input: ValidatePageQualityInput): ValidatePageQualityOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const strictMode = input.strictMode === true;
  const page = input.page && typeof input.page === "object" ? input.page : { title: "", meta: {}, blocks: [] };
  const blocks = Array.isArray(page.blocks)
    ? page.blocks.filter(
        (b): b is { id: string; type?: string | null; data?: Record<string, unknown> | null } =>
          b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string"
      )
    : [];
  const title = str(page.title);
  const metaDesc = str(page.meta?.description ?? "");

  const issues: PageQualityIssue[] = [];
  const categoryIssues: Record<keyof ValidatePageQualityOutput["checks"], number> = {
    structure: 0,
    accessibility: 0,
    conversion: 0,
    seo: 0,
    content: 0,
  };

  function add(
    code: string,
    message: string,
    suggestion: string,
    severity: PageQualityIssue["severity"],
    category: PageQualityIssue["category"],
    blockId?: string | null
  ) {
    issues.push({ code, message, suggestion, severity, category, blockId: blockId ?? undefined });
    categoryIssues[category] += 1;
  }

  const types = blocks.map((b) => (b.type ?? "").trim().toLowerCase());
  const hasHero = types.includes("hero");
  const hasCta = types.includes("cta");
  const heroIndex = types.indexOf("hero");
  const ctaBlock = blocks.find((b) => (b.type ?? "").trim().toLowerCase() === "cta");

  if (!hasHero) {
    add(
      "missing_hero",
      isEn ? "Page has no hero block; first impression may be weak." : "Siden har ingen hero-blokk; første inntrykk kan være svakt.",
      isEn ? "Add a hero block at the top with headline and primary CTA." : "Legg til en hero-blokk øverst med overskrift og primær CTA.",
      "high",
      "structure"
    );
  } else if (heroIndex !== 0) {
    add(
      "hero_not_first",
      isEn ? "Hero is not the first block; consider moving it to the top." : "Hero er ikke første blokk; vurder å flytte den øverst.",
      isEn ? "Move hero to index 0 for clear above-the-fold structure." : "Flytt hero til indeks 0 for tydelig struktur over fold.",
      "medium",
      "structure"
    );
  }

  if (blocks.length > 25) {
    add(
      "too_many_blocks",
      isEn ? "Page has many blocks; consider splitting or simplifying." : "Siden har mange blokker; vurder å splitte eller forenkle.",
      isEn ? "Keep key messages focused; 10–15 blocks often sufficient." : "Hold hovedbudskap fokusert; 10–15 blokker er ofte nok.",
      "low",
      "structure"
    );
  }

  if (!hasCta) {
    add(
      "missing_cta",
      isEn ? "Page has no CTA block; users lack a clear next step." : "Siden har ingen CTA-blokk; brukere mangler et tydelig neste steg.",
      isEn ? "Add a CTA block (e.g. Contact, Request demo) near the end." : "Legg til en CTA-blokk (f.eks. Kontakt, Be om demo) nær slutten.",
      "high",
      "conversion"
    );
  } else if (ctaBlock?.data) {
    const label = str(ctaBlock.data.buttonLabel ?? ctaBlock.data.ctaLabel ?? "");
    if (!label) {
      add(
        "cta_no_label",
        isEn ? "CTA block has no button label; link is not accessible." : "CTA-blokk har ingen knappetekst; lenken er ikke tilgjengelig.",
        isEn ? "Set buttonLabel (or ctaLabel) with a discernible action." : "Sett buttonLabel (eller ctaLabel) med en gjenkjennelig handling.",
        "critical",
        "accessibility",
        ctaBlock.id
      );
    } else if (isGenericCta(label)) {
      add(
        "cta_generic",
        isEn ? "CTA label is generic; action-specific copy converts better." : "CTA-etikett er generisk; handlingsspesifikk tekst konverterer bedre.",
        isEn ? "Use e.g. Request demo, Contact us, Get a quote." : "Bruk f.eks. Be om demo, Kontakt oss, Få tilbud.",
        "medium",
        "conversion",
        ctaBlock.id
      );
    }
  }

  for (const b of blocks) {
    const type = (b.type ?? "").trim().toLowerCase();
    const data = b.data && typeof b.data === "object" ? b.data : {};
    if (type === "hero" || type === "image") {
      const hasImage = type === "image" ? !!str(data.src ?? data.imageUrl ?? data.assetPath) : !!str(data.imageUrl ?? data.src);
      const alt = str(data.alt ?? data.imageAlt ?? "");
      if (hasImage && !alt) {
        add(
          "missing_alt",
          isEn ? "Image has no alt text; required for accessibility." : "Bilde mangler alt-tekst; påkrevd for tilgjengelighet.",
          isEn ? "Add alt (or imageAlt) with a short description." : "Legg til alt (eller imageAlt) med en kort beskrivelse.",
          "critical",
          "accessibility",
          b.id
        );
      }
    }
    if (type === "cta") {
      const href = str(data.buttonHref ?? data.ctaHref ?? data.href ?? "");
      const label = str(data.buttonLabel ?? data.ctaLabel ?? "");
      if (href && !label) {
        add(
          "link_no_text",
          isEn ? "CTA link has no visible text; not accessible." : "CTA-lenke har ingen synlig tekst; ikke tilgjengelig.",
          isEn ? "Set buttonLabel so the link has a discernible name." : "Sett buttonLabel slik at lenken har et gjenkjennelig navn.",
          "critical",
          "accessibility",
          b.id
        );
      }
    }
  }

  if (!title) {
    add(
      "missing_title",
      isEn ? "Page has no title; add one for SEO and context." : "Siden har ingen tittel; legg til for SEO og kontekst.",
      isEn ? "Set a short, descriptive page title (e.g. 50–60 chars)." : "Sett en kort, beskrivende sidetittel (f.eks. 50–60 tegn).",
      "high",
      "seo"
    );
  } else if (title.length > 70) {
    add(
      "title_too_long",
      isEn ? "Page title is long; consider under 60 chars for SEO." : "Sidetittel er lang; vurder under 60 tegn for SEO.",
      isEn ? "Shorten title for display in search results." : "Forkort tittel for visning i søkeresultater.",
      "low",
      "seo"
    );
  }

  if (metaDesc.length > 0 && metaDesc.length < 80) {
    add(
      "meta_description_short",
      isEn ? "Meta description is under 80 characters; aim for 80–160." : "Meta-beskrivelse er under 80 tegn; sikt på 80–160.",
      isEn ? "Expand meta description for better search snippets." : "Utvid meta-beskrivelsen for bedre søkeutdrag.",
      "medium",
      "seo"
    );
  }

  const firstRich = blocks.find((b) => (b.type ?? "").trim().toLowerCase() === "richtext");
  if (blocks.length > 1 && !firstRich && !hasHero) {
    add(
      "no_content_section",
      isEn ? "Page has no rich text section; add body content." : "Siden har ingen teksteksjon; legg til brødtekst.",
      isEn ? "Add at least one richText block with heading and body." : "Legg til minst én richText-blokk med overskrift og brødtekst.",
      "medium",
      "content"
    );
  } else if (firstRich?.data && typeof firstRich.data.body === "string") {
    const bodyLen = firstRich.data.body.trim().length;
    if (bodyLen > 0 && bodyLen < 100) {
      add(
        "intro_very_short",
        isEn ? "First content section is very short; consider 100+ characters." : "Første innholdsseksjon er veldig kort; vurder 100+ tegn.",
        isEn ? "Expand intro or value statement for clarity." : "Utvid intro eller verdiberegning for tydelighet.",
        "low",
        "content",
        firstRich.id
      );
    }
  }

  let deduct = 0;
  for (const i of issues) {
    if (i.severity === "critical") deduct += CRITICAL_DEDUCT;
    else if (i.severity === "high") deduct += HIGH_DEDUCT;
    else if (i.severity === "medium") deduct += MEDIUM_DEDUCT;
    else deduct += LOW_DEDUCT;
  }
  const qualityScore = Math.max(0, Math.min(100, 100 - deduct));

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasHigh = issues.some((i) => i.severity === "high");
  const passed =
    qualityScore >= SCORE_PASS_THRESHOLD &&
    (strictMode ? !hasCritical && !hasHigh : !hasCritical);

  const checks = {
    structure: categoryIssues.structure === 0,
    accessibility: categoryIssues.accessibility === 0,
    conversion: categoryIssues.conversion === 0,
    seo: categoryIssues.seo === 0,
    content: categoryIssues.content === 0,
  };

  const summary = isEn
    ? `QA ${passed ? "passed" : "failed"}: ${qualityScore}/100. ${issues.length} issue(s). ${hasCritical ? "Critical issues must be fixed." : ""}`
    : `QA ${passed ? "bestått" : "ikke bestått"}: ${qualityScore}/100. ${issues.length} problem(er). ${hasCritical ? "Kritiske problemer må rettes." : ""}`;

  return {
    qualityScore,
    passed,
    issues,
    checks,
    summary,
  };
}

export { validatePageQualityCapability, CAPABILITY_NAME };
