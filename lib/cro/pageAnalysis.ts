/**
 * Deterministic page-analysis engine for CRO signals.
 * Single extraction layer: normalizes blocks + meta into structured CRO signals.
 * Used by CRO scoring and suggestion flows. Malformed content never throws.
 * Fail-closed: ambiguous or incomplete input yields safe defaults (empty, false, zero).
 */

export type CroPageAnalysisInput = {
  blocks: unknown;
  meta?: unknown;
  pageTitle?: string | null;
};

/** Primary CTA clarity: none (no CTA), weak (generic/empty label), clear (specific action). */
export type PrimaryCtaClarity = "none" | "weak" | "clear";

/** Headline clarity: missing, weak (too short/empty), clear. */
export type HeadlineClarity = "missing" | "weak" | "clear";

/** Value-props source when present. */
export type ValuePropsSource = "none" | "heading" | "body";

export type CroPageAnalysis = {
  /** Block count used in analysis (capped). */
  blocksAnalyzed: number;
  /** Block types in document order (e.g. ["hero", "richText", "cta"]). */
  blockTypesInOrder: string[];
  /** Index of first hero block, or null. */
  heroIndex: number | null;
  /** Index of first CTA block, or null. */
  firstCtaIndex: number | null;
  /** Number of CTA blocks. */
  ctaCount: number;

  // —— Primary CTA ——
  /** Whether page has at least one CTA block. */
  hasCta: boolean;
  /** First CTA button label. */
  ctaButtonLabel: string;
  /** First CTA title/headline. */
  ctaTitle: string;
  /** First CTA block id, or empty. */
  firstCtaBlockId: string;
  /** Primary CTA clarity. */
  primaryCtaClarity: PrimaryCtaClarity;

  // —— Headline ——
  /** First richText heading (or title). */
  firstHeading: string;
  /** Hero block title (if any). */
  heroTitle: string;
  /** Effective main headline (hero title or first heading). */
  mainHeadline: string;
  /** Headline clarity. */
  headlineClarity: HeadlineClarity;

  // —— Value proposition ——
  /** Whether value props (fordeler/benefits/etc.) are present. */
  hasValueProps: boolean;
  /** Where value props were detected. */
  valuePropsSource: ValuePropsSource;
  /** Word count of first substantive richText body (intro). */
  introWordCount: number;
  /** Full body text concatenated (for trust/offer detection). */
  bodyContent: string;

  // —— Trust signals ——
  /** Trust-related phrases found in body (sikkerhet, compliance, ESG, etc.). */
  trustSignalMentions: string[];
  /** Trust signals from meta.cro.trustSignals (declared). */
  metaTrustSignals: string[];

  // —— Friction ——
  /** Number of richText bodies that are very long (friction risk). */
  longParagraphCount: number;
  /** Intro (first richText) under recommended length. */
  introTooShort: boolean;
  /** Recommended minimum intro word count for "not too short". */
  introMinWords: number;

  // —— Offer clarity ——
  /** Body or CTA contains explicit offer (demo, tilbud, kontakt, request). */
  hasExplicitOffer: boolean;
  /** CTA button label looks like explicit offer (not generic). */
  offerInCtaLabel: boolean;
};

const MAX_BLOCKS = 100;
const INTRO_MIN_WORDS = 30;
const LONG_PARAGRAPH_WORDS = 200;

const GENERIC_CTA_LABELS = [
  "submit",
  "send",
  "klikk",
  "les mer",
  "read more",
  "klikk her",
  "click here",
];

const VALUE_PROPS_HEADINGS = ["fordeler", "benefits", "hvorfor", "why", "derfor", "verdi", "value"];
const VALUE_PROPS_BODY_PHRASES = ["fordeler", "benefits", "verdi for", "value for"];

const TRUST_PHRASES = [
  "sikkerhet",
  "security",
  "compliance",
  "esg",
  "bærekraft",
  "sustainability",
  "kontroll",
  "control",
  "sporbarhet",
  "traceability",
  "personvern",
  "privacy",
  "gdpr",
];

const OFFER_PHRASES = [
  "demo",
  "tilbud",
  "kontakt",
  "contact",
  "request",
  "forespør",
  "bestill",
  "order",
  "registrer",
  "sign up",
  "signup",
];

function safeStr(v: unknown): string {
  if (v == null) return "";
  return (typeof v === "string" ? v : String(v)).trim();
}

function safeArrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_BLOCKS)
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type).trim(),
      data:
        b.data != null && typeof b.data === "object" && !Array.isArray(b.data)
          ? (b.data as Record<string, unknown>)
          : undefined,
    }));
}

function wordCount(text: string): number {
  if (typeof text !== "string" || !text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Detect phrases in text (case-insensitive); return list of matched phrases. */
function detectPhrases(text: string, phrases: string[]): string[] {
  if (typeof text !== "string" || !text) return [];
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p.toLowerCase()));
}

function derivePrimaryCtaClarity(hasCta: boolean, buttonLabel: string, ctaTitle: string): PrimaryCtaClarity {
  if (!hasCta) return "none";
  const label = buttonLabel.toLowerCase().trim();
  const title = ctaTitle.trim();
  if (!label || GENERIC_CTA_LABELS.some((g) => label === g)) return "weak";
  if (title.length < 3) return "weak";
  return "clear";
}

function deriveHeadlineClarity(mainHeadline: string): HeadlineClarity {
  const h = mainHeadline.trim();
  if (!h) return "missing";
  if (h.length < 10) return "weak";
  return "clear";
}

/**
 * Extract structured CRO signals from page blocks and meta.
 * Safe: malformed or missing input yields empty strings, zero counts, false flags, safe enums.
 */
export function analyzePageForCro(input: CroPageAnalysisInput): CroPageAnalysis {
  const blocks = normalizeBlocks(input.blocks);
  const meta =
    input.meta != null && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? (input.meta as Record<string, unknown>)
      : {};
  const croMeta =
    meta.cro != null && typeof meta.cro === "object" && !Array.isArray(meta.cro)
      ? (meta.cro as Record<string, unknown>)
      : {};

  const blockTypesInOrder = blocks.map((b) => b.type);
  const heroIndex = blocks.findIndex((b) => b.type === "hero");
  const ctaIndices = blocks.map((b, i) => (b.type === "cta" ? i : -1)).filter((i) => i >= 0);
  const firstCtaIndex = ctaIndices.length > 0 ? ctaIndices[0] : null;
  const ctaCount = ctaIndices.length;

  let hasCta = false;
  let ctaButtonLabel = "";
  let ctaTitle = "";
  let firstCtaBlockId = "";
  const firstCtaBlock = firstCtaIndex != null ? blocks[firstCtaIndex] : null;
  if (firstCtaBlock && firstCtaBlock.type === "cta") {
    hasCta = true;
    firstCtaBlockId = firstCtaBlock.id;
    const data = firstCtaBlock.data ?? {};
    ctaButtonLabel = safeStr(data.buttonLabel);
    ctaTitle = safeStr(data.title ?? data.heading);
  }

  const primaryCtaClarity = derivePrimaryCtaClarity(hasCta, ctaButtonLabel, ctaTitle);

  let firstHeading = "";
  let heroTitle = "";
  const bodyParts: string[] = [];
  let introWordCount = 0;
  let longParagraphCount = 0;
  let hasValueProps = false;
  let valuePropsSource: ValuePropsSource = "none";

  const firstRichIndex = blocks.findIndex((b) => b.type === "richText");

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const data = b.data ?? {};
    const blockType = b.type || "";

    if (blockType === "hero") {
      heroTitle = safeStr(data.title ?? data.heading);
    }

    if (blockType === "richText") {
      const heading = safeStr(data.heading ?? data.title);
      if (heading && !firstHeading) firstHeading = heading;
      const body = typeof data.body === "string" ? data.body : "";
      if (body) {
        bodyParts.push(body);
        const wc = wordCount(body);
        if (firstRichIndex >= 0 && i === firstRichIndex) {
          introWordCount = wc;
        }
        if (wc >= LONG_PARAGRAPH_WORDS) longParagraphCount += 1;
      }
      const headingLower = heading.toLowerCase();
      const bodyLower = body.toLowerCase();
      if (VALUE_PROPS_HEADINGS.some((k) => headingLower.includes(k))) {
        hasValueProps = true;
        if (valuePropsSource === "none") valuePropsSource = "heading";
      }
      if (VALUE_PROPS_BODY_PHRASES.some((p) => bodyLower.includes(p))) {
        hasValueProps = true;
        if (valuePropsSource === "none") valuePropsSource = "body";
      }
    }
  }

  const bodyContent = bodyParts.join(" ");
  const mainHeadline = heroTitle || firstHeading;
  const headlineClarity = deriveHeadlineClarity(mainHeadline);

  const trustSignalMentions = detectPhrases(bodyContent, TRUST_PHRASES);
  const metaTrustSignals = safeArrStr(croMeta.trustSignals);

  const introTooShort = introWordCount > 0 && introWordCount < INTRO_MIN_WORDS;

  const bodyAndCtaLower = (bodyContent + " " + ctaTitle + " " + ctaButtonLabel).toLowerCase();
  const hasExplicitOffer = OFFER_PHRASES.some((p) => bodyAndCtaLower.includes(p));
  const offerInCtaLabel =
    hasCta && OFFER_PHRASES.some((p) => (ctaButtonLabel + " " + ctaTitle).toLowerCase().includes(p));

  return {
    blocksAnalyzed: blocks.length,
    blockTypesInOrder,
    heroIndex: heroIndex >= 0 ? heroIndex : null,
    firstCtaIndex,
    ctaCount,

    hasCta,
    ctaButtonLabel,
    ctaTitle,
    firstCtaBlockId,
    primaryCtaClarity,

    firstHeading,
    heroTitle,
    mainHeadline,
    headlineClarity,

    hasValueProps,
    valuePropsSource,
    introWordCount,
    bodyContent,

    trustSignalMentions,
    metaTrustSignals,

    longParagraphCount,
    introTooShort,
    introMinWords: INTRO_MIN_WORDS,

    hasExplicitOffer,
    offerInCtaLabel,
  };
}
