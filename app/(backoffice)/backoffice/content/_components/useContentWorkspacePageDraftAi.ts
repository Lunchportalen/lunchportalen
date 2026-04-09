"use client";

/**
 * Full-page AI-utkast (strict preview via server action), apply til editor, modal-state.
 * Ingen overlay open/close i `useContentWorkspaceOverlays` — kun workflow her.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateAiPageDraftAction } from "../_actions/generateAiPageDraft";
import type { Block } from "./editorBlockTypes";
import { mapSerializedAiBlockToBlock, summarizeBlocksForAiPrompt } from "./contentWorkspace.ai";
import type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

export type UseContentWorkspacePageDraftAiParams = Pick<
  UseContentWorkspacePanelRequestsParams,
  "effectiveId" | "blocks" | "page" | "slug" | "title" | "setBlocks" | "setTitle" | "setSaveStateSafe"
>;

export function useContentWorkspacePageDraftAi(p: UseContentWorkspacePageDraftAiParams) {
  const { effectiveId, blocks, page, slug, title, setBlocks, setTitle, setSaveStateSafe } = p;

  const [aiFullPageModalOpen, setAiFullPageModalOpen] = useState(false);
  const [aiFullPageModalPrompt, setAiFullPageModalPrompt] = useState("");
  const [aiFullPageBusy, setAiFullPageBusy] = useState(false);
  const [aiFullPageError, setAiFullPageError] = useState<string | null>(null);
  const [aiFullPagePreview, setAiFullPagePreview] = useState<{ title: string; blocksRaw: unknown[] } | null>(null);
  const [aiFullPageReplaceOk, setAiFullPageReplaceOk] = useState(false);
  const [aiFullPageAlsoTitle, setAiFullPageAlsoTitle] = useState(false);

  const aiFullPagePreviewBlocks = useMemo(() => {
    if (!aiFullPagePreview?.blocksRaw?.length) return [];
    const out: Block[] = [];
    for (const r of aiFullPagePreview.blocksRaw) {
      const b = mapSerializedAiBlockToBlock(r);
      if (b) out.push(b);
    }
    return out;
  }, [aiFullPagePreview]);

  const closeAiFullPageModal = useCallback(() => {
    setAiFullPageModalOpen(false);
    setAiFullPageBusy(false);
    setAiFullPageError(null);
    setAiFullPagePreview(null);
    setAiFullPageReplaceOk(false);
    setAiFullPageAlsoTitle(false);
  }, []);

  const onAiFullPageModalGenerate = useCallback(async () => {
    const prompt = aiFullPageModalPrompt.trim();
    if (!prompt) return;
    setAiFullPageBusy(true);
    setAiFullPageError(null);
    try {
      const existingBlocksSummary = summarizeBlocksForAiPrompt(blocks);
      const pageTypeHint =
        page?.id && (slug || page.slug || title || page.title)
          ? `slug: ${String(slug || page.slug || "").trim()}; gjeldende tittel: ${String(title || page.title || "").trim()}`
          : undefined;
      const res = await generateAiPageDraftAction({
        prompt,
        mode: "strict_preview",
        pageTypeHint,
        existingBlocksSummary: blocks.length ? existingBlocksSummary : undefined,
      });
      if (res.ok === false) {
        setAiFullPageError(res.error);
        setAiFullPagePreview(null);
        return;
      }
      setAiFullPagePreview({ title: res.data.title, blocksRaw: res.data.blocks });
      setAiFullPageReplaceOk(false);
    } finally {
      setAiFullPageBusy(false);
    }
  }, [aiFullPageModalPrompt, blocks, page, slug, title]);

  const onAiFullPageModalApply = useCallback(() => {
    if (!aiFullPagePreview || !aiFullPageReplaceOk) return;
    const next: Block[] = [];
    for (const r of aiFullPagePreview.blocksRaw) {
      const b = mapSerializedAiBlockToBlock(r);
      if (b) next.push(b);
    }
    if (next.length === 0) return;
    setBlocks(next);
    if (aiFullPageAlsoTitle && aiFullPagePreview.title.trim()) {
      setTitle(aiFullPagePreview.title.trim());
    }
    setSaveStateSafe("dirty");
    setAiFullPageModalOpen(false);
    setAiFullPageModalPrompt("");
    setAiFullPagePreview(null);
    setAiFullPageReplaceOk(false);
    setAiFullPageAlsoTitle(false);
    setAiFullPageError(null);
  }, [aiFullPagePreview, aiFullPageReplaceOk, aiFullPageAlsoTitle, setBlocks, setTitle, setSaveStateSafe]);

  useEffect(() => {
    setAiFullPageModalOpen(false);
    setAiFullPageModalPrompt("");
    setAiFullPageBusy(false);
    setAiFullPageError(null);
    setAiFullPagePreview(null);
    setAiFullPageReplaceOk(false);
    setAiFullPageAlsoTitle(false);
  }, [effectiveId]);

  return {
    aiFullPageModalOpen,
    setAiFullPageModalOpen,
    aiFullPageModalPrompt,
    setAiFullPageModalPrompt,
    aiFullPageBusy,
    aiFullPageError,
    setAiFullPageError,
    aiFullPagePreview,
    setAiFullPagePreview,
    aiFullPageReplaceOk,
    setAiFullPageReplaceOk,
    aiFullPageAlsoTitle,
    setAiFullPageAlsoTitle,
    aiFullPagePreviewBlocks,
    closeAiFullPageModal,
    onAiFullPageModalGenerate,
    onAiFullPageModalApply,
  };
}
