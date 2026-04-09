import "server-only";

import type { AIConfigRow } from "@/lib/ai/config";
import { getAIConfig } from "@/lib/ai/config";
import { readPromptRegistry } from "@/lib/ai/prompts";

const REQUIRED_KEYS = ["editor", "seo", "growth"] as const;

export function assertPromptRegistry(config: AIConfigRow): void {
  const f = config.features;
  if (!f || typeof f !== "object" || Array.isArray(f)) {
    throw {
      code: "AI_PROMPT_REGISTRY_MISSING",
      message: "prompt_registry missing",
      source: "ai",
      severity: "high" as const,
    };
  }

  const raw = (f as Record<string, unknown>).prompt_registry;
  if (raw === undefined || raw === null) {
    throw {
      code: "AI_PROMPT_REGISTRY_MISSING",
      message: "prompt_registry missing",
      source: "ai",
      severity: "high" as const,
    };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw {
      code: "AI_PROMPT_REGISTRY_MISSING",
      message: "prompt_registry invalid",
      source: "ai",
      severity: "high" as const,
    };
  }

  const registry = readPromptRegistry(config);
  for (const key of REQUIRED_KEYS) {
    const v = registry[key];
    if (typeof v !== "string" || !v.trim()) {
      throw {
        code: "AI_PROMPT_KEY_MISSING",
        message: `Missing ${key}`,
        source: "ai",
        severity: "high" as const,
      };
    }
  }
}

/**
 * Loads config and verifies `features.prompt_registry` has required keys (editor, seo, growth).
 * Returns validated config for a single fetch in {@link runAI}.
 */
export async function validatePromptRegistry(): Promise<AIConfigRow> {
  const config = await getAIConfig();
  assertPromptRegistry(config);
  return config;
}
