import "server-only";

import { createMetaAd } from "@/lib/ads/meta";
import { createTikTokAd } from "@/lib/ads/tiktok";
import { opsLog } from "@/lib/ops/log";
import { publishLivePost } from "@/lib/social/liveChannelPublish";

function amplifyBlocked(): boolean {
  return (
    String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true" ||
    String(process.env.LP_DOMINATION_KILL_SWITCH ?? "").trim() === "true"
  );
}

/**
 * Krysskanal — mock-annonser + kanalpublisering bak kill-switch og budsjetttak (se Meta/TikTok-moduler).
 */
export async function amplify(content: unknown): Promise<{ status: "ok" | "blocked" }> {
  if (amplifyBlocked()) {
    opsLog("amplify_blocked", { reason: "kill_switch" });
    return { status: "blocked" };
  }

  await publishLivePost({ channel: "facebook", content });
  await publishLivePost({ channel: "instagram", content });

  await createMetaAd({ content, budget: 300 });
  await createTikTokAd({ content, budget: 200 });

  opsLog("amplify_tick", { channels: ["facebook", "instagram", "meta_ad", "tiktok_ad"] });
  return { status: "ok" };
}
