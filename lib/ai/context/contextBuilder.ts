/**
 * Samler all kontekst for AI: sideinnhold, struktur, SEO, analytics, brukerdata, intern linking, CMS schema.
 * Single entry point; bruker buildContext (AI Context Engine) og legger til normalisert brukerdata.
 * Ingen eksterne API-kall — alle kilder sendes inn.
 */

import type { AiActionContext } from "../runAiAction";
import {
  buildContext,
  type BuildContextInput,
  type NormalizedAiContext,
  type PageContentSource,
  type SchemaSource,
  type SeoFieldsSource,
  type AnalyticsSignalsSource,
  type InternalLinksSource,
  type StructureSource,
  type NormalizedInternalLinksContext,
  type NormalizedStructureContext,
} from "./buildContext";

/** Kildedata for bruker/sesjon (valgfritt). */
export type BrukerdataSource = {
  userId?: string | null;
  segmentId?: string | null;
  role?: string | null;
  locale?: string | null;
  companyId?: string | null;
  locationId?: string | null;
  email?: string | null;
  /** Nylig aktivitet / session signals */
  lastActivityAt?: string | null;
  [key: string]: unknown;
} | null | undefined;

/** Input til contextBuilder: alle kilder valgfrie. */
export type ContextBuilderInput = BuildContextInput & {
  /** Brukerdata for personalisering og tilgangskontroll */
  brukerdata?: BrukerdataSource;
};

/** Normalisert brukerdata-slice i kontekst. */
export type NormalizedBrukerdataContext = {
  userId?: string;
  segmentId?: string;
  role?: string;
  locale?: string;
  companyId?: string;
  locationId?: string;
  email?: string;
  lastActivityAt?: string;
};

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s || undefined;
}

function normalizeBrukerdata(input: BrukerdataSource): NormalizedBrukerdataContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const o = input as Record<string, unknown>;
  const out: NormalizedBrukerdataContext = {};
  const userId = safeStr(o.userId);
  const segmentId = safeStr(o.segmentId);
  const role = safeStr(o.role);
  const locale = safeStr(o.locale);
  const companyId = safeStr(o.companyId);
  const locationId = safeStr(o.locationId);
  const email = safeStr(o.email);
  const lastActivityAt = safeStr(o.lastActivityAt);
  if (userId !== undefined) out.userId = userId;
  if (segmentId !== undefined) out.segmentId = segmentId;
  if (role !== undefined) out.role = role;
  if (locale !== undefined) out.locale = locale;
  if (companyId !== undefined) out.companyId = companyId;
  if (locationId !== undefined) out.locationId = locationId;
  if (email !== undefined) out.email = email;
  if (lastActivityAt !== undefined) out.lastActivityAt = lastActivityAt;
  return out;
}

/** Full kontekst returnert av contextBuilder: sideinnhold, analytics, SEO, brukerdata, struktur. */
export type FullAiContext = NormalizedAiContext & {
  /** Bruker/sesjonsdata (normalisert). */
  brukerdata: NormalizedBrukerdataContext;
};

/**
 * Samler all kontekst til ett objekt for AI-capabilities:
 * - sideinnhold (page)
 * - analytics
 * - SEO
 * - brukerdata
 * - struktur (schema)
 *
 * Ingen eksterne kall; alle kilder er valgfrie og normaliseres.
 */
export function contextBuilder(input: ContextBuilderInput = {}): FullAiContext & AiActionContext {
  const base = buildContext({
    pageContent: input.pageContent,
    schema: input.schema,
    seoFields: input.seoFields,
    analyticsSignals: input.analyticsSignals,
    locale: input.locale,
    pageId: input.pageId,
    variantId: input.variantId,
  });

  const brukerdata = normalizeBrukerdata(input.brukerdata);

  return {
    ...base,
    brukerdata,
    // Alias for tydelig bruk i capabilities:
    // page = sideinnhold, schema = struktur, seo, analytics, brukerdata
  };
}

// Re-export for convenience
export type {
  PageContentSource,
  SchemaSource,
  SeoFieldsSource,
  AnalyticsSignalsSource,
  InternalLinksSource,
  StructureSource,
  NormalizedInternalLinksContext,
  NormalizedStructureContext,
};
export { buildContext } from "./buildContext";
