import "server-only";

import { opsLog } from "@/lib/ops/log";

export async function publishInstagram(content: unknown): Promise<{
  channel: "instagram";
  status: "dry_run" | "posted";
  content: unknown;
}> {
  opsLog("social_instagram_publish", { mode: "stub", note: "Koble Instagram Graph API før ekte post." });
  return { channel: "instagram", status: "dry_run", content };
}
