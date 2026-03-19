/**
 * Helpers for Page AI Contract â€” parse/merge body.meta safely.
 * Single source: types in pageAiContract.ts.
 */

import type { PageAiContract, PageAiCro, PageAiDiagnostics, PageAiIntent, PageAiSeo, PageAiSocial } from "./pageAiContract";

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s || undefined;
}
function safeArrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean);
}
function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

/**
 * Parse raw body.meta into PageAiContract. Safe for incomplete or legacy data.
 */
export function parseMetaToPageAiContract(meta: unknown): PageAiContract {
  const root = safeObj(meta);
  const seoRaw = safeObj(root.seo);
  const socialRaw = safeObj(root.social);
  const intentRaw = safeObj(root.intent);
  const croRaw = safeObj(root.cro);
  const diagRaw = safeObj(root.diagnostics);

  const seo: PageAiSeo = {};
  const t = safeStr(seoRaw.title);
  if (t !== undefined) seo.title = t;
  const d = safeStr(seoRaw.description);
  if (d !== undefined) seo.description = d;
  const c = safeStr(seoRaw.canonical) ?? safeStr(seoRaw.canonicalUrl);
  if (c !== undefined) seo.canonical = c;

  const social: PageAiSocial = {};
  if (safeStr(socialRaw.title) !== undefined) social.title = safeStr(socialRaw.title);
  if (safeStr(socialRaw.description) !== undefined) social.description = safeStr(socialRaw.description);

  const intent: PageAiIntent = {};
  if (safeStr(intentRaw.intent) !== undefined) intent.intent = safeStr(intentRaw.intent);
  if (safeStr(intentRaw.audience) !== undefined) intent.audience = safeStr(intentRaw.audience);
  if (safeStr(intentRaw.primaryKeyword) !== undefined) intent.primaryKeyword = safeStr(intentRaw.primaryKeyword);
  const sk = safeArrStr(intentRaw.secondaryKeywords);
  if (sk.length) intent.secondaryKeywords = sk;
  const cg = safeArrStr(intentRaw.contentGoals);
  if (cg.length) intent.contentGoals = cg;
  if (safeStr(intentRaw.brandTone) !== undefined) intent.brandTone = safeStr(intentRaw.brandTone);

  const cro: PageAiCro = {};
  if (safeStr(croRaw.primaryCta) !== undefined) cro.primaryCta = safeStr(croRaw.primaryCta);
  const ts = safeArrStr(croRaw.trustSignals);
  if (ts.length) cro.trustSignals = ts;
  if (safeStr(croRaw.scannability) !== undefined) cro.scannability = safeStr(croRaw.scannability);

  const diagnostics: PageAiDiagnostics = {};
  if (safeStr(diagRaw.lastRun) !== undefined) diagnostics.lastRun = safeStr(diagRaw.lastRun);
  const diag = safeArrStr(diagRaw.diagnostics);
  if (diag.length) diagnostics.diagnostics = diag;
  const sug = safeArrStr(diagRaw.suggestions);
  if (sug.length) diagnostics.suggestions = sug;

  const out: PageAiContract = {};
  if (Object.keys(seo).length) out.seo = seo;
  if (Object.keys(social).length) out.social = social;
  if (Object.keys(intent).length) out.intent = intent;
  if (Object.keys(cro).length) out.cro = cro;
  if (Object.keys(diagnostics).length) out.diagnostics = diagnostics;
  return out;
}

/**
 * Merge contract fields into existing meta. Preserves all non-contract keys (nav, scripts, etc.).
 */
export function mergeContractIntoMeta(
  meta: Record<string, unknown>,
  contract: Partial<PageAiContract>
): Record<string, unknown> {
  const next = { ...meta };
  if (contract.seo && typeof contract.seo === "object") {
    const prevSeo = safeObj(next.seo);
    next.seo = { ...prevSeo, ...contract.seo };
  }
  if (contract.social && typeof contract.social === "object") {
    const prevSocial = safeObj(next.social);
    next.social = { ...prevSocial, ...contract.social };
  }
  if (contract.intent && typeof contract.intent === "object") {
    const prevIntent = safeObj(next.intent);
    next.intent = { ...prevIntent, ...contract.intent };
  }
  if (contract.cro && typeof contract.cro === "object") {
    const prevCro = safeObj(next.cro);
    next.cro = { ...prevCro, ...contract.cro };
  }
  if (contract.diagnostics && typeof contract.diagnostics === "object") {
    const prevDiag = safeObj(next.diagnostics);
    next.diagnostics = { ...prevDiag, ...contract.diagnostics };
  }
  return next;
}

/** Minimal meta shape for AI suggest (description, title). */
export function contractToAiMetaShape(contract: PageAiContract): { description?: string; title?: string } {
  const out: { description?: string; title?: string } = {};
  if (contract.seo?.description) out.description = contract.seo.description;
  if (contract.seo?.title) out.title = contract.seo.title;
  return out;
}
/**
 * Extract AI context meta from request input.meta (flat or Page AI Contract shape).
 * Used by suggest route to accept both { description, title } and { seo: { description, title } }.
 */
export function inputMetaToAiContext(inputMeta: unknown): { description?: string; title?: string } | undefined {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) return undefined;
  const m = inputMeta as Record<string, unknown>;
  const seo = safeObj(m.seo);
  const description =
    typeof seo.description === "string" && seo.description.trim()
      ? (seo.description as string).trim()
      : typeof m.description === "string" && (m.description as string).trim()
        ? (m.description as string).trim()
        : undefined;
  const title =
    typeof seo.title === "string" && seo.title.trim()
      ? (seo.title as string).trim()
      : typeof m.title === "string" && (m.title as string).trim()
        ? (m.title as string).trim()
        : undefined;
  if (!description && !title) return undefined;
  return { ...(description && { description }), ...(title && { title }) };
}
