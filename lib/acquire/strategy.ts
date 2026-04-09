import "server-only";

import { runAI } from "@/lib/ai/run";

/**
 * AI-utkast for M&A-strategi — må valideres manuelt; ikke juridisk eller finansiell rådgivning.
 */
export async function generateStrategy(): Promise<string> {
  return runAI(
    "Generer en kort M&A-strategi for SaaS-vekst og mulig exit (norsk, rolig tone, uten konkrete kjøp).",
    "growth",
  );
}
