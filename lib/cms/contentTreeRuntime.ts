export type ContentTreeDegradedReason =
  | "PAGE_KEY_COLUMN_MISSING"
  | "TREE_COLUMNS_MISSING"
  | "TABLE_OR_CONTENT_PAGES_UNAVAILABLE"
  | "SCHEMA_OR_CACHE_UNAVAILABLE"
  | "BACKEND_UNREACHABLE"
  | "LOCAL_DEV_CONTENT_RESERVE";

export function contentTreeMutationsLocked(params: {
  degraded: boolean;
  reason?: string | null;
}): boolean {
  if (!params.degraded) return false;
  return params.reason !== "PAGE_KEY_COLUMN_MISSING";
}
