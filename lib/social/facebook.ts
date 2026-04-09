import "server-only";

import { opsLog } from "@/lib/ops/log";

export async function publishFacebook(content: unknown): Promise<{
  channel: "facebook";
  status: "dry_run" | "posted";
  content: unknown;
}> {
  opsLog("social_facebook_publish", { mode: "stub", note: "Koble Meta Graph API før ekte post." });
  return { channel: "facebook", status: "dry_run", content };
}
