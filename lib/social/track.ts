import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StandardSocialContentV1 } from "@/lib/social/socialPostContent";

export type PostMetricType = "views" | "clicks" | "conversions";

/**
 * Oppdaterer `content.metrics` på `social_posts` (best-effekt, fail-closed).
 */
export async function trackPostEvent(opts: { postId: string; type: PostMetricType }): Promise<{ ok: boolean }> {
  const postId = String(opts.postId ?? "").trim();
  if (!postId) return { ok: false };

  try {
    const admin = supabaseAdmin();
    const tableOk = await verifyTable(admin, "social_posts", "track_post");
    if (!tableOk) return { ok: false };

    const { data, error } = await admin.from("social_posts").select("content").eq("id", postId).maybeSingle();
    if (error || !data || typeof data !== "object") {
      return { ok: false };
    }

    const raw = (data as { content?: unknown }).content;
    const base =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    let content: StandardSocialContentV1;
    if (base.v === 1 && typeof base.metrics === "object" && base.metrics !== null) {
      content = base as unknown as StandardSocialContentV1;
    } else {
      content = {
        v: 1,
        text: typeof base.text === "string" ? base.text : "",
        hashtags: [],
        images: [],
        source: "deterministic",
        platform: "linkedin",
        metrics: { views: 0, clicks: 0, conversions: 0 },
        data: {},
      };
    }

    const prev = content.metrics[opts.type] ?? 0;
    const nextMetrics = {
      ...content.metrics,
      [opts.type]: (typeof prev === "number" && Number.isFinite(prev) ? prev : 0) + 1,
    };
    const nextContent: StandardSocialContentV1 = { ...content, metrics: nextMetrics };

    const { error: upErr } = await admin
      .from("social_posts")
      .update({
        content: nextContent as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", postId);

    if (upErr) {
      console.error("[TRACK_POST]", upErr.message);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
