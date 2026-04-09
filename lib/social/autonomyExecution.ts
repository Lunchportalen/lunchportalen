import "server-only";

import { triggerAdCampaign } from "@/lib/integrations/ads";
import { autonomyConfig } from "@/lib/social/autonomyConfig";
import { logAutonomy } from "@/lib/social/autonomyLog";

export type AutonomyPlannedAction = {
  type: "scale";
  postId: string;
};

/**
 * Utførelse: i dag kun logg/spor — ingen auto-publisering med mindre eksplisitt aktivert.
 */
export async function executeAutonomyActions(actions: AutonomyPlannedAction[]): Promise<void> {
  for (const action of actions) {
    if (action.type === "scale") {
      console.log("Scaling post", action.postId);
      logAutonomy({
        phase: "execute",
        kind: "scale",
        postId: action.postId,
        allowAutoPublish: autonomyConfig.allowAutoPublish,
      });
      if (!autonomyConfig.allowAutoPublish) {
        logAutonomy({
          phase: "execute_skipped",
          kind: "scale",
          postId: action.postId,
          reason: "allowAutoPublish_false",
        });
      } else {
        logAutonomy({
          phase: "execute_blocked",
          kind: "scale",
          postId: action.postId,
          note: "auto_publish_not_wired_fail_safe",
        });
      }

      void (async () => {
        try {
          const r = await triggerAdCampaign({ postId: action.postId });
          logAutonomy({
            phase: "integration_ads",
            postId: action.postId,
            ok: r.ok,
            ...(r.ok === false ? { reason: r.reason } : {}),
          });
        } catch {
          logAutonomy({ phase: "integration_ads_error", postId: action.postId });
        }
      })();
    }
  }
}
