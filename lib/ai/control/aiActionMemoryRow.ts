import "server-only";

import type { Database } from "@/lib/types/database";

/** Matches `public.ai_action_memory` Insert — snake_case only for Supabase. */
export type AiActionMemoryInsert = Database["public"]["Tables"]["ai_action_memory"]["Insert"];

const TTL_MS = 1000 * 60 * 10;

function parseTargetIdFromActionKey(actionKey: string): string | null {
  const first = actionKey.indexOf(":");
  if (first === -1) return null;
  const second = actionKey.indexOf(":", first + 1);
  if (second === -1) return null;
  const tail = actionKey.slice(second + 1).trim();
  if (!tail || tail === "global") return null;
  return tail;
}

/** Runtime guard immediately before durable insert (persist layer also calls this). */
export function assertAiActionMemoryInsertReady(row: AiActionMemoryInsert): void {
  if (!row.action_key) throw new Error("Missing action_key");
  if (!row.surface) throw new Error("Missing surface");
  if (!row.action_type) throw new Error("Missing action_type");
}

/**
 * Maps in-process automation keys to DB row shape. Never send camelCase keys to Supabase.
 */
export function toAiActionMemoryInsert(input: {
  key: string;
  surface: string;
  actionType: string;
}): AiActionMemoryInsert {
  const action_key = String(input.key ?? "").trim();
  const surface = String(input.surface ?? "").trim();
  const action_type = String(input.actionType ?? "").trim();

  if (!action_key) throw new Error("Missing action_key");
  if (!surface) throw new Error("Missing surface");
  if (!action_type) throw new Error("Missing action_type");

  const target_id = parseTargetIdFromActionKey(action_key);
  const expires_at = new Date(Date.now() + TTL_MS).toISOString();

  return { action_key, surface, action_type, target_id, expires_at };
}
