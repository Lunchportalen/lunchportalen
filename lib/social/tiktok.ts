import "server-only";

import { opsLog } from "@/lib/ops/log";

export async function publishTikTok(content: unknown): Promise<{
  channel: "tiktok";
  status: "dry_run" | "posted";
  content: unknown;
}> {
  opsLog("social_tiktok_publish", { mode: "stub", note: "Koble TikTok for Business API før ekte post." });
  return { channel: "tiktok", status: "dry_run", content };
}
