import "server-only";

import { enforceAIPolicy } from "@/lib/ai/governor";
import { getAIClient } from "@/lib/ai/getClient";
import { getPromptFromRegistry, type PromptKey } from "@/lib/ai/prompts";
import { trace } from "@/lib/core/trace";
import { trackAIEvent } from "@/lib/ai/tracking";
import { validatePromptRegistry } from "@/lib/ai/validate";
import { getCachedSettings } from "@/lib/settings/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type { PromptKey } from "@/lib/ai/prompts";

/**
 * OpenAI chat completion: DB model params + per-feature system prompt from `ai_config.features.prompt_registry`.
 * Fails closed if registry, keys, model, or response body is invalid.
 */
export async function runAI(input: string, key: PromptKey) {
  void trackAIEvent({ type: "ai_run", key, input });

  try {
    const sb = await supabaseServer();
    const settings = await getCachedSettings(sb);
    enforceAIPolicy(settings, { type: key });
    trace("AI_RUN", { key });

    const config = await validatePromptRegistry();
    const client = getAIClient();
    const systemPrompt = getPromptFromRegistry(config, key);

    const model = typeof config.model === "string" ? config.model.trim() : "";
    if (!model) {
      throw {
        code: "AI_CONFIG_INVALID_MODEL",
        message: "ai_config.model is missing or empty",
        source: "ai_config",
        severity: "high" as const,
      };
    }

    const temperature = typeof config.temperature === "number" && Number.isFinite(config.temperature) ? config.temperature : 0.3;
    const max_tokens =
      typeof config.max_tokens === "number" && Number.isFinite(config.max_tokens) && config.max_tokens > 0
        ? Math.floor(config.max_tokens)
        : 2000;

    const res = await client.chat.completions.create({
      model,
      temperature,
      max_tokens,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
    });

    const output = res.choices?.[0]?.message?.content;

    if (typeof output !== "string" || !output.trim()) {
      throw {
        code: "AI_EMPTY_RESPONSE",
        message: "No output",
        source: "ai",
        severity: "high" as const,
      };
    }

    void trackAIEvent({ type: "ai_result", key, input, output });

    return output;
  } catch (e) {
    void trackAIEvent({
      type: "ai_error",
      key,
      metadata: {
        message: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
  }
}
