import "server-only";

import { opsLog } from "@/lib/ops/log";

/**
 * Strukturert server-logg for feil (kontrakten for HTTP leveres via jsonErr i route).
 */
export function logErrorResponse(rid: string, error: unknown, context?: Record<string, unknown>): void {
  const code =
    error && typeof error === "object" && error !== null && "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "UNKNOWN_ERROR";

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Unexpected error";

  console.error("[ERROR_RESPONSE]", { rid, code, message, raw: error, ...context });
  opsLog("error_response", { rid, code, message, ...context });
}
