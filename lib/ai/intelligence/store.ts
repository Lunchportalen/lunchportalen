/**
 * Unified intelligence store — `logEvent` / `getEvents` on `ai_intelligence_events`.
 * Normalizes legacy `event_type` values on read; new writes use canonical domain types only.
 */

import "server-only";

import { INTELLIGENCE_DOMAIN_TYPES } from "@/lib/ai/schema/events";
import { IntelligenceStoreFetchError } from "@/lib/ai/schema/errors";
import { validateEvent } from "@/lib/ai/schema/validate";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

import type { IntelligenceDomainType, IntelligenceEvent, LogEventInput } from "./types";

const PAYLOAD_MAX_KEYS = 48;

const DOMAIN_TYPES: readonly IntelligenceDomainType[] = INTELLIGENCE_DOMAIN_TYPES;

/** Legacy DB `event_type` → canonical domain. */
const LEGACY_TO_DOMAIN: Record<string, IntelligenceDomainType> = {
  gtm_outcome: "gtm",
  gtm_conversion: "conversion",
  revenue_insights: "analytics",
  editor_metric: "analytics",
  design_change: "design_change",
  experiment: "experiment",
  conversion: "conversion",
};

const KIND_FOR_LEGACY: Record<string, string> = {
  gtm_outcome: "gtm_outcome",
  gtm_conversion: "gtm_conversion",
  revenue_insights: "revenue_insights",
  editor_metric: "editor_metric",
};

export function coerceDbTypeToDomain(dbEventType: string): IntelligenceDomainType {
  const t = String(dbEventType ?? "").trim();
  if ((DOMAIN_TYPES as readonly string[]).includes(t)) return t as IntelligenceDomainType;
  return LEGACY_TO_DOMAIN[t] ?? "analytics";
}

/** Include legacy DB values when filtering by domain. */
export function expandDomainTypesForQuery(types: readonly IntelligenceDomainType[]): string[] {
  const out = new Set<string>();
  for (const d of types) {
    out.add(d);
    if (d === "gtm") out.add("gtm_outcome");
    if (d === "conversion") {
      out.add("gtm_conversion");
      out.add("conversion");
    }
    if (d === "analytics") {
      out.add("revenue_insights");
      out.add("editor_metric");
    }
    if (d === "design_change") out.add("design_change");
    if (d === "experiment") out.add("experiment");
  }
  return [...out];
}

function truncatePayload(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj);
  if (keys.length <= PAYLOAD_MAX_KEYS) return obj;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < PAYLOAD_MAX_KEYS; i++) out[keys[i]!] = obj[keys[i]!];
  out._truncated = true;
  return out;
}

export function dbRowToIntelligenceEvent(r: Record<string, unknown>): IntelligenceEvent {
  const dbType = String(r.event_type ?? "");
  const domain = coerceDbTypeToDomain(dbType);
  const created = String(r.created_at ?? "");
  const ts = Date.parse(created);
  const payloadBase =
    typeof r.payload === "object" && r.payload && !Array.isArray(r.payload)
      ? (r.payload as Record<string, unknown>)
      : {};
  const legacyKind = KIND_FOR_LEGACY[dbType];
  const payload =
    legacyKind && typeof payloadBase.kind !== "string" ? { ...payloadBase, kind: legacyKind } : payloadBase;

  return {
    id: String(r.id ?? ""),
    type: domain,
    source: String(r.source ?? ""),
    timestamp: Number.isFinite(ts) ? ts : 0,
    payload,
  };
}

export type LogEventResult = { ok: true; event: IntelligenceEvent } | { ok: false; error: string };

/**
 * Append one canonical intelligence event (single write path for all subsystems).
 * Invalid envelope or payload throws {@link IntelligenceSchemaValidationError} — no DB write.
 */
export async function logEvent(input: LogEventInput): Promise<LogEventResult> {
  const normalized: LogEventInput = {
    ...input,
    source: String(input.source ?? "").trim(),
    payload:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : {},
  };

  validateEvent(normalized);

  try {
    const payload = truncatePayload(normalized.payload);
    const { data, error } = await supabaseAdmin()
      .from("ai_intelligence_events")
      .insert({
        event_type: normalized.type,
        source: normalized.source,
        payload,
        page_id: normalized.page_id ?? null,
        company_id: normalized.company_id ?? null,
        source_rid: normalized.source_rid ?? null,
      })
      .select("id, event_type, source, payload, page_id, company_id, source_rid, created_at")
      .single();

    if (error) return { ok: false, error: error.message };
    if (!data || typeof data !== "object") return { ok: false, error: "Insert returned no row" };
    return { ok: true, event: dbRowToIntelligenceEvent(data as Record<string, unknown>) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("ai_intelligence.log_event_failed", { error: msg, type: normalized.type, source: normalized.source });
    return { ok: false, error: msg };
  }
}

export type GetEventsFilter = {
  types?: IntelligenceDomainType[];
  source?: string;
  /** Unix ms — inclusive */
  since?: number;
  limit?: number;
  companyScopeId?: string | null;
};

/**
 * Query intelligence events (newest first). Handles legacy rows via {@link dbRowToIntelligenceEvent}.
 */
export async function getEvents(filter?: GetEventsFilter): Promise<IntelligenceEvent[]> {
  const limit = Math.min(2000, Math.max(1, filter?.limit ?? 500));
  try {
    let q = supabaseAdmin()
      .from("ai_intelligence_events")
      .select("id, event_type, source, payload, page_id, company_id, source_rid, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter?.types?.length) {
      q = q.in("event_type", expandDomainTypesForQuery(filter.types));
    }
    if (filter?.source) q = q.eq("source", filter.source.trim());
    if (filter?.since != null && Number.isFinite(filter.since)) {
      q = q.gte("created_at", new Date(filter.since).toISOString());
    }
    if (filter?.companyScopeId != null && String(filter.companyScopeId).trim() !== "") {
      const cid = String(filter.companyScopeId).trim();
      q = q.or(`company_id.is.null,company_id.eq.${cid}`);
    }

    const { data, error } = await q;
    if (error) {
      opsLog("ai_intelligence.get_events_failed", { error: error.message });
      throw new IntelligenceStoreFetchError("Data fetch failed", error.message);
    }
    const rows = Array.isArray(data) ? data : [];
    return rows.map((r) => dbRowToIntelligenceEvent(r as Record<string, unknown>));
  } catch (e) {
    if (e instanceof IntelligenceStoreFetchError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("ai_intelligence.get_events_failed", { error: msg });
    throw new IntelligenceStoreFetchError("Data fetch failed", msg);
  }
}

export type AppendIntelligenceEventResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Back-compat: coerce legacy `event_type` strings to domain and {@link logEvent}.
 */
export async function appendIntelligenceEvent(row: import("./types").IntelligenceEventInsert): Promise<AppendIntelligenceEventResult> {
  const rawType = String(row.type ?? "").trim();
  const domain = coerceDbTypeToDomain(rawType);
  const payload = { ...row.payload };
  if (rawType && rawType !== domain && typeof payload.kind !== "string") {
    payload.kind = rawType;
  }
  const res = await logEvent({
    type: domain,
    source: String(row.source ?? "").trim() || "unknown",
    payload,
    page_id: row.page_id,
    company_id: row.company_id,
    source_rid: row.source_rid,
  });
  if (res.ok === false) return res;
  return { ok: true, id: res.event.id };
}

/** @deprecated Prefer {@link getEvents}. */
export type ListIntelligenceEventsOpts = GetEventsFilter;

/** @deprecated Prefer {@link getEvents}. */
export async function listIntelligenceEvents(opts?: ListIntelligenceEventsOpts): Promise<IntelligenceEvent[]> {
  return getEvents(opts);
}
