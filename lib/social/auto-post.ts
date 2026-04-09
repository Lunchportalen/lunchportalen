import "server-only";

import { getApprovedSocialContent } from "@/lib/approval/queue";
import { opsLog } from "@/lib/ops/log";
import { publishLivePost } from "@/lib/social/liveChannelPublish";

function scaleKillSwitch(): boolean {
  return String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true";
}

function autoSocialEnabled(): boolean {
  return String(process.env.LP_SCALE_AUTO_SOCIAL ?? "").trim() === "true";
}

export async function getApprovedContent() {
  return getApprovedSocialContent();
}

function logSocialPost(item: unknown): void {
  opsLog("scale_auto_social_post", { item_preview: JSON.stringify(item).slice(0, 500) });
}

/**
 * Publiserer kun **godkjent** innhold (approval-kø). Kill-switch: `LP_SCALE_KILL_SWITCH=true`.
 * Aktivering: `LP_SCALE_AUTO_SOCIAL=true`.
 */
export async function runAutoSocial(): Promise<{ status: "idle" | "posted" | "blocked"; count: number }> {
  if (scaleKillSwitch()) {
    opsLog("scale_auto_social_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return { status: "blocked", count: 0 };
  }
  if (!autoSocialEnabled()) {
    return { status: "idle", count: 0 };
  }

  const approved = await getApprovedContent();
  const slice = approved.slice(0, 3);
  let count = 0;

  for (const item of slice) {
    const content = item.payload;
    await publishLivePost({ channel: "facebook", content });
    await publishLivePost({ channel: "instagram", content });
    logSocialPost(content);
    count += 1;
  }

  return { status: slice.length ? "posted" : "idle", count };
}
