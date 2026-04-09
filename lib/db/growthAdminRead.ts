import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { LEAD_PIPELINE_LIST_COLUMNS } from "@/lib/db/leadPipelineSelect";
import { isMissingRelationError, verifyTable } from "@/lib/db/verifyTable";
import type { Database } from "@/lib/types/database";
import { mapSocialPostsAsEventSubstitutes } from "@/lib/social/analyticsAggregate";

type AdminClient = SupabaseClient<Database>;

const MAX_SOCIAL_POSTS_ANALYTICS = 5000;

/** Leser `lead_pipeline` når tabellen finnes og er tilgjengelig; ellers tom liste (CEO-snapshot fortsetter med SoMe). */
export type LeadPipelineReadResult = {
  ok: true;
  rows: Record<string, unknown>[];
  leadPipelineAvailable: boolean;
};

export async function fetchLeadPipelineRows(admin: AdminClient, route: string): Promise<LeadPipelineReadResult> {
  try {
    const exists = await verifyTable(admin, "lead_pipeline", route);
    if (!exists) {
      return { ok: true, rows: [], leadPipelineAvailable: false };
    }

    const { data, error } = await admin
      .from("lead_pipeline")
      .select(LEAD_PIPELINE_LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[PIPELINE_QUERY_ERROR]", {
        message: error.message,
        code: error.code,
      });
      return { ok: true, rows: [], leadPipelineAvailable: false };
    }

    return {
      ok: true,
      rows: (data ?? []) as Record<string, unknown>[],
      leadPipelineAvailable: true,
    };
  } catch (err) {
    console.error("[PIPELINE_FATAL]", err);
    return { ok: true, rows: [], leadPipelineAvailable: false };
  }
}

/** Ingen `social_events`-tabell: lead-telling er ikke separat i DB (bekreftet schema har kun `social_posts.content` jsonb). */
export async function countSocialLeadEvents(admin: AdminClient, route: string): Promise<number | null> {
  try {
    const ok = await verifyTable(admin, "social_posts", route);
    if (!ok) return null;
    return 0;
  } catch {
    return null;
  }
}

export type SocialPostsEventsRead =
  | {
      ok: true;
      posts: unknown[];
      events: unknown[];
      socialPostsAvailable: boolean;
      socialEventsAvailable: boolean;
      socialEventsSubstitutedFromPosts: boolean;
    }
  | { ok: false; error: string; code: string };

/**
 * Kun `social_posts` (bekreftet schema). «Events» er avledet fra poster med feltmapping:
 * timestamp → created_at, data → content, metrics → metrics (i content-json).
 */
export async function fetchSocialPostsAndEvents(admin: AdminClient, route: string): Promise<SocialPostsEventsRead> {
  try {
    const postsExist = await verifyTable(admin, "social_posts", route);
    if (!postsExist) {
      return {
        ok: true,
        posts: [],
        events: [],
        socialPostsAvailable: false,
        socialEventsAvailable: false,
        socialEventsSubstitutedFromPosts: true,
      };
    }

    const { data: posts, error: postsErr } = await admin
      .from("social_posts")
      .select("id, status, content, variant_group_id, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_SOCIAL_POSTS_ANALYTICS);
    if (postsErr) {
      if (isMissingRelationError(postsErr)) {
        return {
          ok: true,
          posts: [],
          events: [],
          socialPostsAvailable: false,
          socialEventsAvailable: false,
          socialEventsSubstitutedFromPosts: true,
        };
      }
      return { ok: false, error: postsErr.message, code: "SOCIAL_POSTS_FAILED" };
    }

    const postRows = posts ?? [];
    return {
      ok: true,
      posts: postRows,
      events: mapSocialPostsAsEventSubstitutes(postRows) as unknown[],
      socialPostsAvailable: true,
      socialEventsAvailable: false,
      socialEventsSubstitutedFromPosts: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: "SOCIAL_FETCH_FAILED" };
  }
}
