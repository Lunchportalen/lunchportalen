/**
 * Pure presentation helpers for ContentWorkspace — statuslinje, slug, nabokontekst for AI-preamble.
 * Ingen domene-/preview-pipeline; ingen sideeffekter.
 */

import { formatDateTimeNO } from "./_stubs";
import { getBlockTreeLabel } from "./blockLabels";
import type { Block } from "./editorBlockTypes";
import type { SaveState } from "./types";

export function safeStr(v: unknown): string {
  return String(v ?? "").trim();
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

/** I1 – pure mapper: state → statuslinje (prioritet: conflict > offline > error > saving > unsaved > saved) */
export function getStatusLineState(params: {
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  formatDateFn: (v: string | null | undefined) => string;
}): {
  key: string;
  tone: string;
  label: string;
  detail?: string;
  actions: { retry?: boolean; reload?: boolean };
} {
  const { saveState, dirty, isOffline, lastSavedAt, lastError, formatDateFn } = params;
  if (saveState === "conflict")
    return {
      key: "conflict",
      tone: "border-amber-300 bg-amber-50 text-amber-800",
      label: "Konflikt – last på nytt",
      actions: { reload: true },
    };
  if (saveState === "offline" || isOffline)
    return {
      key: "offline",
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      label: "Offline – lagres lokalt",
      actions: {},
    };
  if (saveState === "error")
    return {
      key: "error",
      tone: "border-amber-300 bg-amber-50 text-amber-800",
      label: "Feil – prøv igjen",
      actions: { retry: true },
    };
  if (saveState === "saving")
    return { key: "saving", tone: "border-slate-300 bg-slate-50 text-slate-700", label: "Lagrer…", actions: {} };
  if (dirty || saveState === "dirty")
    return {
      key: "unsaved",
      tone: "border-amber-200 bg-amber-50/80 text-amber-800",
      label: "Ulagrede endringer",
      actions: {},
    };
  return {
    key: "saved",
    tone: "border-green-200 bg-green-50/80 text-green-800",
    label: "Lagret",
    detail: lastSavedAt ? `Sist lagret ${formatDateFn(lastSavedAt)}` : undefined,
    actions: {},
  };
}

export function neighborAiPreamble(blockId: string, list: Block[]): string {
  const idx = list.findIndex((b) => b.id === blockId);
  if (idx < 0) return "";
  const prev = idx > 0 ? getBlockTreeLabel(list[idx - 1]!) : null;
  const next = idx < list.length - 1 ? getBlockTreeLabel(list[idx + 1]!) : null;
  if (!prev && !next) return "";
  return `[Sideblokk-kontekst — ikke omskriv disse, bare ta hensyn til rekkefølge]\nForrige: ${prev ?? "—"}\nNeste: ${next ?? "—"}\n\n---\n\n`;
}
