/**
 * AI Page Composer: structured intent or prompt -> draft page structure (title, blocks).
 * Human-in-the-loop: output is draft only; editor reviews and accepts before publish.
 * Degrades to deterministic templates when AI/LLM unavailable.
 * Used by POST /api/backoffice/ai/page-builder.
 *
 * Output must be normalized (e.g. normalizePageBuilderBlocks) before apply; block types
 * are from ALLOWED_SECTION_TYPES and must match CMS content model.
 */

export type PageBuilderBlockIntent = { type: string; data?: Record<string, unknown> };

export type PageBuilderResult = {
  title?: string;
  summary?: string;
  blocks: PageBuilderBlockIntent[];
  notes?: string[];
  warnings?: string[];
};

/** Structured input for AI Page Composer (full draft generation). */
export type PageComposerInput = {
  /** Page goal: lead, info, signup, etc. */
  goal?: string;
  /** Target audience (e.g. "HR, beslutningstakere"). */
  audience?: string;
  /** Tone: enterprise, warm, neutral. */
  tone?: "enterprise" | "warm" | "neutral";
  /** Page type drives default section set. */
  pageType?: "landing" | "contact" | "info" | "pricing" | "generic";
  /** CTA intent: demo, contact, quote, start. */
  ctaIntent?: "demo" | "contact" | "quote" | "start";
  /** Section types to include (e.g. ["hero","richText","cta"]). If set, only these. */
  sectionsInclude?: string[];
  /** Section types to exclude (e.g. ["image"]). */
  sectionsExclude?: string[];
  locale?: string;
  /** Optional free-text prompt; used for title/fallback when structured fields missing. */
  prompt?: string;
};

const ALLOWED_SECTION_TYPES = ["hero", "richText", "cta", "image", "divider", "banners"] as const;

function safeSectionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ALLOWED_SECTION_TYPES.includes(s as (typeof ALLOWED_SECTION_TYPES)[number]));
}

type PageIntent = "landing" | "contact" | "info" | "pricing" | "generic";

function detectIntent(prompt: string): PageIntent {
  const lower = prompt.toLowerCase().trim();
  if (/\b(kontakt|contact|bestill|henvendelse|send\s+melding)\b/.test(lower)) return "contact";
  if (/\b(pris|prising|priser|pakker|pakke|abonnement)\b/.test(lower)) return "pricing";
  if (/\b(hvordan|how|info|om\s+oss|about|slik\s+fungerer)\b/.test(lower)) return "info";
  if (/\b(demo|forespør|forespørsel|landing|kampanje)\b/.test(lower)) return "landing";
  return "generic";
}

function titleFromPrompt(prompt: string, locale: string, intent: PageIntent): string {
  const words = prompt.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const base = words.length > 0 ? words.join(" ") : locale === "en" ? "New page" : "Ny side";
  if (base.length > 80) return base.slice(0, 77) + "...";
  return base;
}

function blocksForLanding(locale: string): PageBuilderBlockIntent[] {
  const isEn = locale === "en";
  return [
    { type: "hero", data: { title: isEn ? "Welcome" : "Velkommen", subtitle: isEn ? "Edit content here." : "Rediger innhold her.", ctaLabel: isEn ? "Contact us" : "Kontakt oss", ctaHref: "/kontakt" } },
    { type: "richText", data: { heading: isEn ? "Value 1" : "Verdi 1", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "richText", data: { heading: isEn ? "Value 2" : "Verdi 2", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "richText", data: { heading: isEn ? "Value 3" : "Verdi 3", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "cta", data: { title: isEn ? "Ready?" : "Klar?", body: isEn ? "Get in touch." : "Ta kontakt.", buttonLabel: isEn ? "Contact" : "Bestill", buttonHref: "/kontakt" } },
  ];
}

function blocksForContact(locale: string): PageBuilderBlockIntent[] {
  const isEn = locale === "en";
  return [
    { type: "hero", data: { title: isEn ? "Contact us" : "Kontakt oss", subtitle: isEn ? "We'll get back to you." : "Vi kommer tilbake til deg.", ctaLabel: isEn ? "Send message" : "Send melding", ctaHref: "#kontakt" } },
    { type: "richText", data: { heading: isEn ? "How to reach us" : "Slik når du oss", body: isEn ? "Email, phone or form below." : "E-post, telefon eller skjema nedenfor." } },
    { type: "cta", data: { title: isEn ? "Get in touch" : "Ta kontakt", body: isEn ? "Describe your need." : "Beskriv behovet ditt.", buttonLabel: isEn ? "Send" : "Send", buttonHref: "/kontakt" } },
  ];
}

function blocksForInfo(locale: string): PageBuilderBlockIntent[] {
  const isEn = locale === "en";
  return [
    { type: "hero", data: { title: isEn ? "How it works" : "Slik fungerer det", subtitle: isEn ? "Short overview." : "Kort oversikt.", ctaLabel: isEn ? "Learn more" : "Les mer", ctaHref: "#" } },
    { type: "richText", data: { heading: isEn ? "Step 1" : "Steg 1", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "richText", data: { heading: isEn ? "Step 2" : "Steg 2", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "richText", data: { heading: isEn ? "Step 3" : "Steg 3", body: isEn ? "Description." : "Beskrivelse." } },
    { type: "cta", data: { title: isEn ? "Ready to start?" : "Klar for å starte?", body: isEn ? "Contact us." : "Ta kontakt.", buttonLabel: isEn ? "Contact" : "Kontakt", buttonHref: "/kontakt" } },
  ];
}

function blocksForPricing(locale: string): PageBuilderBlockIntent[] {
  const isEn = locale === "en";
  return [
    { type: "hero", data: { title: isEn ? "Plans and pricing" : "Pakker og priser", subtitle: isEn ? "Choose what fits." : "Velg det som passer.", ctaLabel: isEn ? "See plans" : "Se pakker", ctaHref: "#pakker" } },
    { type: "richText", data: { heading: isEn ? "Options" : "Alternativer", body: isEn ? "- Option A\n- Option B\n- Option C" : "- Alternativ A\n- Alternativ B\n- Alternativ C" } },
    { type: "cta", data: { title: isEn ? "Get a quote" : "Få tilbud", body: isEn ? "We'll tailor an offer." : "Vi tilpasser et tilbud.", buttonLabel: isEn ? "Request quote" : "Be om tilbud", buttonHref: "/kontakt" } },
  ];
}

function blocksForGeneric(locale: string): PageBuilderBlockIntent[] {
  return blocksForLanding(locale);
}

/** CTA copy by intent and locale. */
function ctaCopyForIntent(
  ctaIntent: PageComposerInput["ctaIntent"],
  locale: string
): { title: string; body: string; buttonLabel: string; buttonHref: string } {
  const isEn = locale === "en";
  switch (ctaIntent) {
    case "demo":
      return isEn
        ? { title: "Ready to try?", body: "Get a short walkthrough.", buttonLabel: "Request demo", buttonHref: "/kontakt" }
        : { title: "Klar for å teste?", body: "Få en kort gjennomgang.", buttonLabel: "Be om demo", buttonHref: "/kontakt" };
    case "quote":
      return isEn
        ? { title: "Get a quote", body: "We'll tailor an offer.", buttonLabel: "Request quote", buttonHref: "/kontakt" }
        : { title: "Få tilbud", body: "Vi tilpasser et tilbud.", buttonLabel: "Be om tilbud", buttonHref: "/kontakt" };
    case "start":
      return isEn
        ? { title: "Get started", body: "Set up in minutes.", buttonLabel: "Start now", buttonHref: "/kontakt" }
        : { title: "Kom i gang", body: "Oppsett på få minutter.", buttonLabel: "Start nå", buttonHref: "/kontakt" };
    case "contact":
    default:
      return isEn
        ? { title: "Get in touch", body: "We'll get back to you.", buttonLabel: "Contact us", buttonHref: "/kontakt" }
        : { title: "Ta kontakt", body: "Vi svarer deg.", buttonLabel: "Kontakt oss", buttonHref: "/kontakt" };
  }
}

/** Build hero + CTA copy from goal, audience, tone, ctaIntent. */
function fillCopy(
  input: PageComposerInput,
  locale: string
): { heroTitle: string; heroSubtitle: string; heroCtaLabel: string; cta: ReturnType<typeof ctaCopyForIntent> } {
  const isEn = locale === "en";
  const goal = (input.goal ?? "").trim() || (isEn ? "Get leads" : "Få forespørsler");
  const audience = (input.audience ?? "").trim() || (isEn ? "Decision makers" : "Beslutningstakere");
  const tone = input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise";
  const cta = ctaCopyForIntent(input.ctaIntent, locale);
  const heroTitle =
    tone === "warm"
      ? isEn
        ? `${audience} – simpler lunch, less waste`
        : `${audience} – enklere lunsj, mindre svinn`
      : isEn
        ? `${audience} – ${goal}`
        : `${audience} – ${goal}`;
  const heroSubtitle =
    isEn
      ? "Full control, predictable delivery, no canteen operations."
      : "Full kontroll, forutsigbar levering, null kantinedrift.";
  const heroCtaLabel = cta.buttonLabel;
  return { heroTitle, heroSubtitle, heroCtaLabel, cta };
}

/** Filter blocks by sectionsInclude / sectionsExclude. */
function filterBlocksBySections(
  blocks: PageBuilderBlockIntent[],
  include?: string[],
  exclude?: string[]
): PageBuilderBlockIntent[] {
  let list = blocks.map((b) => ({ ...b, data: { ...b.data } }));
  const excl = new Set((exclude ?? []).map((t) => t.toLowerCase()));
  if (excl.size > 0) list = list.filter((b) => !excl.has(b.type.toLowerCase()));
  const incl = include?.map((t) => t.toLowerCase()).filter(Boolean);
  if (incl && incl.length > 0) list = list.filter((b) => incl.includes(b.type.toLowerCase()));
  return list;
}

/**
 * Generate a full draft page structure from structured intent.
 * Maps into existing block contracts (hero, richText, cta, image, divider, banners).
 * Deterministic; no LLM. Use when AI is unavailable or as fallback.
 */
export function generatePageFromStructuredInput(input: PageComposerInput): PageBuilderResult {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const pageType = input.pageType ?? "landing";
  const copy = fillCopy(input, locale);

  let blocks: PageBuilderBlockIntent[] = [];
  const mk = (type: string, data: Record<string, unknown>): PageBuilderBlockIntent => ({ type, data });
  switch (pageType) {
    case "contact":
      blocks = [
        mk("hero", { title: copy.heroTitle, subtitle: copy.heroSubtitle, ctaLabel: copy.heroCtaLabel, ctaHref: copy.cta.buttonHref }),
        mk("richText", { heading: isEn ? "How to reach us" : "Slik når du oss", body: isEn ? "Email, phone or form below." : "E-post, telefon eller skjema nedenfor." }),
        mk("cta", copy.cta),
      ];
      break;
    case "info":
      blocks = [
        mk("hero", { title: copy.heroTitle, subtitle: copy.heroSubtitle, ctaLabel: copy.heroCtaLabel, ctaHref: copy.cta.buttonHref }),
        mk("richText", { heading: isEn ? "Step 1" : "Steg 1", body: isEn ? "Description." : "Beskrivelse." }),
        mk("richText", { heading: isEn ? "Step 2" : "Steg 2", body: isEn ? "Description." : "Beskrivelse." }),
        mk("richText", { heading: isEn ? "Step 3" : "Steg 3", body: isEn ? "Description." : "Beskrivelse." }),
        mk("cta", copy.cta),
      ];
      break;
    case "pricing":
      blocks = [
        mk("hero", { title: copy.heroTitle, subtitle: copy.heroSubtitle, ctaLabel: copy.heroCtaLabel, ctaHref: copy.cta.buttonHref }),
        mk("richText", { heading: isEn ? "Options" : "Alternativer", body: isEn ? "- Option A\n- Option B" : "- Alternativ A\n- Alternativ B" }),
        mk("cta", copy.cta),
      ];
      break;
    case "landing":
    case "generic":
    default:
      blocks = [
        mk("hero", { title: copy.heroTitle, subtitle: copy.heroSubtitle, ctaLabel: copy.heroCtaLabel, ctaHref: copy.cta.buttonHref }),
        mk("richText", { heading: isEn ? "Value 1" : "Verdi 1", body: isEn ? "Description." : "Beskrivelse." }),
        mk("richText", { heading: isEn ? "Value 2" : "Verdi 2", body: isEn ? "Description." : "Beskrivelse." }),
        mk("richText", { heading: isEn ? "Value 3" : "Verdi 3", body: isEn ? "Description." : "Beskrivelse." }),
        mk("cta", copy.cta),
      ];
  }

  const include = safeSectionList(input.sectionsInclude);
  const exclude = safeSectionList(input.sectionsExclude);
  blocks = filterBlocksBySections(blocks, include.length > 0 ? include : undefined, exclude.length > 0 ? exclude : undefined);

  const title =
    (input.prompt ?? "").trim().slice(0, 80) ||
    (isEn ? "New page" : "Ny side");
  const summary =
    isEn
      ? `Draft from structured intent (${pageType}). ${blocks.length} block(s). Review and save as draft.`
      : `Utkast fra strukturt intent (${pageType}). ${blocks.length} blokk(er). Gjennomgå og lagre som kladd.`;

  return { title, summary, blocks };
}

function buildResult(prompt: string, locale: string): PageBuilderResult {
  const intent = detectIntent(prompt);
  const title = titleFromPrompt(prompt, locale, intent);
  const isEn = locale === "en";
  let blocks: PageBuilderBlockIntent[];
  let summary: string;
  switch (intent) {
    case "contact":
      blocks = blocksForContact(locale);
      summary = isEn ? "Contact page structure (hero, how to reach us, CTA)." : "Kontaktside: hero, slik når du oss, CTA.";
      break;
    case "info":
      blocks = blocksForInfo(locale);
      summary = isEn ? "Info/how-it-works structure (hero, steps, CTA)." : "Infoside: hero, steg, CTA.";
      break;
    case "pricing":
      blocks = blocksForPricing(locale);
      summary = isEn ? "Pricing page structure (hero, options, CTA)." : "Priside: hero, alternativer, CTA.";
      break;
    case "landing":
      blocks = blocksForLanding(locale);
      summary = isEn ? "Landing structure (hero, value props, CTA)." : "Landingsside: hero, verdier, CTA.";
      break;
    default:
      blocks = blocksForGeneric(locale);
      summary = isEn ? "Generic page structure. Edit blocks as needed." : "Generisk sidestruktur. Rediger blokkene etter behov.";
  }
  return { title, summary, blocks: blocks.map((b) => ({ ...b, data: { ...b.data } })) };
}

/**
 * Generate page structure: supports either structured input (full composer) or prompt-only (legacy).
 * Degrades to deterministic templates; never publishes. Output is draft-only.
 */
export async function generatePageStructure(
  prompt: string,
  locale: string
): Promise<PageBuilderResult> {
  const trimmed = (prompt ?? "").trim();
  if (!trimmed) {
    return { summary: "Skriv en beskrivelse av siden.", blocks: [], warnings: ["Tom prompt."] };
  }
  const effectiveLocale = locale === "en" ? "en" : "nb";
  return buildResult(trimmed, effectiveLocale);
}
