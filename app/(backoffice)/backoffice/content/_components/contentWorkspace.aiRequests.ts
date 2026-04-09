/**
 * Stateless CMS editor AI HTTP helpers — no React, no UI state.
 * Hooks (`useContentWorkspaceAi`, panel/rich-text hooks) call these and own orchestration.
 */

import type { Dispatch, SetStateAction } from "react";
import { getBlockTreeLabel } from "./blockLabels";
import { logApiRidFromBody } from "./contentWorkspace.api";
import type { SuggestRequest } from "./editorAiContracts";
import type { Block } from "./editorBlockTypes";
import { buildWorkspaceImagePrompt, resolveWorkspaceImagePreset } from "./contentWorkspaceImagePromptShell";

export type BackofficeFetchJsonResult = {
  ok: boolean;
  status: number;
  json: unknown;
};

/** POST /api/backoffice/ai/suggest — editor suggest pipeline. */
export async function fetchBackofficeSuggestRequest(body: SuggestRequest): Promise<BackofficeFetchJsonResult> {
  const res = await fetch("/api/backoffice/ai/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

/** POST with credentials — dedicated backoffice AI routes (block builder, layout, image, …). */
export async function fetchBackofficePostJson(
  path: string,
  body: Record<string, unknown>
): Promise<BackofficeFetchJsonResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

/** GET with credentials — e.g. `/api/backoffice/ai/capability`. */
export async function fetchBackofficeGetJson(path: string): Promise<BackofficeFetchJsonResult> {
  const res = await fetch(path, { method: "GET", credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

/** POST `/api/ai/*` — copilot, design, growth, automation (no credentials; optional AbortSignal). */
export async function fetchPublicAiPostJson(
  path: string,
  body: Record<string, unknown>,
  init?: { signal?: AbortSignal }
): Promise<BackofficeFetchJsonResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: init?.signal,
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

/** GET `/api/ai/*` — e.g. dashboard refresh. */
export async function fetchPublicAiGet(path: string): Promise<BackofficeFetchJsonResult> {
  const res = await fetch(path, { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

export function neighborHeadingSuffixForBlock(blockId: string, list: Block[]): string {
  const idx = list.findIndex((b) => b.id === blockId);
  if (idx < 0) return "";
  const bits: string[] = [];
  if (idx > 0) bits.push(`Forrige: ${getBlockTreeLabel(list[idx - 1]!)}`);
  if (idx < list.length - 1) bits.push(`Neste: ${getBlockTreeLabel(list[idx + 1]!)}`);
  return bits.length ? ` | ${bits.join(" · ")}` : "";
}

export type RichTextAiInlineContext = {
  pageTitle: string;
  heading: string;
  blockId: string;
};

/** POST /api/ai/inline */
export async function fetchRichTextInlineCompletion(
  text: string,
  context: RichTextAiInlineContext,
  signal: AbortSignal
): Promise<{ ok: boolean; completion: string }> {
  const res = await fetch("/api/ai/inline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ text, context }),
  });
  const json = (await res.json()) as { ok?: boolean; data?: { completion?: string } };
  if (!res.ok || json.ok === false) return { ok: false, completion: "" };
  return { ok: true, completion: String(json.data?.completion ?? "") };
}

/** POST /api/ai/continue */
export async function fetchRichTextContinue(
  text: string,
  context: RichTextAiInlineContext,
  signal: AbortSignal
): Promise<{ ok: boolean; continuation: string }> {
  const res = await fetch("/api/ai/continue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ text, context }),
  });
  const json = (await res.json()) as { ok?: boolean; data?: { continuation?: string } };
  if (!res.ok || json.ok === false) return { ok: false, continuation: "" };
  return { ok: true, continuation: String(json.data?.continuation ?? "") };
}

/** POST /api/ai/rewrite */
export async function fetchRichTextRewrite(
  text: string,
  intent: string,
  signal: AbortSignal
): Promise<{ ok: boolean; rewritten: string }> {
  const res = await fetch("/api/ai/rewrite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ text, intent }),
  });
  const json = (await res.json()) as { ok?: boolean; data?: { rewritten?: string } };
  if (!res.ok || json.ok === false) return { ok: false, rewritten: "" };
  return { ok: true, rewritten: String(json.data?.rewritten ?? "") };
}

type HeroImageBlock = Extract<Block, { type: "hero" | "hero_full" | "image" }>;

/** Batch image generation for hero / image blocks (flyttet fra `ContentWorkspace` FASE 33 — samme HTTP og sideeffekter). */
export async function runWorkspaceAiImageBatch(deps: {
  blocks: Block[];
  actionLock: boolean;
  setActionLock: (v: boolean) => void;
  setAiError: (msg: string | null) => void;
  bumpMetricsAction: () => void;
  bumpMetricsError: () => void;
  setBlockById: (id: string, updater: (current: Block) => Block) => void;
  setAiBatchProgress: Dispatch<SetStateAction<{ total: number; done: number }>>;
  setAiBatchLoading: (v: boolean) => void;
  imagePreset: string;
}): Promise<void> {
  const {
    blocks,
    actionLock,
    setActionLock,
    setAiError,
    bumpMetricsAction,
    bumpMetricsError,
    setBlockById,
    setAiBatchProgress,
    setAiBatchLoading,
    imagePreset,
  } = deps;

  if (!blocks || blocks.length === 0) return;

  const targets = blocks
    .filter((b) => {
      if (b.type === "image") return !(b.mediaItemId ?? "").trim();
      if (b.type === "hero" || b.type === "hero_full") return !(b.contentData.mediaItemId ?? "").trim();
      return false;
    })
    .sort((a, b) => {
      if (a.type === "hero" || a.type === "hero_full") return -1;
      if (b.type === "hero" || b.type === "hero_full") return 1;
      return 0;
    }) as HeroImageBlock[];
  if (targets.length === 0) return;

  if (actionLock) return;
  setActionLock(true);

  const runWithLimit = async <T,>(items: T[], limit: number, fn: (item: T) => Promise<void>) => {
    const queue = [...items];
    const workers = Array.from({ length: limit }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        await fn(item);
      }
    });
    await Promise.all(workers);
  };

  let batchImageErrorReported = false;
  const buildImagePrompt = (block: Block, presetOverride?: string): string =>
    buildWorkspaceImagePrompt(block, imagePreset, presetOverride);

  const generateImage = async (block: HeroImageBlock) => {
    const autoPreset = resolveWorkspaceImagePreset(block);
    let prompt = buildImagePrompt(block, autoPreset);
    if (block.type === "hero" || block.type === "hero_full") {
      prompt += `
ekstra fokus på komposisjon og dybde,
bred scene, cinematic følelse
`;
    }

    const res = await fetch("/api/backoffice/ai/image-generator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        prompt,
        generate: true,
      }),
    });

    const data: unknown = await res.json().catch(() => null);
    logApiRidFromBody(data);

    if (!res.ok) {
      console.error("[AI_ACTION_FAILED]", res.status);
      if (!batchImageErrorReported) {
        batchImageErrorReported = true;
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
      }
      return { url: undefined, assetId: undefined };
    }
    const body = data && typeof data === "object" ? (data as { ok?: boolean; data?: { url?: unknown; assetId?: unknown } }) : null;
    if (!body || body.ok !== true) {
      console.error("[AI_ACTION_FAILED]", data);
      if (!batchImageErrorReported) {
        batchImageErrorReported = true;
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
      }
      return { url: undefined, assetId: undefined };
    }

    return {
      url: body.data?.url,
      assetId: body.data?.assetId,
    };
  };

  const generateWithRetry = async (block: HeroImageBlock, retries = 2): Promise<{ url?: unknown; assetId?: unknown } | null> => {
    try {
      return await generateImage(block);
    } catch (err) {
      if (retries > 0) {
        return generateWithRetry(block, retries - 1);
      }
      console.error("[AI_ACTION_FAILED]", err);
      setAiError("Kunne ikke hente resultat");
      bumpMetricsError();
      return null;
    }
  };

  setAiBatchProgress({
    total: targets.length,
    done: 0,
  });
  setAiBatchLoading(true);
  try {
    await runWithLimit(targets, 2, async (block) => {
      try {
        const result = await generateWithRetry(block);
        const url = result?.url;
        const assetId = result?.assetId;
        if (typeof url !== "string" || !url) {
          console.error("[AI_ACTION_FAILED]", "missing_url", block.id);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }

        if (block.type === "hero" || block.type === "hero_full") {
          setBlockById(block.id, (current) =>
            current.type === "hero" || current.type === "hero_full"
              ? {
                  ...current,
                  contentData: {
                    ...current.contentData,
                    imageId: url,
                    mediaItemId:
                      typeof assetId === "string" ? assetId : current.contentData.mediaItemId,
                  },
                }
              : current
          );
        }

        if (block.type === "image") {
          setBlockById(block.id, (current) =>
            current.type === "image"
              ? {
                  ...current,
                  imageId: url,
                  mediaItemId: typeof assetId === "string" ? assetId : current.mediaItemId,
                }
              : current
          );
        }
      } finally {
        setAiBatchProgress((prev) => ({
          ...prev,
          done: prev.done + 1,
        }));
      }
    });
    bumpMetricsAction();
  } catch (e) {
    console.error("[AI_ACTION_FAILED]", e);
    setAiError("Kunne ikke hente resultat");
    bumpMetricsError();
  } finally {
    setAiBatchLoading(false);
    setActionLock(false);
  }
}
