import "server-only";

export type ErrCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL";

export class HttpError extends Error {
  public readonly code: ErrCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function asHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return new HttpError("INTERNAL", msg || "Internal error", 500);
}
