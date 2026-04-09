/**
 * Trygg utførelse av autonome beslutninger (ingen eksterne API-kall).
 */

import "server-only";

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { parseCalendar, rollingDayKeys, serializeCalendar } from "@/lib/social/calendar";
import { learnFromCalendarPosts } from "@/lib/social/calendarLearning";
import type { Decision } from "@/lib/social/decisionEngine";
import { generatePost } from "@/lib/social/generator";
import { engagementTierFromPosts } from "@/lib/social/learning";
import { runSchedulerWithLearning } from "@/lib/social/scheduler";
import type { Location } from "@/lib/social/location";

export type AutonomousExecutionContext = {
  postsJson: string;
  products: SocialProductRef[];
  location: Location;
};

export type ExecutionResult = {
  ok: boolean;
  postsJson?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function executeDecision(decision: Decision, ctx: AutonomousExecutionContext): Promise<ExecutionResult> {
  switch (decision.type) {
    case "publish":
      return { ok: false, error: "publish_policy_lock" };

    case "generate_post":
    case "generate": {
      const productId = String(decision.data.productId ?? "").trim();
      const product =
        ctx.products.find((p) => p.id === productId) ?? ctx.products[0] ?? null;
      if (!product) {
        return { ok: false, error: "no_product" };
      }
      const slotDayRaw = String(decision.data.slotDay ?? "").trim();
      const slotDay = slotDayRaw || rollingDayKeys()[0] || "";
      if (!slotDay) {
        return { ok: false, error: "no_slot_day" };
      }
      const posts = parseCalendar(ctx.postsJson);
      let tier = engagementTierFromPosts(posts);
      if (decision.data.reinforcementKind === "replicate_winner") {
        tier = "high";
      }
      const basedOn = String(decision.data.basedOn ?? "").trim();
      const calendarPost =
        (basedOn ? posts.find((x) => x.id === basedOn) : null) ??
        posts.find((x) => x.productId === product.id && x.slotDay === slotDay && x.status !== "cancelled") ??
        posts.find((x) => x.productId === product.id && x.status !== "cancelled") ??
        null;
      const calendarPostIdForGen = basedOn || calendarPost?.id;
      const draft = await generatePost(product, {
        slotDay,
        location: ctx.location,
        learningEngagementTier: tier,
        calendarPostId: calendarPostIdForGen,
      });
      return {
        ok: true,
        metadata: {
          productId: product.id,
          hookSnippet: draft.hook.slice(0, 160),
          mediaItemId: draft.media.mediaItemId,
          mediaSource: draft.media.source ?? null,
          textLen: draft.text.length,
          revenueTrackingPath: draft.revenueTrackingPath ?? null,
          basedOn: basedOn || null,
        },
      };
    }

    case "deprioritize": {
      const postId = String(decision.data.postId ?? "").trim();
      if (!postId) {
        return { ok: false, error: "missing_postId" };
      }
      const posts = parseCalendar(ctx.postsJson);
      if (!posts.some((p) => p.id === postId)) {
        return { ok: false, error: "post_not_found" };
      }
      const next = posts.map((p) =>
        p.id === postId
          ? { ...p, autonomyPriority: false as const, reinforcementDeprioritized: true as const }
          : p,
      );
      return {
        ok: true,
        postsJson: serializeCalendar(next),
        metadata: { deprioritizedPostId: postId },
      };
    }

    case "schedule_post":
    case "schedule":
    case "adjust_timing": {
      const revertSnapshot = ctx.postsJson;
      const posts = parseCalendar(ctx.postsJson);
      const insights = learnFromCalendarPosts(posts);
      const { posts: out } = runSchedulerWithLearning(posts, Date.now(), insights);
      decision.data = { ...decision.data, revertSnapshot };
      return {
        ok: true,
        postsJson: serializeCalendar(out),
        metadata: { scheduled: out.length, revertSnapshotLen: revertSnapshot.length },
      };
    }

    case "promote_product":
    case "promote":
    case "boost_existing": {
      const postId = String(decision.data.postId ?? "").trim();
      if (!postId) {
        return { ok: false, error: "missing_postId" };
      }
      const posts = parseCalendar(ctx.postsJson);
      const exists = posts.some((p) => p.id === postId && p.status === "planned");
      if (!exists) {
        return { ok: false, error: "post_not_planned" };
      }
      const next = posts.map((p) =>
        p.id === postId && p.status === "planned" ? { ...p, autonomyPriority: true as const } : p,
      );
      return {
        ok: true,
        postsJson: serializeCalendar(next),
        metadata: { promotedPostId: postId, variant: decision.type },
      };
    }

    default:
      return { ok: false, error: "unknown_decision_type" };
  }
}
