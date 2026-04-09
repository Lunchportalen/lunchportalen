import "server-only";

import { runAI } from "@/lib/ai/run";

export async function generateOutboundMessage(input: { company: string; pain: string }) {
  const company = String(input.company ?? "").trim().slice(0, 200);
  const pain = String(input.pain ?? "").trim().slice(0, 800);

  const prompt = `
Write a short B2B outreach message (Norwegian or English — match the pain language if obvious).

Company: ${company}
Pain: ${pain}

Tone: direct, professional, value-driven. Max ~120 words. No placeholders like [name].
`.trim();

  return runAI(prompt, "growth");
}
