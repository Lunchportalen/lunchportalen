/**
 * Structured CRO suggestion engine.
 * Builds actionable suggestions from CRO page analysis. No auto-apply; suggestions require explicit user action in CMS/editor.
 * Each suggestion: type, target (page/block), recommended change, rationale, priority. Malformed input or AI output fails safely.
 */

import type { CroPageAnalysis } from "@/lib/cro/pageAnalysis";

/** CRO suggestion type — each maps to a specific page/block signal. */
export type CroSuggestionType =
  | "missing_cta"
  | "weak_cta"
  | "missing_headline"
  | "weak_headline"
  | "missing_value_props"
  | "short_intro"
  | "no_trust_signals"
  | "friction_long_paragraphs"
  | "unclear_offer"
  | "structure_cta_late"
  | "multiple_ctas";

/**
 * Recommendation category for grouping and filtering.
 * - cta: CTA presence, clarity, count
 * - messaging: headline, value proposition, intro copy
 * - structure: section order, CTA position
 * - trust: trust signals in content/meta
 * - friction: long paragraphs, short intro (readability/scannability)
 * - offer: explicit offer clarity in CTA or body
 */
export type CroSuggestionCategory = "cta" | "messaging" | "structure" | "trust" | "friction" | "offer";

/** Target of the suggestion: page-level or a specific block. */
export type CroSuggestionTarget = "page" | "block";

/** Priority for ordering and UI emphasis. */
export type CroSuggestionPriority = "high" | "medium" | "low";

/** Severity for consistency with health/issue UIs (derived from priority when not set). */
export type CroSuggestionSeverity = "error" | "warn" | "info";

/**
 * One structured CRO suggestion. No auto-apply; editor/CMS must present and let user apply or dismiss.
 * targetBlockId and targetBlockIndex are set when target === "block" (e.g. CTA block).
 */
export type CroSuggestion = {
  type: CroSuggestionType;
  /** Category for grouping: cta, messaging, structure, trust, friction, offer. */
  category: CroSuggestionCategory;
  target: CroSuggestionTarget;
  /** Block id when target === "block"; empty when target === "page". */
  targetBlockId: string;
  /** Block index in document order when target === "block"; undefined for page-level. */
  targetBlockIndex?: number;
  /** Short label for UI (e.g. "Hoved-CTA"). */
  label: string;
  /** Current state summary (before) — ties to actual page/block content. */
  before: string;
  /** Recommended change — actionable, specific; no vague growth-hack text. */
  recommendedChange: string;
  /** Rationale — why this helps conversion; tied to page context. */
  rationale: string;
  priority: CroSuggestionPriority;
  severity: CroSuggestionSeverity;
};

export type BuildCroSuggestionsOptions = {
  locale?: "nb" | "en";
};

export type BuildCroSuggestionsResult = {
  suggestions: CroSuggestion[];
};

const MAX_SUGGESTIONS = 20;
const CTA_LATE_INDEX_THRESHOLD = 5;
const LONG_PARAGRAPH_WORDS = 200;

/** Map suggestion type to category for grouping (CTA / messaging / structure / trust / friction / offer). */
export function getCroSuggestionCategory(type: CroSuggestionType): CroSuggestionCategory {
  switch (type) {
    case "missing_cta":
    case "weak_cta":
    case "multiple_ctas":
      return "cta";
    case "missing_headline":
    case "weak_headline":
    case "missing_value_props":
    case "short_intro":
      return type === "short_intro" ? "friction" : "messaging";
    case "no_trust_signals":
      return "trust";
    case "friction_long_paragraphs":
      return "friction";
    case "unclear_offer":
      return "offer";
    case "structure_cta_late":
      return "structure";
    default:
      return "messaging";
  }
}

function priorityToSeverity(p: CroSuggestionPriority): CroSuggestionSeverity {
  switch (p) {
    case "high":
      return "error";
    case "medium":
      return "warn";
    case "low":
      return "info";
  }
}

function add(
  out: CroSuggestion[],
  type: CroSuggestionType,
  target: CroSuggestionTarget,
  targetBlockId: string,
  label: string,
  before: string,
  recommendedChange: string,
  rationale: string,
  priority: CroSuggestionPriority,
  targetBlockIndex?: number
): void {
  if (out.length >= MAX_SUGGESTIONS) return;
  out.push({
    type,
    category: getCroSuggestionCategory(type),
    target,
    targetBlockId,
    ...(targetBlockIndex != null && { targetBlockIndex }),
    label,
    before,
    recommendedChange,
    rationale,
    priority,
    severity: priorityToSeverity(priority),
  });
}

/**
 * Build structured CRO suggestions from page analysis. Deterministic; no AI.
 * Suggestions are tied to analysis signals (CTA, headline, value props, trust, friction, offer, structure).
 * Does not mutate content; no auto-apply.
 */
export function buildCroSuggestions(
  analysis: CroPageAnalysis,
  opts: BuildCroSuggestionsOptions = {}
): BuildCroSuggestionsResult {
  const locale = opts.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const suggestions: CroSuggestion[] = [];

  // —— Missing CTA (CTA category) ——
  if (analysis.primaryCtaClarity === "none" && analysis.blocksAnalyzed > 0) {
    add(
      suggestions,
      "missing_cta",
      "page",
      "",
      isEn ? "Primary CTA" : "Hoved-CTA",
      isEn ? "No CTA block" : "Ingen CTA-blokk",
      isEn
        ? "Add a CTA block: set button label (e.g. «Request a demo», «Contact us») and a short CTA title above the button."
        : "Legg til en CTA-blokk: sett knappetekst (f.eks. «Be om demo», «Kontakt oss») og en kort CTA-overskrift over knappen.",
      isEn ? "A clear call-to-action guides visitors to the next step and supports conversion." : "En tydelig oppfordring til handling leder besøkende til neste steg og støtter konvertering.",
      "high"
    );
  }

  // —— Weak CTA — tied to real CTA block (CTA title + button label) ——
  if (analysis.primaryCtaClarity === "weak" && analysis.hasCta) {
    const beforeTitle = analysis.ctaTitle.trim() || (isEn ? "(CTA title empty)" : "(CTA-overskrift tom)");
    const beforeLabel = analysis.ctaButtonLabel.trim() || (isEn ? "(button label empty)" : "(knappetekst tom)");
    const before = isEn ? `CTA title: ${beforeTitle}. Button: ${beforeLabel}` : `CTA-overskrift: ${beforeTitle}. Knapp: ${beforeLabel}`;
    add(
      suggestions,
      "weak_cta",
      "block",
      analysis.firstCtaBlockId,
      isEn ? "CTA clarity" : "CTA-tydelighet",
      before,
      isEn
        ? "In the CTA block: set a specific button label (e.g. «Request a demo», «Contact us») and a CTA title of at least a few words above the button."
        : "I CTA-blokken: sett en konkret knappetekst (f.eks. «Be om demo», «Kontakt oss») og en CTA-overskrift på minst noen ord over knappen.",
      isEn ? "Generic buttons like «Click here» reduce trust. Specific labels clarify the action." : "Generiske knapper som «Klikk her» svekker tillit. Konkrete etiketter tydeliggjør handlingen.",
      "high",
      analysis.firstCtaIndex ?? undefined
    );
  }

  // —— Missing headline ——
  if (analysis.headlineClarity === "missing" && analysis.blocksAnalyzed > 0) {
    add(
      suggestions,
      "missing_headline",
      "page",
      "",
      isEn ? "Main headline" : "Hovedoverskrift",
      isEn ? "No clear headline" : "Ingen tydelig overskrift",
      isEn ? "Add a short headline in the hero or first text block (e.g. value proposition or page purpose)." : "Legg til en kort overskrift i hero eller første tekstblokk (f.eks. verdi eller sidens formål).",
      isEn ? "A clear headline sets expectations and improves scannability." : "En tydelig overskrift setter forventninger og forbedrer skanbarhet.",
      "high"
    );
  }

  // —— Weak headline (too short) ——
  if (analysis.headlineClarity === "weak" && analysis.mainHeadline) {
    add(
      suggestions,
      "weak_headline",
      "page",
      "",
      isEn ? "Headline length" : "Overskriftens lengde",
      analysis.mainHeadline.slice(0, 80),
      isEn ? "Use a headline of at least 10 characters that states the page purpose or key benefit." : "Bruk en overskrift på minst 10 tegn som sier sidens formål eller hovedfordel.",
      isEn ? "Very short headlines give little context; a bit more text improves clarity." : "Veldig korte overskrifter gir lite kontekst; litt mer tekst forbedrer tydeligheten.",
      "medium"
    );
  }

  // —— Missing value props (messaging) — tied to actual page: add section after hero/intro ——
  if (!analysis.hasValueProps && analysis.blocksAnalyzed >= 1) {
    add(
      suggestions,
      "missing_value_props",
      "page",
      "",
      isEn ? "Value proposition" : "Verdiargumenter",
      isEn ? "No value-props section in content" : "Ingen seksjon med verdiargumenter i innholdet",
      isEn
        ? "Add a text block with a heading like «Why us» or «Benefits» and 2–3 short bullets (e.g. control, predictability, less admin)."
        : "Legg til en tekstblokk med overskrift som «Hvorfor oss» eller «Fordeler» og 2–3 korte punkter (f.eks. kontroll, forutsigbarhet, mindre administrasjon).",
      isEn ? "Value props reduce doubt and support qualified leads." : "Verdiargumenter reduserer tvil og støtter kvalifiserte henvendelser.",
      "medium"
    );
  }

  // —— Short intro ——
  if (analysis.introTooShort && analysis.introWordCount > 0) {
    add(
      suggestions,
      "short_intro",
      "page",
      "",
      isEn ? "Intro length" : "Introduksjonslengde",
      isEn ? `${analysis.introWordCount} words` : `${analysis.introWordCount} ord`,
      isEn ? `Aim for at least ${analysis.introMinWords} words in the first text block to set context.` : `Sikt på minst ${analysis.introMinWords} ord i første tekstblokk for å sette kontekst.`,
      isEn ? "A short intro may not give enough context; a bit more improves clarity and trust." : "En kort intro gir kanskje ikke nok kontekst; litt mer forbedrer tydelighet og tillit.",
      "low"
    );
  }

  // —— No trust signals (only when page has body content) ——
  if (
    analysis.trustSignalMentions.length === 0 &&
    analysis.metaTrustSignals.length === 0 &&
    analysis.bodyContent.trim().length > 100
  ) {
    add(
      suggestions,
      "no_trust_signals",
      "page",
      "",
      isEn ? "Trust signals" : "Tillitssignaler",
      isEn ? "None detected in content or meta" : "Ingen funnet i innhold eller meta",
      isEn ? "Mention security, compliance, or control (e.g. sikkerhet, compliance, ESG) in body or set meta.cro.trustSignals." : "Nevn sikkerhet, compliance eller kontroll (f.eks. sikkerhet, compliance, ESG) i teksten eller sett meta.cro.trustSignals.",
      isEn ? "Trust signals reduce friction for enterprise visitors." : "Tillitssignaler reduserer friksjon for bedriftsbesøkende.",
      "medium"
    );
  }

  // —— Friction: long paragraphs — specific and actionable ——
  if (analysis.longParagraphCount > 0) {
    add(
      suggestions,
      "friction_long_paragraphs",
      "page",
      "",
      isEn ? "Long paragraphs" : "Lange avsnitt",
      isEn
        ? `${analysis.longParagraphCount} text block(s) exceed ${LONG_PARAGRAPH_WORDS} words`
        : `${analysis.longParagraphCount} tekstblokk(er) overstiger ${LONG_PARAGRAPH_WORDS} ord`,
      isEn
        ? `Split the ${analysis.longParagraphCount} block(s) that exceed ${LONG_PARAGRAPH_WORDS} words: add subheadings or split into separate text blocks so each section is under ~${LONG_PARAGRAPH_WORDS} words.`
        : `Del de ${analysis.longParagraphCount} blokk(ene) som overstiger ${LONG_PARAGRAPH_WORDS} ord: legg til underoverskrifter eller del i egne tekstblokker slik at hver seksjon er under ca. ${LONG_PARAGRAPH_WORDS} ord.`,
      isEn ? "Long paragraphs increase friction; shorter sections improve scannability and hierarchy." : "Lange avsnitt øker friksjon; kortere seksjoner forbedrer skanbarhet og hierarki.",
      "low"
    );
  }

  // —— Unclear offer (offer category) — tied to actual content: body or CTA block ——
  if (!analysis.hasExplicitOffer && analysis.blocksAnalyzed >= 1) {
    add(
      suggestions,
      "unclear_offer",
      "page",
      "",
      isEn ? "Offer clarity" : "Tilbudstydelighet",
      isEn ? "No explicit offer in body copy or CTA" : "Ingen tydelig tilbud i brødtekst eller CTA",
      isEn
        ? "In body copy or the CTA block, state the next step explicitly (e.g. «Request a demo», «Contact us», «Get a quote»)."
        : "I brødtekst eller CTA-blokken: beskriv neste steg tydelig (f.eks. «Be om demo», «Kontakt oss», «Få tilbud»).",
      isEn ? "An explicit offer reduces doubt and increases qualified actions." : "Et tydelig tilbud reduserer tvil og øker kvalifiserte handlinger.",
      "medium"
    );
  } else if (analysis.hasCta && !analysis.offerInCtaLabel) {
    add(
      suggestions,
      "unclear_offer",
      "block",
      analysis.firstCtaBlockId,
      isEn ? "CTA offer clarity" : "CTA-tilbudstydelighet",
      analysis.ctaButtonLabel.trim() || (isEn ? "(CTA button label empty)" : "(CTA-knappetekst tom)"),
      isEn
        ? "In this CTA block, set the button label to state the action (e.g. «Request a demo», «Contact us»)."
        : "I denne CTA-blokken: sett knappeteksten til å beskrive handlingen (f.eks. «Be om demo», «Kontakt oss»).",
      isEn ? "The button label should clarify what happens when the user clicks." : "Knappeteksten bør tydeliggjøre hva som skjer når brukeren klikker.",
      "medium",
      analysis.firstCtaIndex ?? undefined
    );
  }

  // —— CTA very late in structure ——
  if (
    analysis.firstCtaIndex != null &&
    analysis.firstCtaIndex >= CTA_LATE_INDEX_THRESHOLD &&
    analysis.blocksAnalyzed > CTA_LATE_INDEX_THRESHOLD
  ) {
    add(
      suggestions,
      "structure_cta_late",
      "page",
      "",
      isEn ? "CTA position" : "CTA-plassering",
      isEn ? `First CTA at block index ${analysis.firstCtaIndex}` : `Første CTA ved blokk-indeks ${analysis.firstCtaIndex}`,
      isEn ? "Consider moving the primary CTA higher so visitors see it without scrolling too far." : "Vurder å flytte hoved-CTA høyere slik at besøkende ser den uten å scrolle langt.",
      isEn ? "Early visibility of the main action supports conversion." : "Tidlig synlighet for hovedhandlingen støtter konvertering.",
      "low"
    );
  }

  // —— Multiple CTAs ——
  if (analysis.ctaCount > 2) {
    add(
      suggestions,
      "multiple_ctas",
      "page",
      "",
      isEn ? "Number of CTAs" : "Antall CTA-er",
      `${analysis.ctaCount}`,
      isEn ? "Consider reducing to 1–2 CTAs so the primary action is clear." : "Vurder å redusere til 1–2 CTA-er slik at hovedhandlingen er tydelig.",
      isEn ? "Too many CTAs can dilute focus; one primary CTA is usually better." : "For mange CTA-er kan fortynne fokus; én hoved-CTA er vanligvis bedre.",
      "low"
    );
  }

  return { suggestions };
}

const CRO_SUGGESTION_TYPES: CroSuggestionType[] = [
  "missing_cta",
  "weak_cta",
  "missing_headline",
  "weak_headline",
  "missing_value_props",
  "short_intro",
  "no_trust_signals",
  "friction_long_paragraphs",
  "unclear_offer",
  "structure_cta_late",
  "multiple_ctas",
];

/**
 * Normalize raw suggestion-like object to a safe CroSuggestion. Returns null if too invalid to use.
 * Use when parsing AI or external output; prevents invalid data from crashing consumers.
 * Vague output fails safely: empty recommendedChange or invalid type yields null.
 */
export function normalizeCroSuggestion(raw: unknown): CroSuggestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type.trim() : "";
  if (!CRO_SUGGESTION_TYPES.includes(type as CroSuggestionType)) return null;

  const target = o.target === "block" ? "block" : "page";
  const targetBlockId = target === "block" && typeof o.targetBlockId === "string" ? o.targetBlockId.trim() : "";
  const label = typeof o.label === "string" ? o.label.trim() : type;
  const before = typeof o.before === "string" ? o.before.trim() : "";
  const recommendedChange = typeof o.recommendedChange === "string" ? o.recommendedChange.trim() : "";
  const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";

  if (!recommendedChange) return null;

  const priority = o.priority === "high" || o.priority === "low" ? o.priority : "medium";
  const severity =
    o.severity === "error" || o.severity === "warn" || o.severity === "info"
      ? o.severity
      : priorityToSeverity(priority);
  const category = typeof o.category === "string" && isCroSuggestionCategory(o.category)
    ? o.category
    : getCroSuggestionCategory(type as CroSuggestionType);
  const targetBlockIndex =
    typeof o.targetBlockIndex === "number" && Number.isFinite(o.targetBlockIndex) && o.targetBlockIndex >= 0
      ? o.targetBlockIndex
      : undefined;

  return {
    type: type as CroSuggestionType,
    category,
    target,
    targetBlockId,
    ...(targetBlockIndex != null && { targetBlockIndex }),
    label: label || type,
    before,
    recommendedChange,
    rationale,
    priority,
    severity,
  };
}

function isCroSuggestionCategory(s: string): s is CroSuggestionCategory {
  return ["cta", "messaging", "structure", "trust", "friction", "offer"].includes(s);
}

/**
 * Parse array of raw suggestions; return only valid CroSuggestion items. Malformed entries are skipped.
 */
export function normalizeCroSuggestions(raw: unknown): CroSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CroSuggestion[] = [];
  for (const item of raw) {
    const s = normalizeCroSuggestion(item);
    if (s) out.push(s);
  }
  return out;
}
