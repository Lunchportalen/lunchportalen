import "server-only";

import OpenAI from "openai";

export function getAIClient() {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw {
      code: "AI_NO_API_KEY",
      message: "Missing OPENAI_API_KEY",
      source: "ai",
      severity: "high" as const,
    };
  }

  return new OpenAI({ apiKey: key });
}
