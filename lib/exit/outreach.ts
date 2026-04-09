import "server-only";

import { runAI } from "@/lib/ai/run";

/**
 * Draft buyer / investor outreach — human review required before send.
 */
export async function contactBuyers(): Promise<string> {
  return runAI(
    "Write a short professional investor outreach email draft in Norwegian. No specific price commitments.",
    "growth",
  );
}
