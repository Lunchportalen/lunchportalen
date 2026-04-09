"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "@/lib/ai/debounce";
import type { Block } from "./editorBlockTypes";
import {
  fetchRichTextContinue,
  fetchRichTextInlineCompletion,
  fetchRichTextRewrite,
  neighborHeadingSuffixForBlock,
} from "./contentWorkspace.aiRequests";

export type UseContentWorkspaceRichTextAiParams = {
  effectiveId: string | null;
  title: string;
  blocks: Block[];
  setBlockById: (id: string, fn: (c: Block) => Block) => void;
};

/** Rich-text inline / continue / rewrite — workflow + local busy state; HTTP via `contentWorkspace.aiRequests`. */
export function useContentWorkspaceRichTextAi(p: UseContentWorkspaceRichTextAiParams) {
  const { effectiveId, title, blocks, setBlockById } = p;

  const [richTextInline, setRichTextInline] = useState<{ blockId: string | null; suffix: string }>({
    blockId: null,
    suffix: "",
  });
  const richTextInlineRef = useRef(richTextInline);
  richTextInlineRef.current = richTextInline;

  const [richTextDirectAiBusy, setRichTextDirectAiBusy] = useState<{
    blockId: string;
    op: "continue" | "rewrite";
  } | null>(null);

  const inlineAbortRef = useRef<AbortController | null>(null);
  const continueRewriteAbortRef = useRef<AbortController | null>(null);
  const inlineBodyRunRef = useRef<(() => void) | null>(null);
  const inlineBodyDebounceRef = useRef(
    debounce(() => {
      inlineBodyRunRef.current?.();
    }, 320),
  );

  const fetchRichTextInlineBody = useCallback(
    async (blockId: string, body: string, heading: string) => {
      if (body.trim().length < 12) {
        setRichTextInline((g) => (g.blockId === blockId ? { blockId: null, suffix: "" } : g));
        return;
      }
      inlineAbortRef.current?.abort();
      const ac = new AbortController();
      inlineAbortRef.current = ac;
      try {
        const { ok, completion } = await fetchRichTextInlineCompletion(
          body,
          {
            pageTitle: title,
            heading: `${heading}${neighborHeadingSuffixForBlock(blockId, blocks)}`,
            blockId,
          },
          ac.signal,
        );
        if (!ok) {
          setRichTextInline((g) => (g.blockId === blockId ? { blockId, suffix: "" } : g));
          return;
        }
        setRichTextInline({ blockId, suffix: completion });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setRichTextInline((g) => (g.blockId === blockId ? { blockId, suffix: "" } : g));
      }
    },
    [title, blocks],
  );

  useEffect(() => {
    return () => {
      inlineAbortRef.current?.abort();
      continueRewriteAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setRichTextInline({ blockId: null, suffix: "" });
    continueRewriteAbortRef.current?.abort();
    setRichTextDirectAiBusy(null);
  }, [effectiveId]);

  const runRichTextContinueAtCursor = useCallback(
    async (blockId: string, ta: HTMLTextAreaElement, body: string, heading: string) => {
      continueRewriteAbortRef.current?.abort();
      const ac = new AbortController();
      continueRewriteAbortRef.current = ac;
      setRichTextInline((g) => (g.blockId === blockId ? { blockId: null, suffix: "" } : g));
      setRichTextDirectAiBusy({ blockId, op: "continue" });
      try {
        const { ok, continuation } = await fetchRichTextContinue(
          body,
          {
            pageTitle: title,
            heading: `${heading}${neighborHeadingSuffixForBlock(blockId, blocks)}`,
            blockId,
          },
          ac.signal,
        );
        if (!ok || !continuation) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const merged = body.slice(0, start) + continuation + body.slice(end);
        setBlockById(blockId, (current) =>
          current.type === "richText" ? { ...current, body: merged } : current,
        );
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + continuation.length;
          try {
            ta.setSelectionRange(pos, pos);
          } catch {
            /* ignore */
          }
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setRichTextDirectAiBusy((b) => (b?.blockId === blockId ? null : b));
      }
    },
    [title, blocks, setBlockById],
  );

  const runRichTextRewriteSelection = useCallback(
    async (blockId: string, ta: HTMLTextAreaElement, body: string, intent: string) => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (start >= end) return;
      const selected = body.slice(start, end);
      if (!selected.trim()) return;
      continueRewriteAbortRef.current?.abort();
      const ac = new AbortController();
      continueRewriteAbortRef.current = ac;
      setRichTextInline((g) => (g.blockId === blockId ? { blockId: null, suffix: "" } : g));
      setRichTextDirectAiBusy({ blockId, op: "rewrite" });
      try {
        const { ok, rewritten } = await fetchRichTextRewrite(selected, intent, ac.signal);
        if (!ok || !rewritten) return;
        const merged = body.slice(0, start) + rewritten + body.slice(end);
        setBlockById(blockId, (current) =>
          current.type === "richText" ? { ...current, body: merged } : current,
        );
        requestAnimationFrame(() => {
          ta.focus();
          const p0 = start;
          const p1 = start + rewritten.length;
          try {
            ta.setSelectionRange(p0, p1);
          } catch {
            /* ignore */
          }
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setRichTextDirectAiBusy((b) => (b?.blockId === blockId ? null : b));
      }
    },
    [setBlockById],
  );

  return {
    richTextInline,
    setRichTextInline,
    richTextInlineRef,
    richTextDirectAiBusy,
    setRichTextDirectAiBusy,
    inlineAbortRef,
    continueRewriteAbortRef,
    inlineBodyRunRef,
    inlineBodyDebounceRef,
    fetchRichTextInlineBody,
    runRichTextContinueAtCursor,
    runRichTextRewriteSelection,
  };
}

/** @deprecated alias — prefer `useContentWorkspaceRichTextAi` */
export const useContentWorkspaceRichTextTransport = useContentWorkspaceRichTextAi;
