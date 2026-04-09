// STATUS: KEEP

import "server-only";
import type { NextRequest } from "next/server";
import { HttpError } from "./errors";

/**
 * Kontrakt:
 * - Klient kan sende `Idempotency-Key` header
 * - Du kan senere persistere key+hash+result i DB
 */
export function readIdempotencyKey(req: NextRequest): string | null {
  const k = req.headers.get("idempotency-key");
  if (!k) return null;
  const key = k.trim();
  if (key.length < 8 || key.length > 128) {
    throw new HttpError("BAD_REQUEST", "Invalid Idempotency-Key", 400);
  }
  return key;
}
