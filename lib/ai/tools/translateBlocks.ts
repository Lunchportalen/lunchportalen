/**
 * Phase 29: Translation tool – produces AIPatchV1 with updateBlockData ops.
 * Deterministic: small NB→EN dictionary; only allowlisted fields; no URLs/ids.
 * When no translatable content: return { summary, stats } without patch (ops 1..20 required by validator).
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";

export type TranslateBlocksInput = {
  fromLocale: string;
  toLocale: string;
  tone?: "enterprise" | "warm" | "neutral";
  mode?: "safe" | "strict";
  locale: string;
};

export type TranslateBlocksStats = {
  blocksScanned: number;
  blocksTranslated: number;
  fieldsTranslated: number;
  skippedBlocks: number;
};

type BlockWithData = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
};

const ALLOWLIST: Record<string, string[]> = {
  hero: ["title", "subtitle", "ctaLabel"],
  richText: ["heading", "body"],
  cta: ["title", "body", "buttonLabel"],
};

const SKIP_PREFIXES = ["http://", "https://", "/", "#", "mailto:", "tel:"];

function shouldSkipString(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  for (const p of SKIP_PREFIXES) {
    if (lower.startsWith(p)) return true;
  }
  if (/^blk_/.test(t) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return true;
  return false;
}

const NB_TO_EN: Record<string, string> = {
  Velkommen: "Welcome",
  "Ta kontakt": "Get in touch",
  "Kontakt oss": "Contact us",
  "Les mer": "Read more",
  "Kom i gang": "Get started",
  "Få forespørsler": "Get enquiries",
  "Enkel oppsett": "Simple setup",
  "Tydelig rapportering": "Clear reporting",
  "Support når du trenger det": "Support when you need it",
  "Hvorfor velge oss": "Why choose us",
  Introduksjon: "Introduction",
  "Klar for å komme i gang?": "Ready to get started?",
  "Kontakt oss for en demo eller mer informasjon.": "Contact us for a demo or more information.",
  Beslutningstakere: "Decision makers",
  "Stor overskrift for hero": "Main hero headline",
  "Primær handling": "Primary action",
  "Bruk rich text til å forklare funksjoner, fordeler eller innhold i større detalj.":
    "Use rich text to explain features, benefits or content in more detail.",
  "Klar CTA-tittel": "Clear CTA title",
};

function translateString(text: string, fromLocale: string, toLocale: string): string {
  const t = text.trim();
  if (!t) return text;
  if (shouldSkipString(t)) return text;
  if (fromLocale === "nb" && (toLocale === "en" || toLocale === "en-GB")) {
    return NB_TO_EN[t] ?? text;
  }
  return text;
}

export function translateBlocksToPatch(args: {
  input: TranslateBlocksInput;
  blocks: BlockWithData[];
}): {
  summary: string;
  patch?: AIPatchV1;
  stats: TranslateBlocksStats;
} {
  const { input, blocks } = args;
  const fromLocale = String(input.fromLocale || "nb").toLowerCase();
  const toLocale = String(input.toLocale || "en").toLowerCase();
  const stats: TranslateBlocksStats = {
    blocksScanned: blocks.length,
    blocksTranslated: 0,
    fieldsTranslated: 0,
    skippedBlocks: 0,
  };

  const ops: AIPatchV1["ops"] = [];
  const MAX_OPS = 20;

  for (const block of blocks) {
    if (ops.length >= MAX_OPS) {
      stats.skippedBlocks++;
      continue;
    }
    const fields = ALLOWLIST[block.type];
    if (!fields || !block.data || typeof block.data !== "object") continue;

    const partial: Record<string, unknown> = {};
    let changed = 0;
    for (const key of fields) {
      const val = block.data[key];
      if (val == null || typeof val !== "string") continue;
      const translated = translateString(val, fromLocale, toLocale);
      if (translated !== val) {
        partial[key] = translated;
        changed++;
      }
    }
    if (changed > 0) {
      ops.push({ op: "updateBlockData", id: block.id, data: partial });
      stats.blocksTranslated++;
      stats.fieldsTranslated += changed;
    }
  }

  if (ops.length === 0) {
    const summary =
      input.locale === "en"
        ? "No translatable fields found."
        : "Ingen oversettbare felt funnet.";
    return { summary, stats };
  }

  const patch: AIPatchV1 = { version: 1, ops };
  const summary =
    input.locale === "en"
      ? `Translated ${stats.blocksTranslated} block(s), ${stats.fieldsTranslated} field(s).`
      : `Oversatte ${stats.blocksTranslated} blokk(er), ${stats.fieldsTranslated} felt.`;

  return { summary, patch, stats };
}