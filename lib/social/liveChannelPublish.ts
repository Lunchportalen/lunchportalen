import "server-only";

import { recordLiveSocialPost } from "@/lib/live/campaignStats";
import { publishFacebook } from "@/lib/social/facebook";
import { publishInstagram } from "@/lib/social/instagram";
import { publishTikTok } from "@/lib/social/tiktok";

export type LiveSocialChannel = "facebook" | "instagram" | "tiktok";

/**
 * Enhetlig inngang — ekte API-kall kun etter godkjenning + nøkler (se hver kanal).
 */
export async function publishLivePost(input: { channel: LiveSocialChannel; content: unknown }) {
  const { channel, content } = input;
  recordLiveSocialPost(1);
  if (channel === "facebook") return publishFacebook(content);
  if (channel === "instagram") return publishInstagram(content);
  if (channel === "tiktok") return publishTikTok(content);
  return null;
}
