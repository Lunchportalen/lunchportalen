/**
 * Atferdsprofil fra logger (deterministisk telling — ingen ML-ruting).
 */
export type ActivityLogLike = {
  action?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type UserBehavior = {
  clicks: number;
  views: number;
  conversions: number;
  engagementScore: number;
};

function metaUserId(m: Record<string, unknown> | null | undefined): string | null {
  if (!m || typeof m !== "object") return null;
  const a = m.userId ?? m.user_id;
  if (typeof a === "string" && a.trim()) return a.trim();
  return null;
}

/**
 * Filtrerer logger der `metadata.userId` / `metadata.user_id` matcher `userId`.
 */
export function buildBehavior(userId: string, logs: ActivityLogLike[]): UserBehavior {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const userLogs = uid
    ? logs.filter((l) => {
        const m = l.metadata;
        if (!m || typeof m !== "object" || Array.isArray(m)) return false;
        return metaUserId(m as Record<string, unknown>) === uid;
      })
    : [];

  const clicks = userLogs.filter((l) => l.action === "social_click").length;
  const views = userLogs.filter((l) => l.action === "page_view").length;
  const conversions = userLogs.filter((l) => l.action === "conversion").length;

  return {
    clicks,
    views,
    conversions,
    engagementScore: clicks * 2 + views,
  };
}
