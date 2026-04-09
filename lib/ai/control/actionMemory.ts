import "server-only";

// In-process dedupe + ring buffer; durable mirror: public.ai_action_memory (snake_case — aiActionMemoryRow.ts).
import { persistAiActionMemoryFromMark } from "@/lib/ai/control/actionMemoryPersist";

type ActionKey = string;

type ActionEntry = {
  key: ActionKey;
  timestamp: number;
};

type ActionMark = {
  key: ActionKey;
  surface: string;
  actionType: string;
  timestamp: number;
};

const MEMORY = new Map<ActionKey, ActionEntry>();
const MARKS: ActionMark[] = [];
const MAX_MARKS = 100;

const TTL = 1000 * 60 * 10;

function now() {
  return Date.now();
}

export function buildActionKey(input: {
  surface: string;
  actionType: string;
  targetId?: string | number;
}) {
  return `${input.surface}:${input.actionType}:${input.targetId ?? "global"}`;
}

export function hasRecentAction(key: ActionKey): boolean {
  const entry = MEMORY.get(key);
  if (!entry) return false;

  const expired = now() - entry.timestamp > TTL;

  if (expired) {
    MEMORY.delete(key);
    return false;
  }

  return true;
}

/**
 * In-process dedupe gate (TTL). Returns true if this key is not within the recent window.
 * Cross-process / durable trail is written on {@link markAction} → `ai_action_memory`.
 */
export function tryAcquireAction(key: ActionKey): boolean {
  clearOldActions();
  return !hasRecentAction(key);
}

export function rememberAction(key: ActionKey) {
  MEMORY.set(key, {
    key,
    timestamp: now(),
  });
}

/** Observable completion marker (ring buffer) — after successful execute, before trace. */
export function markAction(input: { key: ActionKey; surface: string; actionType: string }) {
  MARKS.push({
    key: input.key,
    surface: input.surface,
    actionType: input.actionType,
    timestamp: now(),
  });
  if (MARKS.length > MAX_MARKS) MARKS.shift();
  void persistAiActionMemoryFromMark({
    key: input.key,
    surface: input.surface,
    actionType: input.actionType,
  });
}

export function getActionMarks(): readonly ActionMark[] {
  return MARKS;
}

export function clearOldActions() {
  const t = now();

  for (const [key, entry] of MEMORY.entries()) {
    if (t - entry.timestamp > TTL) {
      MEMORY.delete(key);
    }
  }
}
