// lib/orders/idempotencyKey.ts
/** Client-generated idempotency key for POST /api/orders (min 8 chars per backend). */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
