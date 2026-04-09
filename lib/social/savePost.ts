import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildStandardSocialContentV1 } from "@/lib/social/socialPostContent";
import type { UnifiedSocialResult } from "@/lib/social/unifiedSocialTypes";

export type SaveSocialPostResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

/**
 * Persister utkast i `social_posts` med standardisert content v1.
 */
export async function saveUnifiedSocialPost(
  result: UnifiedSocialResult,
  opts?: { productId?: string },
): Promise<SaveSocialPostResult> {
  const id = result.calendarPostId.trim();
  if (!id) {
    return { ok: false, reason: "missing_id" };
  }

  try {
    const admin = supabaseAdmin();
    const tableOk = await verifyTable(admin, "social_posts", "unified_save");
    if (!tableOk) {
      return { ok: false, reason: "table_unavailable" };
    }

    const content = buildStandardSocialContentV1({
      text: result.text,
      hashtags: result.hashtags,
      images: result.images,
      source: result.source,
      platform: result.platform,
      data: {
        calendarPostId: result.calendarPostId,
        revenueTrackingPath: result.revenueTrackingPath ?? null,
        link: result.link ?? null,
        productId: opts?.productId,
      },
    });

    const now = new Date().toISOString();
    const row = {
      id,
      content: content as unknown as Record<string, unknown>,
      /** Kalender-/pipeline-flyt: «planlagt» utkast (ikke publisert). */
      status: "planned",
      platform: result.platform,
      updated_at: now,
    } as Record<string, unknown>;

    console.log("[SAVE_POST]", {
      id,
      status: "planned",
      platform: result.platform,
      source: result.source,
      calendarPostId: result.calendarPostId,
    });

    const { error } = await admin.from("social_posts").upsert(row, { onConflict: "id" });

    if (error) {
      console.error("[SAVE_SOCIAL_POST]", error.message);
      return { ok: false, reason: error.message };
    }

    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}

/** Alias — samme som `saveUnifiedSocialPost` (server-only, service role). */
export const savePost = saveUnifiedSocialPost;
