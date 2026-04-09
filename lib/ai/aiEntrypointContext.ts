import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { recordAiBypassWarn } from "@/lib/system/controlPlaneMetrics";
import { isStrictAi } from "@/lib/system/controlStrict";

/** Metadata for the active AI control flow (API route or explicit lib caller). */
export type AiDecisionEntryMeta = {
  surface: string;
  operation: string;
};

const aiDecisionEntryStorage = new AsyncLocalStorage<AiDecisionEntryMeta>();

/**
 * True while request-scoped AI work runs inside {@link withAiDecisionEntrypoint}.
 * Used by {@link @/lib/ai/runner} to detect calls that skipped the public entry wrapper.
 */
export function isWithinAiDecisionEntrypoint(): boolean {
  return aiDecisionEntryStorage.getStore() != null;
}

export function getAiDecisionEntryMeta(): AiDecisionEntryMeta | undefined {
  return aiDecisionEntryStorage.getStore();
}

/**
 * Wrap API-route (or job) AI work so all provider calls sit under one control plane.
 * Prefer importing from `@/lib/ai/decisionEngine` (re-export) for a single documented entry.
 */
export async function withAiDecisionEntrypoint<T>(meta: AiDecisionEntryMeta, fn: () => Promise<T>): Promise<T> {
  return aiDecisionEntryStorage.run(meta, fn);
}

export function warnAiDecisionEntryBypass(context: string, extra?: Record<string, unknown>): void {
  if (isWithinAiDecisionEntrypoint()) return;
  recordAiBypassWarn(context, extra);
  if (isStrictAi()) {
    throw new Error(
      `AI_STRICT_BYPASS: ${context}. Wrap the route with withApiAiEntrypoint or call withAiDecisionEntrypoint. ` +
        `STRICT_MODE / LP_STRICT_AI / LP_STRICT_CONTROL is enabled.`,
    );
  }
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    `[AI] Bypassing decisionEngine entrypoint (${context}). Wrap the handler with withAiDecisionEntrypoint from @/lib/ai/decisionEngine.`,
    extra ?? {},
  );
}
