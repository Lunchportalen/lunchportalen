import "server-only";

import { runAI } from "@/lib/ai/run";

/**
 * AI-utkast for kategori — må godkjennes før bruk; ingen auto-publisering.
 */
export async function generateDominationPlan(): Promise<string> {
  return runAI(
    "Lag en kort plan for markedsposisjon og kategoriledelse innen enterprise lunch-operasjoner (norsk, rolig tone).",
    "growth",
  );
}
