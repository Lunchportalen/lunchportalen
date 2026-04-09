import "server-only";

import { NextResponse } from "next/server";

import type { AppError } from "@/lib/errors/taxonomy";

export type ErrorEnvelope = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
  details: unknown;
};

export function errorResponse(args: { rid: string; error: AppError }): NextResponse {
  const { rid: requestId, error } = args;
  const body: ErrorEnvelope = {
    ok: false,
    rid: requestId,
    error: error.code,
    message: error.message,
    status: error.status,
    details: error.details ?? null,
  };
  return NextResponse.json(body, { status: error.status });
}
