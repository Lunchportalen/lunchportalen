import "server-only";

import { runUnifiedSocialGeneration } from "@/lib/social/unifiedGenerator";
import { saveUnifiedSocialPost } from "@/lib/social/savePost";
import type { UnifiedSocialInput } from "@/lib/social/unifiedSocialTypes";

export function parseUnifiedGenerateBody(body: unknown): {
  mode: "deterministic" | "ai";
  persist: boolean;
  input: UnifiedSocialInput;
} {
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const mode = o.mode === "deterministic" || o.mode === "ai" ? o.mode : "ai";
  const persist = Boolean(o.persist);

  const input: UnifiedSocialInput = {
    product: typeof o.product === "string" ? o.product : undefined,
    audience: typeof o.audience === "string" ? o.audience : undefined,
    goal: typeof o.goal === "string" ? o.goal : undefined,
    productId: typeof o.productId === "string" ? o.productId : undefined,
    slotDay: typeof o.slotDay === "string" ? o.slotDay : undefined,
    platform: typeof o.platform === "string" ? o.platform : undefined,
    calendarPostId: typeof o.calendarPostId === "string" ? o.calendarPostId : undefined,
  };

  return { mode, persist, input };
}

/**
 * Én motor: `runUnifiedSocialGeneration` + valgfri persist via `saveUnifiedSocialPost`.
 */
export async function executeUnifiedSocialGenerate(body: unknown): Promise<{
  result: Awaited<ReturnType<typeof runUnifiedSocialGeneration>>;
  savedId: string | null;
  saved: boolean;
}> {
  const { mode, persist, input } = parseUnifiedGenerateBody(body);
  const result = await runUnifiedSocialGeneration({ mode, input });

  let savedId: string | null = null;
  let saved = false;
  if (persist) {
    const save = await saveUnifiedSocialPost(result, {
      productId: typeof input.productId === "string" ? input.productId : undefined,
    });
    if (save.ok) {
      savedId = save.id;
      saved = true;
    }
  }

  return { result, savedId, saved };
}
