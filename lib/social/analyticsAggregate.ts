/**
 * Deterministisk aggregering fra `social_posts` (ingen separat event-tabell i bekreftet schema).
 * Avledede «events» bygges med `mapSocialPostsAsEventSubstitutes`.
 */

export type SocialDbAnalyticsRow = {
  id: string;
  status: string;
  clicks: number;
  leads: number;
  score: number;
};

type PostRow = { id: string; status?: unknown };
type EventRow = { post_id?: string | null; type?: string | null };

/** Normaliserer Supabase-rader til typer med garantert `id` (kolonner velges eksplisitt i DB-lag). */
export type SocialPostRowInput = {
  id: string;
  status?: unknown;
  content?: unknown;
  variant_group_id?: string | null;
};

export type SocialEventRowInput = EventRow & {
  /** Fra post.created_at (evt. tidligere «timestamp» på event-konsept). */
  created_at?: unknown;
  /** Speiler post.content («data» mappet inn i content-kolonnen). */
  data?: unknown;
  /** Speiler `content.metrics` der satt. */
  metrics?: unknown;
};

export function mapSocialPostsFromDb(posts: unknown[] | null | undefined): SocialPostRowInput[] {
  return (posts ?? []).map((p) => {
    const r = p as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      status: r.status,
      content: r.content,
      variant_group_id: r.variant_group_id as string | null | undefined,
    };
  });
}

export function mapSocialEventsFromDb(events: unknown[] | null | undefined): SocialEventRowInput[] {
  return (events ?? []).map((e) => {
    const r = e as Record<string, unknown>;
    return {
      post_id: r.post_id as string | null | undefined,
      type: r.type as string | null | undefined,
    };
  });
}

/**
 * Én avledet rad per `social_posts`-post: timestamp→created_at, data→content, metrics→metrics (fra content-json).
 */
export function mapSocialPostsAsEventSubstitutes(posts: unknown[] | null | undefined): SocialEventRowInput[] {
  return (posts ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    const content = r.content;
    let metrics: unknown;
    if (content != null && typeof content === "object" && !Array.isArray(content) && "metrics" in content) {
      metrics = (content as Record<string, unknown>).metrics;
    }
    return {
      post_id: id,
      type: "post",
      created_at: r.created_at,
      data: content,
      metrics,
    };
  });
}

export function aggregateSocialAnalytics(
  posts: PostRow[] | null | undefined,
  events: EventRow[] | null | undefined,
): SocialDbAnalyticsRow[] {
  const pl = Array.isArray(posts) ? posts : [];
  const el = Array.isArray(events) ? events : [];
  const sorted = [...pl].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  return sorted.map((p) => {
    const id = String(p.id ?? "");
    const related = el.filter((e) => String(e.post_id ?? "") === id);
    const clicks = related.filter((e) => String(e.type ?? "") === "click").length;
    const leads = related.filter((e) => String(e.type ?? "") === "lead").length;
    const status = typeof p.status === "string" ? p.status : String(p.status ?? "");
    return {
      id,
      status,
      clicks,
      leads,
      score: leads * 10 + clicks,
    };
  });
}
