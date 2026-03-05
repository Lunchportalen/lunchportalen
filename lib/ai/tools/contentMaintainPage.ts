/**
 * Phase 31: Content maintenance engine – detect decay, suggest patch + metaSuggestion.
 * Deterministic; uses canonical newBlockId(); ops <= maxOps (default 10, cap 20).
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { newBlockId } from "@/lib/cms/model/blockId";

export type ContentMaintainInput = {
  locale: string;
  pageTitle?: string;
  goal?: "lead" | "info" | "signup";
  brand?: string;
  mode?: "safe" | "strict";
  maxOps?: number;
};

export type ContentMaintainContext = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: { description?: string };
};

export type MaintenanceIssue = {
  code:
    | "missing_faq"
    | "short_intro"
    | "weak_cta"
    | "missing_cta"
    | "missing_value_props"
    | "short_meta_description"
    | "short_title";
  severity: "info" | "warn" | "error";
  message: string;
};

export type ContentMaintainOutput = {
  summary: string;
  issues: MaintenanceIssue[];
  stats: { blocksScanned: number; opsProposed: number; issuesFound: number };
  patch?: AIPatchV1;
  metaSuggestion?: { title?: string; description?: string };
};

const FAQ_HEADING_NB = "Spørsmål og svar";
const FAQ_HEADING_EN = "FAQ";
const VALUE_PROPS_HEADINGS = ["derfor", "fordeler", "hvorfor", "benefits"];
const INTRO_BODY_MIN = 200;

function hasFaqBlock(blocks: ContentMaintainContext["blocks"], locale: string): boolean {
  const needle = locale === "en" ? FAQ_HEADING_EN : FAQ_HEADING_NB;
  return blocks.some((b) => {
    if (b.type !== "richText" || !b.data) return false;
    const h = b.data.heading ?? b.data.title;
    return typeof h === "string" && h.trim().toLowerCase() === needle.toLowerCase();
  });
}

function hasValuePropsBlock(blocks: ContentMaintainContext["blocks"]): boolean {
  return blocks.some((b) => {
    if (b.type !== "richText" || !b.data) return false;
    const h = (b.data.heading ?? b.data.title ?? "") as string;
    const lower = String(h).toLowerCase();
    return VALUE_PROPS_HEADINGS.some((k) => lower.includes(k));
  });
}

function findFaqInsertIndex(blocks: ContentMaintainContext["blocks"]): number {
  const firstRich = blocks.findIndex((b) => b.type === "richText");
  if (firstRich >= 0) return firstRich + 1;
  const firstHero = blocks.findIndex((b) => b.type === "hero");
  if (firstHero >= 0) return firstHero + 1;
  return 0;
}

function firstIntroRichText(blocks: ContentMaintainContext["blocks"], locale: string): { index: number; block: { id: string; type: string; data?: Record<string, unknown> } } | null {
  const faqNeedle = locale === "en" ? FAQ_HEADING_EN : FAQ_HEADING_NB;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "richText") continue;
    const h = (b.data?.heading ?? b.data?.title ?? "") as string;
    if (String(h).trim().toLowerCase() === faqNeedle.toLowerCase()) continue;
    return { index: i, block: b };
  }
  return null;
}

function faqBody(locale: string): string {
  if (locale === "en") {
    return `Q: What is Lunchportalen?\nA: Lunchportalen is a lunch ordering and delivery solution for workplaces.\n\nQ: How does delivery work?\nA: Orders are delivered to your office at the agreed time.\n\nQ: Who is this for?\nA: HR and office managers who want a simple lunch solution.`;
  }
  return `Q: Hva er Lunchportalen?\nA: Lunchportalen er en lunsjordning og leveranseløsning for arbeidsplasser.\n\nQ: Hvordan fungerer leveringen?\nA: Bestillinger leveres til kontoret på avtalt tid.\n\nQ: Hvem passer dette for?\nA: HR og kontoransvarlige som ønsker en enkel lunsjordning.`;
}

function valuePropsBody(locale: string): string {
  if (locale === "en") {
    return "- Simple setup\n- Clear reporting\n- Support when you need it";
  }
  return "- Enkel oppsett\n- Tydelig rapportering\n- Support når du trenger det";
}

function metaDescTemplate(locale: string, brand: string, goal: string): string {
  if (locale === "en") {
    const g = goal === "signup" ? "sign up" : goal === "info" ? "information" : "leads";
    return `${brand} helps workplaces with lunch ordering and delivery. Get ${g}, request a demo, or contact us.`.slice(0, 160);
  }
  const g = goal === "signup" ? "registrering" : goal === "info" ? "informasjon" : "forespørsler";
  return `${brand} hjelper arbeidsplasser med lunsjbestilling og levering. Få ${g}, be om demo eller ta kontakt.`.slice(0, 160);
}

export function contentMaintainToSuggestion(args: {
  input: ContentMaintainInput;
  context: ContentMaintainContext;
}): ContentMaintainOutput {
  const { input, context } = args;
  const locale = (input.locale || "nb").toLowerCase().startsWith("en") ? "en" : "nb";
  const brand = (input.brand || "Lunchportalen").trim();
  const goal = input.goal === "info" || input.goal === "signup" ? input.goal : "lead";
  const mode = input.mode === "strict" ? "strict" : "safe";
  const maxOps = Math.min(20, Math.max(1, Math.floor(Number(input.maxOps) || 10)));
  const blocks = context.blocks.slice(0, 100);
  const metaDesc = context.meta?.description;
  const pageTitle = input.pageTitle?.trim() ?? "";

  const issues: MaintenanceIssue[] = [];
  const ops: AIPatchV1["ops"] = [];
  const metaSuggestion: { title?: string; description?: string } = {};
  let opsProposed = 0;

  if (!pageTitle) {
    issues.push({ code: "short_title", severity: "warn", message: locale === "en" ? "Page title is missing." : "Sidetittel mangler." });
  } else if (pageTitle.length < 20) {
    issues.push({ code: "short_title", severity: "info", message: locale === "en" ? "Page title is short." : "Sidetittel er kort." });
  }

  if (!metaDesc || metaDesc.length < 80) {
    issues.push({ code: "short_meta_description", severity: "warn", message: locale === "en" ? "Meta description missing or too short." : "Meta-beskrivelse mangler eller er for kort." });
  }

  const hasFaq = hasFaqBlock(blocks, locale);
  if (!hasFaq) {
    issues.push({ code: "missing_faq", severity: "warn", message: locale === "en" ? "FAQ section missing." : "FAQ-seksjon mangler." });
  }

  const intro = firstIntroRichText(blocks, locale);
  const introBodyLen = intro?.block?.data?.body ? String(intro.block.data.body).length : 0;
  if (intro && introBodyLen < INTRO_BODY_MIN) {
    issues.push({ code: "short_intro", severity: "warn", message: locale === "en" ? "Intro text is short." : "Introtekst er kort." });
  } else if (!intro && blocks.some((b) => b.type === "richText")) {
    issues.push({ code: "short_intro", severity: "warn", message: locale === "en" ? "No intro richText found." : "Ingen intro richText funnet." });
  }

  const ctaBlock = blocks.find((b) => b.type === "cta");
  if (!ctaBlock) {
    issues.push({ code: "missing_cta", severity: "error", message: locale === "en" ? "CTA block missing." : "CTA-blokk mangler." });
  } else {
    const data = ctaBlock.data ?? {};
    const bl = typeof data.buttonLabel === "string" ? data.buttonLabel.trim() : "";
    const tl = typeof data.title === "string" ? data.title.trim() : "";
    if (!bl || bl.toLowerCase() === "klikk her" || bl.toLowerCase() === "click here") {
      issues.push({ code: "weak_cta", severity: "warn", message: locale === "en" ? "CTA button label missing or generic." : "CTA-knapptekst mangler eller er generisk." });
    }
    if (!tl || tl.length < 10) {
      issues.push({ code: "weak_cta", severity: "warn", message: locale === "en" ? "CTA title missing or too short." : "CTA-tittel mangler eller er for kort." });
    }
  }

  if (!hasValuePropsBlock(blocks)) {
    issues.push({ code: "missing_value_props", severity: "info", message: locale === "en" ? "Value props section missing." : "Verdiargument-seksjon mangler." });
  }

  if (issues.length === 0) {
    const summary = locale === "en" ? "No issues found." : "Ingen avvik funnet.";
    return { summary, issues: [], stats: { blocksScanned: blocks.length, opsProposed: 0, issuesFound: 0 } };
  }

  if (opsProposed < maxOps && !ctaBlock) {
    const id = newBlockId();
    const ctaTitle = locale === "en" ? "Ready to get started?" : "Klar for å komme i gang?";
    const ctaBody = locale === "en" ? "Contact us for a demo or more information." : "Kontakt oss for en demo eller mer informasjon.";
    ops.push({
      op: "insertBlock",
      index: blocks.length,
      block: { id, type: "cta", data: { title: ctaTitle, body: ctaBody, buttonLabel: locale === "en" ? "Request a demo" : "Be om demo", buttonHref: "#kontakt" } },
    });
    opsProposed++;
  }

  if (opsProposed < maxOps && ctaBlock) {
    const data = ctaBlock.data ?? {};
    const bl = typeof data.buttonLabel === "string" ? data.buttonLabel.trim() : "";
    const tl = typeof data.title === "string" ? data.title.trim() : "";
    const needFix = !bl || bl.toLowerCase() === "klikk her" || bl.toLowerCase() === "click here" || !tl || tl.length < 10;
    if (needFix) {
      const partial: Record<string, unknown> = {};
      if (!bl || bl.toLowerCase() === "klikk her" || bl.toLowerCase() === "click here") partial.buttonLabel = locale === "en" ? "Request a demo" : "Be om demo";
      if (!tl || tl.length < 10) partial.title = locale === "en" ? "Ready to get started?" : "Klar for å komme i gang?";
      ops.push({ op: "updateBlockData", id: ctaBlock.id, data: partial });
      opsProposed++;
    }
  }

  if (opsProposed < maxOps && !hasFaq) {
    const idx = findFaqInsertIndex(blocks);
    const heading = locale === "en" ? FAQ_HEADING_EN : FAQ_HEADING_NB;
    const id = newBlockId();
    ops.push({
      op: "insertBlock",
      index: idx,
      block: { id, type: "richText", data: { heading, body: faqBody(locale) } },
    });
    opsProposed++;
  }

  if (opsProposed < maxOps && intro && introBodyLen < INTRO_BODY_MIN) {
    const body = (intro.block.data?.body && String(intro.block.data.body)) || "";
    const append = locale === "en"
      ? "\n\nLunchportalen helps workplaces offer a simple lunch solution with clear reporting and support."
      : "\n\nLunchportalen hjelper arbeidsplasser med en enkel lunsjordning, tydelig rapportering og support.";
    const newBody = body.trim() ? body + append : (locale === "en" ? "Lunchportalen helps workplaces with lunch ordering and delivery." : "Lunchportalen hjelper arbeidsplasser med lunsjbestilling og levering.");
    ops.push({ op: "updateBlockData", id: intro.block.id, data: { body: newBody } });
    opsProposed++;
  }

  if (opsProposed < maxOps && !hasValuePropsBlock(blocks)) {
    const idx = blocks.findIndex((b) => b.type === "richText") >= 0 ? findFaqInsertIndex(blocks) : (blocks.findIndex((b) => b.type === "hero") >= 0 ? 1 : 0);
    const heading = locale === "en" ? "Benefits" : "Fordeler";
    const id = newBlockId();
    ops.push({
      op: "insertBlock",
      index: idx,
      block: { id, type: "richText", data: { heading, body: valuePropsBody(locale) } },
    });
    opsProposed++;
  }

  if (pageTitle && pageTitle.length < 20) {
    metaSuggestion.title = `${pageTitle} | ${brand}`;
  }
  if (!metaDesc || metaDesc.length < 80) {
    metaSuggestion.description = metaDescTemplate(locale, brand, goal);
  }

  const patch = ops.length > 0 ? { version: 1 as const, ops } : undefined;
  const hasMeta = !!metaSuggestion.title || !!metaSuggestion.description;
  const summary =
    locale === "en"
      ? `Maintenance: ${issues.length} issue(s). ${ops.length} op(s).`
      : `Vedlikehold: ${issues.length} avvik. ${ops.length} operasjon(er).`;

  return {
    summary,
    issues,
    stats: { blocksScanned: blocks.length, opsProposed: ops.length, issuesFound: issues.length },
    ...(patch && { patch }),
    ...(hasMeta && { metaSuggestion }),
  };
}