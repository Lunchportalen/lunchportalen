import "server-only";

export type AISuggestInput = {
  tool: string;
  locale: "nb" | "en";
  input?: Record<string, unknown>;
};

export type AISuggestOutput =
  | {
      ok: true;
      data: Record<string, unknown>;
      usage?: { promptTokens: number; completionTokens: number };
      model?: string;
    }
  | { ok: false; error: string };

/**
 * Canonical env: AI_PROVIDER, AI_API_KEY.
 * Backward-compat: OPENAI_API_KEY used as key fallback; when only OPENAI_API_KEY is set, provider is inferred as "openai".
 */
function getAiConfig(): { provider: string; keyPresent: boolean } {
  const keyRaw = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const key = typeof keyRaw === "string" ? keyRaw.trim() : "";
  const keyPresent = key.length > 0;
  const providerRaw = process.env.AI_PROVIDER ?? "";
  const providerTrimmed = typeof providerRaw === "string" ? providerRaw.trim() : "";
  const provider =
    providerTrimmed !== ""
      ? providerTrimmed
      : keyPresent && (process.env.OPENAI_API_KEY ?? "").trim() !== ""
        ? "openai"
        : "";
  return { provider, keyPresent };
}

export function isAIEnabled(): boolean {
  const { provider, keyPresent } = getAiConfig();
  const enabled = provider.length > 0 && keyPresent;
  if (process.env.NODE_ENV === "development") {
    console.log("[AI_PROVIDER] capability", {
      provider: provider ? `${provider.slice(0, 2)}***` : "(empty)",
      keyPresent,
      enabled,
    });
  }
  return enabled;
}

export async function suggestJSON(req: AISuggestInput): Promise<AISuggestOutput> {
  if (!isAIEnabled()) return { ok: false, error: "AI_DISABLED" };
  return {
    ok: true,
    data: { message: "AI provider not wired yet (bootstrap)." },
    usage: { promptTokens: 0, completionTokens: 0 },
    model: process.env.AI_MODEL ?? "bootstrap",
  };
}
