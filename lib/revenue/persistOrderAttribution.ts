/**
 * Kalles kun fra server API-ruter (service role). Ikke importer i klientkomponenter.
 */
import { logSocialAiActivity } from "@/lib/social/aiActivitySocial";
import { trackPostEvent } from "@/lib/social/track";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OrderAttributionRecord } from "@/lib/revenue/types";
import { AI_SOCIAL_ATTRIBUTION_SOURCE } from "@/lib/revenue/types";
import { opsLog } from "@/lib/ops/log";

/**
 * Best-effort persist after lp_order_set — never blocks order success path.
 */
export async function persistOrderAttribution(orderId: string, attribution: OrderAttributionRecord | null, rid: string): Promise<void> {
  if (!orderId || !attribution?.postId || attribution.source !== AI_SOCIAL_ATTRIBUTION_SOURCE) {
    return;
  }

  try {
    const admin = supabaseAdmin();
    const postId = attribution.postId;
    const { error } = await admin.from("orders").update({ attribution, social_post_id: postId }).eq("id", orderId);
    if (error) {
      opsLog("order_attribution_persist_failed", {
        rid,
        orderId,
        message: error.message,
      });
    } else {
      console.log("[ORDER_CREATED]", { orderId, postId });
      console.log("[ORDER_ATTRIBUTION]", { orderId, postId, social_post_id: postId });
      opsLog("order_attribution_persisted", {
        rid,
        orderId,
        postId,
      });
      void trackPostEvent({ postId, type: "conversions" });
      void logSocialAiActivity({
        action: "conversion",
        rid,
        metadata: { postId, orderId },
      });
    }
  } catch (e) {
    opsLog("order_attribution_persist_exception", {
      rid,
      orderId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
