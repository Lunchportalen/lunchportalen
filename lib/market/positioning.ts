import "server-only";

import { runAI } from "@/lib/ai/run";

export async function generatePositioning(): Promise<string> {
  const input = `
Definer en sterk SaaS-kategori posisjon for enterprise lunch-operasjoner.

Fokus:
- differensiering
- verdi
- markedsposisjon

Svar på norsk, rolig og presist.
`.trim();

  return runAI(input, "growth");
}
