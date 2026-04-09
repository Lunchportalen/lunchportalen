/**
 * Global error taxonomy — deterministic codes for API contract + observability.
 * Safe to import from server, client (AppError shape), and tests.
 */

export const ERROR_CODES = {
  // AUTH
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // INPUT
  INVALID_INPUT: "INVALID_INPUT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  MISSING_FIELD: "MISSING_FIELD",

  // RESOURCE
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // SYSTEM
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DB_ERROR: "DB_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",

  // BUSINESS
  AGREEMENT_REQUIRED: "AGREEMENT_REQUIRED",
  INVALID_STATE: "INVALID_STATE",
  ACTION_NOT_ALLOWED: "ACTION_NOT_ALLOWED",

  // AI
  AI_LOW_CONFIDENCE: "AI_LOW_CONFIDENCE",
  AI_BLOCKED_BY_POLICY: "AI_BLOCKED_BY_POLICY",

  // RATE LIMIT
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(args: { code: ErrorCode; message: string; status?: number; details?: unknown }) {
    super(args.message);
    this.name = "AppError";
    this.code = args.code;
    this.status = args.status ?? 500;
    this.details = args.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
