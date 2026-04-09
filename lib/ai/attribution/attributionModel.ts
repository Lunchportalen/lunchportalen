function safeMetric(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type AttributionRecord = {
  actionType: string;
  source: string;
  entityId?: string;
  timestamp: number;
  metrics: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
  };
};

export type BuildAttributionRecordInput = {
  actionType: string;
  source?: string;
  entityId?: string | null;
  metrics?: Partial<AttributionRecord["metrics"]>;
};

export function buildAttributionRecord(input: BuildAttributionRecordInput): AttributionRecord {
  const actionType = String(input.actionType ?? "").trim() || "unknown";
  const source = String(input.source ?? "unknown").trim() || "unknown";
  const entityRaw = input.entityId;
  const entityId =
    entityRaw != null && String(entityRaw).trim() !== "" ? String(entityRaw).trim() : undefined;

  const record: AttributionRecord = {
    actionType,
    source,
    timestamp: Date.now(),
    metrics: {
      impressions: safeMetric(input.metrics?.impressions ?? 0),
      clicks: safeMetric(input.metrics?.clicks ?? 0),
      conversions: safeMetric(input.metrics?.conversions ?? 0),
      revenue: safeMetric(input.metrics?.revenue ?? 0),
    },
  };
  if (entityId) record.entityId = entityId;
  return record;
}
