/**
 * Explicit PATCH intents for CMS pages: same HTTP transport (`fetchPatchContentPage`),
 * different payload semantics (draft body vs status-only transition).
 */

import type { PageStatus } from "./contentTypes";

export type ContentPatchIntent = "draft_body" | "status_transition";

/** Payload for status / publish transitions (PATCH `status` only). */
export function buildStatusTransitionPayload(nextStatus: PageStatus): { status: PageStatus } {
  return { status: nextStatus };
}
