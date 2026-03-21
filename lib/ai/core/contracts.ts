/**
 * AI core contracts — shared request/response shapes for the suggest flow.
 * Single source for API envelope and tool payload so route and CMS editor stay aligned.
 * Layer: between inference (provider) and capability (registry); consumed by suggest route and client.
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";

/** Payload shape returned by AI tools and carried in suggest API response (suggestion field). */
export type ToolSuggestionPayload = {
  summary?: string;
  patch?: AIPatchV1;
  metaSuggestion?: { title?: string; description?: string };
  candidates?: Array<{ mediaItemId: string; url: string; alt: string }>;
  suggestionIds?: string[];
  experimentId?: string;
  issues?: Array<{ code: string; severity: string; message: string }>;
  stats?: Record<string, unknown>;
  variants?: unknown[];
  [key: string]: unknown;
};

/** Success response from POST /api/backoffice/ai/suggest. */
export type SuggestApiSuccessResponse = {
  ok: true;
  rid: string;
  suggestionId?: string | null;
  suggestion: ToolSuggestionPayload;
};

/** Error response from suggest route (ok: false). */
export type SuggestApiErrorResponse = {
  ok: false;
  rid?: string;
  error?: string;
  message?: string;
  status?: number;
};

export type SuggestApiResponse = SuggestApiSuccessResponse | SuggestApiErrorResponse;
