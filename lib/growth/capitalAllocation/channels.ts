import type { CapitalChannelId } from "@/lib/growth/capitalAllocation/types";
import { normalizeChannelKey } from "@/lib/growth/channels";

/**
 * Maps SoMe platform → canonical capital channel (4-way split: linkedin, facebook, email, retargeting).
 * Deterministic; no network.
 */
export function mapPlatformToCapitalChannel(platform: string | null | undefined): CapitalChannelId {
  const p = normalizeChannelKey(platform);
  switch (p) {
    case "linkedin":
      return "linkedin";
    case "facebook":
      return "facebook";
    case "instagram":
      return "facebook";
    case "tiktok":
      return "retargeting";
    default:
      return "email";
  }
}
