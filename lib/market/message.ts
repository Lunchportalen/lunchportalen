import "server-only";

import { runAI } from "@/lib/ai/run";

export async function generateMessaging(): Promise<string> {
  return runAI("Skriv kort, høykonverterende kategori-messaging (norsk, rolig tone).", "growth");
}
