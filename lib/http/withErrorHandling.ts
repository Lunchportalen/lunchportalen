import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AppError, ERROR_CODES } from "@/lib/errors/taxonomy";
import { errorResponse } from "@/lib/http/errorResponse";
import { rid } from "@/lib/http/rid";
import { successResponse } from "@/lib/http/successResponse";

export type ErrorHandlingHandler<T = unknown> = (
  req: Request | NextRequest,
  requestId: string,
) => Promise<T>;

/**
 * Wraps a route handler: success → `{ ok, rid, data }`; `AppError` or unknown → contract error JSON.
 * Opt-in only — do not wrap auth/session flows without review.
 */
export function withErrorHandling<T>(handler: ErrorHandlingHandler<T>): (req: Request | NextRequest) => Promise<NextResponse> {
  return async (req: Request | NextRequest) => {
    const requestId = rid();

    try {
      const result = await handler(req, requestId);
      return NextResponse.json(successResponse({ rid: requestId, data: result }));
    } catch (err: unknown) {
      // Central request-scoped logging can be added without changing the response contract.

      if (err instanceof AppError) {
        return errorResponse({ rid: requestId, error: err });
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      return errorResponse({
        rid: requestId,
        error: new AppError({
          code: ERROR_CODES.INTERNAL_ERROR,
          message,
          status: 500,
        }),
      });
    }
  };
}
