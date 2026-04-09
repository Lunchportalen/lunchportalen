"use client";

import { useCallback, useRef, useState } from "react";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { applyAiPageGuardrails } from "@/lib/ai/aiPageGuardrails";
import { createBlocksFromLayout, serializedBlocksToEditorBlocks } from "@/lib/ai/blockFactory";
import { buildLayoutPromptWithIntent, explainGeneration, parseIntent, type PageIntent } from "@/lib/ai/pageIntent";
import { getLayoutForIntent } from "@/lib/ai/layoutRules";
import { ensureTrailingCta, normalizeLayoutBlocks } from "@/lib/ai/normalizeCmsBlocks";

export type AiPageBuilderGenerateResult = {
  blocks: Block[];
  intent: PageIntent;
  layoutLabels: string[];
  explanation: string;
};

/**
 * Client-side intent → layout → skeleton → optional `/api/ai/layout` enrich.
 * Does not persist; caller applies `blocks` to editor state.
 */
export function useAiPageBuilder(onAfterGenerate?: () => void) {
  const afterRef = useRef(onAfterGenerate);
  afterRef.current = onAfterGenerate;
  const [busy, setBusy] = useState(false);

  const generatePage = useCallback(
    async (prompt: string, opts?: { enrichWithLayoutApi?: boolean }): Promise<AiPageBuilderGenerateResult> => {
      const p = String(prompt ?? "").trim();
      if (!p) throw new Error("Prompt mangler");
      setBusy(true);
      try {
        const intent = parseIntent(p);
        const layout = getLayoutForIntent(intent);
        let serialized = createBlocksFromLayout(layout, intent, p);
        serialized = applyAiPageGuardrails(serialized);

        if (opts?.enrichWithLayoutApi !== false) {
          try {
            const res = await fetch("/api/ai/layout", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ prompt: buildLayoutPromptWithIntent(p) }),
            });
            const json = (await res.json()) as { ok?: boolean; data?: { blocks?: unknown } };
            if (json?.ok === true && Array.isArray(json.data?.blocks)) {
              const normalized = normalizeLayoutBlocks(json.data!.blocks);
              if (normalized.length > 0) {
                serialized = applyAiPageGuardrails(ensureTrailingCta(normalized));
              }
            }
          } catch {
            // keep deterministic skeleton
          }
        }

        const blocks = serializedBlocksToEditorBlocks(serialized);
        if (blocks.length === 0) throw new Error("Ingen gyldige blokker");

        const explanation = explainGeneration(intent, layout);
        return { blocks, intent, layoutLabels: [...layout], explanation };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Reuses POST /api/ai/generate (existing) — normalizes to editor blocks. */
  const generateSectionInsert = useCallback(async (prompt: string): Promise<Block[]> => {
    const p = String(prompt ?? "").trim();
    if (!p) return [];
    setBusy(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: `Lag 1–3 CMS-blokker for Lunchportalen (typer hero, richText, image, cta). Kort og konkret norsk.\n\n${p}`,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { blocks?: unknown } };
      if (!json?.ok || !Array.isArray(json.data?.blocks)) return [];
      const normalized = normalizeLayoutBlocks(json.data!.blocks);
      const fixed = applyAiPageGuardrails(ensureTrailingCta(normalized));
      return serializedBlocksToEditorBlocks(fixed);
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, generatePage, generateSectionInsert };
}
