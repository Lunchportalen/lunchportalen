import "server-only";

import { opsLog } from "@/lib/ops/log";
import { publishLivePost } from "@/lib/social/liveChannelPublish";

export function generateLunchPost(): {
  text: string;
  cta: string;
  target: "B2B";
} {
  return {
    text: `Lei av kantinekaos?

Med Lunchportalen får dere:

✔ Ferdig levert lunsj  
✔ Ingen administrasjon  
✔ Forutsigbare kostnader  

Se hvordan det fungerer →`,
    cta: "Book demo",
    target: "B2B",
  };
}

function lunchPostEnabled(): boolean {
  return String(process.env.LP_LUNCH_AUTOPOST_ENABLED ?? "").trim() === "true";
}

function lunchContentApproved(): boolean {
  return String(process.env.LP_LUNCH_CONTENT_APPROVED ?? "").trim() === "true";
}

/**
 * Krever eksplisitt `LP_LUNCH_CONTENT_APPROVED=true` (menneskelig gate) + `LP_LUNCH_AUTOPOST_ENABLED=true`.
 * Kill-switch: `LP_SCALE_KILL_SWITCH=true`.
 */
export async function runLunchPosting(): Promise<{ status: "posted" | "blocked" | "idle"; reason?: string }> {
  if (String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true") {
    opsLog("lunch_posting_blocked", { reason: "LP_SCALE_KILL_SWITCH" });
    return { status: "blocked", reason: "kill_switch" };
  }
  if (!lunchPostEnabled()) {
    return { status: "idle", reason: "LP_LUNCH_AUTOPOST_ENABLED_not_true" };
  }
  if (!lunchContentApproved()) {
    opsLog("lunch_posting_blocked", { reason: "content_not_approved" });
    return { status: "blocked", reason: "content_not_approved" };
  }

  const post = generateLunchPost();
  await publishLivePost({ channel: "facebook", content: post });
  await publishLivePost({ channel: "instagram", content: post });
  opsLog("lunch_posting_dry_run", { channels: ["facebook", "instagram"] });
  return { status: "posted" };
}
