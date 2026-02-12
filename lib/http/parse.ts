import "server-only";
import type { NextRequest } from "next/server";
import { HttpError } from "./errors";

export async function readJson<T = any>(req: NextRequest, maxBytes = 256_000): Promise<T> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new HttpError("BAD_REQUEST", "Expected application/json", 400, { contentType: ct });
  }

  // NextRequest.json() har ikke size-limit; vi legger enkel kontroll:
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new HttpError("BAD_REQUEST", "Payload too large", 400, { maxBytes, size: text.length });
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError("INVALID_JSON", "Invalid JSON", 400);
  }
}
