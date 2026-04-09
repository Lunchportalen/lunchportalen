import type { AttributionRecord } from "./attributionModel";

export type AttributionAggregateRow = {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type AttributionAggregated = Record<string, AttributionAggregateRow>;

/** Normalizes ai_memory rows or flat {@link AttributionRecord} shapes. */
export function normalizeAttributionRow(row: unknown): AttributionRecord | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const payload = o.payload && typeof o.payload === "object" ? (o.payload as Record<string, unknown>) : o;
  const actionType = typeof payload.actionType === "string" ? payload.actionType.trim() : "";
  if (!actionType) return null;
  const metrics = payload.metrics && typeof payload.metrics === "object" ? (payload.metrics as Record<string, unknown>) : {};
  const num = (k: string) => {
    const v = Number(metrics[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  const source = typeof payload.source === "string" ? payload.source : "unknown";
  const entityId =
    payload.entityId != null && String(payload.entityId).trim() !== ""
      ? String(payload.entityId).trim()
      : undefined;
  const ts = Number(payload.timestamp);
  const out: AttributionRecord = {
    actionType,
    source,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    metrics: {
      impressions: num("impressions"),
      clicks: num("clicks"),
      conversions: num("conversions"),
      revenue: num("revenue"),
    },
  };
  if (entityId) out.entityId = entityId;
  return out;
}

export function aggregateAttribution(records: unknown[]): AttributionAggregated {
  const result: AttributionAggregated = {};
  for (const raw of records) {
    const r = normalizeAttributionRow(raw);
    if (!r) continue;
    const key = r.actionType;
    if (!result[key]) {
      result[key] = { impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    }
    const m = r.metrics ?? {};
    result[key].impressions += Number(m.impressions ?? 0) || 0;
    result[key].clicks += Number(m.clicks ?? 0) || 0;
    result[key].conversions += Number(m.conversions ?? 0) || 0;
    result[key].revenue += Number(m.revenue ?? 0) || 0;
  }
  return result;
}
