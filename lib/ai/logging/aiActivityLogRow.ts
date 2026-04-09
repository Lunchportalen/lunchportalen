/**
 * Builds a row for public.ai_activity_log matching the live schema.
 * Live columns: id, action, entity_type, entity_id, page_id, variant_id, actor_user_id, metadata, created_at.
 * Always provides: action, entity_type, entity_id, page_id, actor_user_id, metadata.
 * entity_type is "page" when page_id is set, otherwise "system"; entity_id is page_id or "".
 * Legacy fields (tool, created_by, environment, locale, etc.) are stored inside metadata only;
 * do not add them as top-level columns — the table may not have them (schema cache / migrations).
 *
 * actor_user_id is uuid → profiles.id in some deployments; non-UUID actors (e.g. email) go to metadata.actor_email.
 */

import { isMediaItemUuid } from "@/lib/media/ids";

export type AiActivityLogRowInput = {
  action: string;
  page_id?: string | null;
  variant_id?: string | null;
  /** Maps to actor_user_id. Also accepts legacy key created_by. */
  actor_user_id?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
  /** Moved into metadata */
  tool?: string | null;
  environment?: string | null;
  locale?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  model?: string | null;
  [k: string]: unknown;
};

export type AiActivityLogRow = {
  action: string;
  entity_type: string;
  entity_id: string | null;
  page_id: string | null;
  variant_id: string | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
};

const METADATA_KEYS = new Set([
  "tool",
  "environment",
  "locale",
  "prompt_tokens",
  "completion_tokens",
  "model",
  "metadata",
  "created_by",
  "actor_user_id",
]);

/**
 * Returns an object suitable for insert into ai_activity_log. Only uses columns that exist in the live table.
 * Extra input fields (tool, created_by, environment, locale, etc.) are merged into metadata.
 */
export function buildAiActivityLogRow(input: AiActivityLogRowInput): AiActivityLogRow {
  const metadata: Record<string, unknown> = {
    ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {}),
  };
  if (input.tool != null && input.tool !== "") metadata.tool = input.tool;
  if (input.environment != null) metadata.environment = input.environment;
  if (input.locale != null) metadata.locale = input.locale;
  if (input.prompt_tokens != null) metadata.prompt_tokens = input.prompt_tokens;
  if (input.completion_tokens != null) metadata.completion_tokens = input.completion_tokens;
  if (input.model != null) metadata.model = input.model;
  for (const [k, v] of Object.entries(input)) {
    if (METADATA_KEYS.has(k) || k === "action" || k === "page_id" || k === "variant_id") continue;
    if (v !== undefined && v !== null) metadata[k] = v;
  }

  const actorRaw = input.actor_user_id ?? input.created_by ?? null;
  const actorTrimmed = typeof actorRaw === "string" ? actorRaw.trim() : "";
  const actorUuid = isMediaItemUuid(actorTrimmed) ? actorTrimmed : null;
  if (actorTrimmed && !actorUuid) {
    metadata.actor_email = actorTrimmed;
  }

  const pageIdRaw = typeof input.page_id === "string" ? input.page_id.trim() : "";
  const pageId = pageIdRaw || null;
  const variantIdRaw = typeof input.variant_id === "string" ? input.variant_id.trim() : "";
  const variantId = variantIdRaw || null;
  const entityType = pageId != null ? "page" : "system";
  const entityId = pageId;

  return {
    action: typeof input.action === "string" ? input.action : "unknown",
    entity_type: entityType,
    entity_id: entityId,
    page_id: pageId,
    variant_id: variantId,
    actor_user_id: actorUuid,
    metadata,
  };
}
