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

export function isAIEnabled(): boolean {
  const provider = process.env.AI_PROVIDER;
  const key = process.env.AI_API_KEY;
  return !!provider && !!key && String(key).trim() !== "";
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