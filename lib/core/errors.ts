/**
 * Central application error shape (SOC2-style traceability in logs / handlers).
 * Prefer `throwError` so severity + source are always present.
 */

export type AppErrorSeverity = "low" | "medium" | "high";

export type AppError = {
  code: string;
  message: string;
  source: string;
  severity: AppErrorSeverity;
};

export function isAppError(e: unknown): e is AppError {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.code === "string" &&
    typeof o.message === "string" &&
    typeof o.source === "string" &&
    (o.severity === "low" || o.severity === "medium" || o.severity === "high")
  );
}

export function throwError(e: AppError): never {
  throw e;
}

/** Test + legacy alias — same shape as {@link AppError}. */
export type CoreError = AppError;

export function coreError(e: AppError): AppError {
  return e;
}

export function coreErrorFromUnknown(
  source: string,
  err: unknown,
  opts?: { code?: string },
): AppError {
  return {
    code: opts?.code ?? "UNKNOWN",
    message: err instanceof Error ? err.message : String(err),
    source,
    severity: "high",
  };
}

export function coreErrorToJson(e: AppError): {
  code: string;
  message: string;
  source: string;
  severity: AppErrorSeverity;
} {
  return {
    code: e.code,
    message: e.message,
    source: e.source,
    severity: e.severity,
  };
}

/** API-kontrakt for trygge klientfeil (ingen stack i payload). */
export function safeApiError(code: string, message: string, status = 400) {
  return { ok: false as const, code, message, status };
}

/** Deterministisk feilobjekt uten HTTP-status (interne hjelpere / logger). */
export function safeError(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}
