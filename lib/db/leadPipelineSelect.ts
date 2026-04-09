/**
 * Bounded column list for `lead_pipeline` list scans (no full-row wide fetches).
 * Keep in sync with consumers: sequence engine, pipeline prioritization, deal cards.
 */
export const LEAD_PIPELINE_LIST_COLUMNS =
  "id, created_at, source_post_id, status, value_estimate, meta, contact_email" as const;
