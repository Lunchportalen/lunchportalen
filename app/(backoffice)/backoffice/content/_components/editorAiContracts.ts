/**
 * Editor–AI request/response contracts.
 * Deterministic, structured payloads and safe parsing. Malformed responses yield null; no ad-hoc provider shapes in UI.
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { isAIPatchV1 } from "@/lib/cms/model/aiPatch";

/* ========== Suggest request (POST /api/backoffice/ai/suggest) ========== */

/** Explicit request payload for the suggest route. */
export type SuggestRequest = {
  tool: string;
  pageId: string | null;
  variantId: string | null;
  environment: "preview" | "staging" | "prod";
  locale: "nb" | "en";
  input: Record<string, unknown>;
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  existingBlocks: Array<{ id: string; type: string }>;
  meta: { description?: string; title?: string };
  pageTitle?: string;
  pageSlug?: string;
};

/* ========== Generic API response ========== */

/** Success from backoffice AI routes (jsonOk wraps payload in data). */
export type BackofficeAiOk<T> = { ok: true; data: T; message?: string };

/** Error shape from backoffice AI routes. */
export type BackofficeAiErr = {
  ok: false;
  message?: string;
  error?: string;
  rid?: string;
};

/**
 * Parse JSON from backoffice AI route. Returns ok+data or err+message; null if malformed.
 */
export function parseBackofficeAiJson(json: unknown): BackofficeAiOk<unknown> | BackofficeAiErr | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true) {
    return { ok: true, data: o.data };
  }
  if (o.ok === false) {
    const message = typeof o.message === "string" ? o.message : typeof o.error === "string" ? o.error : "AI-forespørsel feilet.";
    return { ok: false, message, error: typeof o.error === "string" ? o.error : undefined, rid: typeof o.rid === "string" ? o.rid : undefined };
  }
  return null;
}

/** Extract user-facing error message from parsed response or status. */
export function normalizeAiErrorMessage(status: number, parsed: BackofficeAiErr | null, fallback: string): string {
  if (parsed?.message) return parsed.message;
  return fallback;
}

/* ========== Suggest (POST /api/backoffice/ai/suggest) ========== */

/** Normalized suggest payload: suggestion text, structured patch, meta suggestion. */
export type SuggestPayload = {
  /** User-facing summary (suggestion text). */
  summary?: string;
  /** Structured patch for editor apply; only set when valid AIPatchV1. */
  patch?: AIPatchV1;
  /** SEO/meta suggestion (title, description). */
  metaSuggestion?: { title?: string; description?: string };
};

/**
 * Extract and normalize suggest payload from API data. Handles data.suggestion or raw data.
 * Patch is included only when isAIPatchV1(patch). Returns null if data is not an object.
 */
export function parseSuggestPayload(raw: unknown): SuggestPayload | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  let payload: unknown = raw;
  const obj = raw as Record<string, unknown>;
  if ("suggestion" in obj && obj.suggestion != null) {
    payload = obj.suggestion;
  }
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const result: SuggestPayload = {};
  if (typeof p.summary === "string" && p.summary.trim()) result.summary = p.summary.trim();
  if (isAIPatchV1(p.patch)) result.patch = p.patch;
  if (p.metaSuggestion != null && typeof p.metaSuggestion === "object" && !Array.isArray(p.metaSuggestion)) {
    const m = p.metaSuggestion as Record<string, unknown>;
    result.metaSuggestion = {
      title: typeof m.title === "string" ? m.title : undefined,
      description: typeof m.description === "string" ? m.description : undefined,
    };
  }
  return result;
}

/* ========== Block builder ========== */

export type BlockBuilderResult = {
  block: Record<string, unknown>;
  message: string;
};

export function parseBlockBuilderResponse(data: unknown): BlockBuilderResult | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const block = o.block;
  if (block == null || typeof block !== "object" || Array.isArray(block)) return null;
  const message = typeof o.message === "string" ? o.message : "";
  return { block: block as Record<string, unknown>, message };
}

/* ========== Screenshot builder ========== */

export type ScreenshotBuilderResult = {
  blocks: unknown[];
  message?: string;
  blockTypes?: string[];
  warnings?: string[];
};

export function parseScreenshotBuilderResponse(data: unknown): ScreenshotBuilderResult | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const blocks = o.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const message = typeof o.message === "string" ? o.message : undefined;
  const warnings = Array.isArray(o.warnings) ? (o.warnings as string[]).filter((w) => typeof w === "string") : undefined;
  const blockTypes = blocks
    .map((b) => (b != null && typeof b === "object" && "type" in (b as object) ? String((b as { type?: unknown }).type) : null))
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  return { blocks, message, blockTypes: blockTypes.length > 0 ? blockTypes : undefined, warnings };
}

/* ========== Layout suggestions ========== */

export type LayoutSuggestionItem = {
  kind: string;
  title: string;
  reason: string;
  priority: string;
  previewLabel?: string;
  applyPatch?: AIPatchV1;
};

export type LayoutSuggestionsResult = {
  suggestions: LayoutSuggestionItem[];
  message: string;
};

export function parseLayoutSuggestionsResponse(data: unknown): LayoutSuggestionsResult | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const arr = Array.isArray(o.suggestions) ? o.suggestions : [];
  const suggestions = arr
    .filter((s): s is Record<string, unknown> => s != null && typeof s === "object" && !Array.isArray(s))
    .map((s) => ({
      kind: typeof s.kind === "string" ? s.kind : "",
      title: typeof s.title === "string" ? s.title : "",
      reason: typeof s.reason === "string" ? s.reason : "",
      priority: typeof s.priority === "string" ? s.priority : "medium",
      previewLabel: typeof s.previewLabel === "string" ? s.previewLabel : undefined,
      applyPatch: isAIPatchV1(s.applyPatch) ? s.applyPatch : undefined,
    }))
    .slice(0, 10);
  if (suggestions.length === 0) return null;
  const message = typeof o.message === "string" ? o.message : "";
  return { suggestions, message };
}

/* ========== Image generator (prompt-suggestion only) ========== */

export type ImagePromptItem = { prompt: string; alt: string };

export type ImageGeneratorResult = {
  /** Prompt suggestions only; no image URLs or mediaItemIds. */
  prompts: ImagePromptItem[];
  revisedPrompt?: string;
};

export function parseImageGeneratorResponse(data: unknown): ImageGeneratorResult | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const payload = o.data != null && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : o;
  const raw = Array.isArray(payload.prompts) ? payload.prompts : [];
  const prompts: ImagePromptItem[] = raw
    .filter((p): p is Record<string, unknown> => p != null && typeof p === "object")
    .map((p) => ({
      prompt: typeof p.prompt === "string" ? p.prompt : "",
      alt: typeof p.alt === "string" ? p.alt : "",
    }))
    .filter((p) => p.prompt.length > 0);
  const revisedPrompt = typeof payload.revisedPrompt === "string" ? payload.revisedPrompt : undefined;
  if (prompts.length === 0 && !revisedPrompt) return null;
  return { prompts, revisedPrompt };
}

/* ========== Page builder ========== */

export type PageBuilderBlock = { id: string; type: string; data: Record<string, unknown> };

export type PageBuilderResult = {
  title?: string;
  summary?: string;
  blocks: PageBuilderBlock[];
  warnings?: string[];
  droppedBlocks?: Array<{ index: number; type: string }>;
};

export function parsePageBuilderResponse(data: unknown): PageBuilderResult | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const rawBlocks = Array.isArray(o.blocks) ? o.blocks : [];
  const blocks: PageBuilderBlock[] = [];
  const droppedBlocks: Array<{ index: number; type: string }> = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    const item = rawBlocks[i];
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
      droppedBlocks.push({ index: i, type: "unknown" });
      continue;
    }
    const b = item as Record<string, unknown>;
    const id = typeof b.id === "string" ? b.id.trim() || `blk_${i}` : `blk_${i}`;
    const type = typeof b.type === "string" ? b.type.trim() || "richText" : "richText";
    const data = b.data != null && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : {};
    blocks.push({ id, type, data });
  }
  if (blocks.length === 0 && rawBlocks.length > 0) return null;
  const title = typeof o.title === "string" ? o.title : undefined;
  const summary = typeof o.summary === "string" ? o.summary : undefined;
  const warnings = Array.isArray(o.warnings) ? (o.warnings as string[]).filter((w) => typeof w === "string") : undefined;
  return {
    title,
    summary,
    blocks,
    warnings: warnings?.length ? warnings : undefined,
    droppedBlocks: droppedBlocks.length ? droppedBlocks : undefined,
  };
}

/* ========== Capability ========== */

export type CapabilityResult = { enabled: boolean };

export function parseCapabilityResponse(json: unknown): CapabilityResult | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const enabled = typeof o.enabled === "boolean" ? o.enabled : null;
  if (enabled !== null) return { enabled };
  const data = o.data;
  if (data != null && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const dataEnabled = typeof d.enabled === "boolean" ? d.enabled : null;
    if (dataEnabled !== null) return { enabled: dataEnabled };
  }
  return null;
}
