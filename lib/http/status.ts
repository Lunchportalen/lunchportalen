// STATUS: KEEP

import "server-only";
import type { ErrCode } from "./errors";

export function statusForCode(code: ErrCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "BAD_REQUEST":
    case "INVALID_JSON":
    case "INVALID_INPUT":
      return 400;
    default:
      return 500;
  }
}
