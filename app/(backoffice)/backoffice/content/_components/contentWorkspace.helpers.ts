/**
 * Pure helpers for ContentWorkspace. No React, no hooks.
 * Used for strings, slugs, snapshots, mojibake detection, RID generation,
 * and other derived editor state that must stay deterministic.
 */

import { formatDateTimeNO } from "@/lib/date/format";
import type { PageStatus } from "./contentTypes";
import type { SaveState } from "./types";
import type { AiCapabilityStatus } from "./ContentAiTools";
import { statusTone } from "./useContentSaveStatus";

export function looksMojibakeText(s: string): boolean {
  return /Ã.|Â.|Ãƒ/.test(s);
}

export function looksMojibakeAny(value: unknown): boolean {
  try {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    return looksMojibakeText(str);
  } catch {
    return false;
  }
}

export function makeRidClient(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return `rid_${(crypto as any).randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `rid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export function normalizeSlug(v: unknown): string {
  return safeStr(v)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(v: string | null | undefined): string {
  const raw = safeStr(v);
  if (!raw) return "-";
  return formatDateTimeNO(raw) || raw;
}

export function makeSnapshot(input: {
  title: string;
  slug: string;
  /** Blocks JSON string, or envelope object — must match `bodyForSave` / load snapshot semantics. */
  body: unknown;
}): string {
  const raw = input.body;
  const bodySerialized =
    typeof raw === "string"
      ? raw
      : raw != null && typeof raw === "object"
        ? JSON.stringify(raw)
        : String(raw ?? "");
  return JSON.stringify({
    title: safeStr(input.title),
    slug: normalizeSlug(input.slug),
    body: bodySerialized,
  });
}

export type PageStatusDisplay = {
  /** Chip label used in the page list (e.g. "live" or "draft"). */
  chipLabel: string;
  /** Tone class for the status chip, based on canonical statusTone. */
  chipToneClass: string;
  /** Human label used in meta panels (e.g. "Publisert" or "Kladd"). */
  infoLabel: string;
};

export function derivePageStatusDisplay(status: PageStatus): PageStatusDisplay {
  const chipToneClass = statusTone(status);
  const isPublished = status === "published";

  const chipLabel = isPublished ? "live" : "draft";
  const infoLabel = isPublished ? "Publisert" : "Kladd";

  return {
    chipLabel,
    chipToneClass,
    infoLabel,
  };
}

export function deriveSaveError(saveState: SaveState, lastError: string | null): string | null {
  if (saveState === "error" || saveState === "conflict" || saveState === "offline") {
    return lastError;
  }
  return null;
}

export function deriveAiDisabled(params: {
  isOffline: boolean;
  effectiveId: string | null;
  aiCapability: AiCapabilityStatus;
}): boolean {
  const { isOffline, effectiveId, aiCapability } = params;
  return isOffline || !effectiveId || aiCapability !== "available";
}

/** Extract user-facing summary from AI tool response. tool is e.g. "experiment.generate.variants". Uses shared ToolSuggestionPayload shape. */
export function extractAiSummary(tool: string, data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.summary === "string" && o.summary.trim()) {
    return o.summary.trim();
  }
  if (tool === "experiment.generate.variants") {
    if (Array.isArray(o.variants)) {
      const count = o.variants.length;
      return count > 0
        ? `Genererte ${count} A/B-variant${count === 1 ? "" : "er"}.`
        : "Ingen A/B-varianter generert.";
    }
    if (Array.isArray(o.suggestionIds)) {
      const count = o.suggestionIds.length;
      return count > 0
        ? `Genererte ${count} A/B-variant${count === 1 ? "" : "er"}.`
        : "Ingen A/B-varianter generert.";
    }
  }
  if (tool === "image.generate.brand_safe" && Array.isArray(o.prompts)) {
    const count = o.prompts.length;
    return count > 0
      ? `${count} promptforslag for bilde. Bruk i bildeverktøy.`
      : "Ingen promptforslag.";
  }
  if (tool === "image.generate.brand_safe" && Array.isArray(o.candidates)) {
    const count = o.candidates.length;
    return count > 0 ? `${count} bildeforslag.` : "Ingen bildeforslag.";
  }
  if (tool === "image.improve.metadata") {
    return "Forslag til bilde-metadata er klare i AI-forslaget.";
  }
  return null;
}
