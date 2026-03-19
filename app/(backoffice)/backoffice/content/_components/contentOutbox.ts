/**
 * Content editor outbox: local persistence of draft state (save/status).
 * Single source for read/write/clear and outbox UI status.
 */

import type { PageStatus } from "./contentTypes";

const OUTBOX_KEY_PREFIX = "lp.backoffice.outbox.content.v1:";

export function getOutboxKey(pageId: string): string {
  return OUTBOX_KEY_PREFIX + pageId;
}

export type OutboxDraft = {
  title: string;
  slug: string;
  status: PageStatus;
  body: string;
};

export type OutboxEntry = {
  pageId: string;
  savedAtLocal: string;
  updatedAtSeen: string | null;
  draft: OutboxDraft;
  fingerprint: string;
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function fingerprintDraft(draft: OutboxDraft): string {
  return djb2(JSON.stringify(draft));
}

export function readOutbox(pageId: string): OutboxEntry | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getOutboxKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !(parsed as Record<string, unknown>).pageId || !(parsed as Record<string, unknown>).draft) return null;
    return parsed as OutboxEntry;
  } catch {
    return null;
  }
}

export function writeOutbox(entry: OutboxEntry): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(getOutboxKey(entry.pageId), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function clearOutbox(pageId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(getOutboxKey(pageId));
  } catch {
    // ignore
  }
}

export function getOutboxEntryKey(entry: { id?: string; rid?: string; savedAtLocal?: string; pageId?: string }): string {
  if (entry.id != null && String(entry.id).trim() !== "") return String(entry.id);
  if (entry.rid != null && String(entry.rid).trim() !== "") return String(entry.rid);
  if (entry.savedAtLocal != null && String(entry.savedAtLocal).trim() !== "") return String(entry.savedAtLocal);
  return `${entry.pageId ?? "no_page"}:${entry.savedAtLocal ?? "na"}`;
}

export function safeJsonBytes(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}

export type OutboxUiStatus = "pending" | "failed" | "retrying";

export function getOutboxUiStatus(entry: unknown): { key: OutboxUiStatus; label: string; tone: "neutral" | "warn" | "danger" } {
  if (entry == null || typeof entry !== "object") {
    return { key: "pending", label: "Pending", tone: "neutral" };
  }
  const e = entry as Record<string, unknown>;
  const hasStatusFields =
    "status" in e ||
    "state" in e ||
    "isRetrying" in e ||
    "inFlight" in e ||
    "lastError" in e ||
    "errorMessage" in e ||
    "failureReason" in e;
  if (!hasStatusFields) {
    return { key: "pending", label: "Pending", tone: "neutral" };
  }
  if (
    ("isRetrying" in e && e.isRetrying === true) ||
    ("inFlight" in e && e.inFlight === true) ||
    ("state" in e && String(e.state ?? "") === "retrying") ||
    ("status" in e && String(e.status ?? "") === "retrying")
  ) {
    return { key: "retrying", label: "Retrying", tone: "warn" };
  }
  if (
    ("lastError" in e && String(e.lastError ?? "").trim().length > 0) ||
    ("errorMessage" in e && String(e.errorMessage ?? "").trim().length > 0) ||
    ("failureReason" in e && String(e.failureReason ?? "").trim().length > 0) ||
    ("state" in e && String(e.state ?? "") === "failed") ||
    ("status" in e && (String(e.status ?? "") === "failed" || String(e.status ?? "") === "error"))
  ) {
    return { key: "failed", label: "Failed", tone: "danger" };
  }
  return { key: "pending", label: "Pending", tone: "neutral" };
}
