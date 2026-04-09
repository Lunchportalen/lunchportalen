/**
 * Canonical revenue / CRO event model.
 * Aligns with `content_analytics_events` + optional extensions on POST /api/public/analytics.
 *
 * blockId: prefer `metadata.cms_block_id` (see lib/cms/surfaceAnalytics.ts).
 */

export const REVENUE_EVENT_TYPES = [
  "page_view",
  "scroll_depth",
  "cta_click",
  "form_submit",
  "conversion",
] as const;

export type RevenueEventType = (typeof REVENUE_EVENT_TYPES)[number];

/** Normalized event for attribution & performance analysis (pure JSON shape). */
export type CanonicalRevenueEvent = {
  type: RevenueEventType;
  /** Page identifier (CMS page id or path slug). */
  page: string;
  pageId?: string;
  variantId?: string | null;
  blockId?: string;
  timestamp: string;
  environment?: string;
  locale?: string;
  /** 0–100 when type === scroll_depth */
  scrollDepthPct?: number;
  /** Monetary value in minor units (e.g. øre) when attributable */
  revenueCents?: number;
  metadata: Record<string, unknown>;
};

export type ContentAnalyticsEventRow = {
  id?: string;
  page_id?: string | null;
  variant_id?: string | null;
  environment?: string | null;
  locale?: string | null;
  event_type?: string | null;
  event_key?: string | null;
  event_value?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function asRevenueType(raw: string | null | undefined): RevenueEventType | null {
  if (!raw) return null;
  return REVENUE_EVENT_TYPES.includes(raw as RevenueEventType) ? (raw as RevenueEventType) : null;
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Map DB/API row → canonical event. Fail-closed: unknown event_type → null (caller skips).
 */
export function normalizeAnalyticsRow(row: ContentAnalyticsEventRow): CanonicalRevenueEvent | null {
  const t = asRevenueType(row.event_type ?? undefined);
  if (!t) return null;
  const meta = isPlainObject(row.metadata) ? row.metadata : {};
  const blockId =
    typeof meta.cms_block_id === "string" && meta.cms_block_id.trim() !== ""
      ? meta.cms_block_id.trim()
      : undefined;
  const page = (row.page_id != null && String(row.page_id).trim() !== "" ? String(row.page_id) : "") || "/";
  const ts = typeof row.created_at === "string" && row.created_at ? row.created_at : new Date().toISOString();
  const revenueCents =
    numOrUndef(meta.revenue_cents) ??
    numOrUndef(meta.revenueCents) ??
    (t === "conversion" ? numOrUndef(row.event_value) : undefined);
  let scrollDepthPct: number | undefined;
  if (t === "scroll_depth") {
    scrollDepthPct = numOrUndef(meta.scroll_depth_pct) ?? numOrUndef(meta.scrollDepthPct);
    if (scrollDepthPct == null && row.event_value != null) {
      scrollDepthPct = numOrUndef(row.event_value);
    }
  }
  return {
    type: t,
    page,
    pageId: row.page_id ?? undefined,
    variantId: row.variant_id ?? null,
    blockId,
    timestamp: ts,
    environment: row.environment ?? undefined,
    locale: row.locale ?? undefined,
    scrollDepthPct,
    revenueCents,
    metadata: meta,
  };
}

/** Client → public analytics POST body helper (types only; route validates). */
export type PublicAnalyticsEventPayload = {
  environment: "prod" | "staging";
  locale: "nb" | "en";
  eventType: RevenueEventType;
  pageId?: string;
  variantId?: string;
  eventKey?: string;
  eventValue?: string | null;
  metadata?: Record<string, unknown>;
};
