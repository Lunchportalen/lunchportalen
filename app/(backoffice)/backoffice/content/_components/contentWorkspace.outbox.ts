// app/(backoffice)/backoffice/content/_components/contentWorkspace.outbox.ts
/** LocalStorage outbox + UI status helpers for ContentWorkspace (draft recovery). */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { makeRidClient } from "./contentWorkspace.helpers";
import type { PageStatus } from "./contentWorkspace.types";

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

/** Deterministic fingerprint for local draft identity (same algorithm as historical `djb2(JSON.stringify(draft))`). */
export function fingerprintOutboxDraft(draft: OutboxDraft): string {
  return djb2(JSON.stringify(draft));
}

export function readOutbox(pageId: string): OutboxEntry | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getOutboxKey(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !(parsed as Record<string, unknown>).pageId || !(parsed as Record<string, unknown>).draft)
      return null;
    const o = parsed as OutboxEntry;
    return o;
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

// E1.3 – outbox feedback key hardening
export function getOutboxEntryKey(entry: { id?: string; rid?: string; savedAtLocal?: string; pageId?: string }): string {
  if (entry.id != null && String(entry.id).trim() !== "") return String(entry.id);
  if (entry.rid != null && String(entry.rid).trim() !== "") return String(entry.rid);
  if (entry.savedAtLocal != null && String(entry.savedAtLocal).trim() !== "") return String(entry.savedAtLocal);
  return `${entry.pageId ?? "no_page"}:${entry.savedAtLocal ?? "na"}`;
}

// E1.3 – payloadBytes hardening
export function safeJsonBytes(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}

/** E1 — sanitert eksport-snapshot (samme struktur som tidligere i ContentWorkspace). */
export function buildOutboxExportSnapshot(
  entry: OutboxEntry,
  sessionRidRef: MutableRefObject<string | null>,
  isOffline: boolean
): {
  rid: string;
  pageId: string;
  slug: string | undefined;
  outboxId: string | undefined;
  saveStateKey: "outbox";
  isOnline: boolean;
  ts: string;
  itemTs: string | null;
  attempts: number | null;
  lastError: string | null;
  payloadBytes: number | null;
} {
  if (!sessionRidRef.current) sessionRidRef.current = makeRidClient();
  const payloadBytes = safeJsonBytes(entry.draft);
  return {
    rid: sessionRidRef.current,
    pageId: entry.pageId,
    slug: entry.draft?.slug ?? undefined,
    outboxId: undefined as string | undefined,
    saveStateKey: "outbox" as const,
    isOnline: !isOffline,
    ts: new Date().toISOString(),
    itemTs: entry.savedAtLocal ?? null,
    attempts: null as number | null,
    lastError: null as string | null,
    payloadBytes,
  };
}

export async function copyOutboxSafetyExportToClipboard(
  entry: OutboxEntry,
  sessionRidRef: MutableRefObject<string | null>,
  isOffline: boolean,
  setOutboxCopyFeedback: Dispatch<SetStateAction<Record<string, "ok" | "fail" | null>>>
): Promise<void> {
  const key = getOutboxEntryKey(entry);
  setOutboxCopyFeedback((prev) => ({ ...prev, [key]: null }));
  const snapshot = buildOutboxExportSnapshot(entry, sessionRidRef, isOffline);
  const str = JSON.stringify(snapshot, null, 2);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(str);
      setOutboxCopyFeedback((prev) => ({ ...prev, [key]: "ok" }));
    } else {
      throw new Error("clipboard_unavailable");
    }
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = str;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      setOutboxCopyFeedback((prev) => ({ ...prev, [key]: ok ? "ok" : "fail" }));
    } catch {
      setOutboxCopyFeedback((prev) => ({ ...prev, [key]: "fail" }));
    }
  }
}

// E2 – outbox status per item (kun eksisterende felter)
export type OutboxUiStatus = "pending" | "failed" | "retrying";

// E2.4 – hardening: vis kun Failed/Retrying hvis statusfelter faktisk finnes på entry
export function getOutboxUiStatus(entry: unknown): {
  key: OutboxUiStatus;
  label: string;
  tone: "neutral" | "warn" | "danger";
} {
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
