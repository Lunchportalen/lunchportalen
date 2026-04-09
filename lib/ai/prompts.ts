import "server-only";

import type { AIConfigRow } from "@/lib/ai/config";
import { getAIConfig } from "@/lib/ai/config";

export type PromptKey = "editor" | "seo" | "growth" | "product" | "support";

export function readPromptRegistry(config: AIConfigRow): Record<string, string> {
  const f = config.features;
  if (!f || typeof f !== "object" || Array.isArray(f)) return {};
  const pr = (f as Record<string, unknown>).prompt_registry;
  if (!pr || typeof pr !== "object" || Array.isArray(pr)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(pr)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function getPromptFromRegistry(config: AIConfigRow, key: PromptKey): string {
  const registry = readPromptRegistry(config);
  const prompt = registry[key];

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw {
      code: "AI_PROMPT_MISSING",
      message: `Missing prompt for ${key}`,
      source: "ai_prompt_registry",
      severity: "high" as const,
    };
  }

  return prompt.trim();
}

export async function getPrompt(key: PromptKey): Promise<string> {
  const config = await getAIConfig();
  return getPromptFromRegistry(config, key);
}
