import "server-only";

/**
 * Sanity document-webhook body can be denormalized (projection root) or nested under `result`.
 */
export function extractMenuDayFromSanityWebhookBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o._type === "menuDay") return o;

  const result = o.result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r._type === "menuDay") return r;
  }
  return null;
}

export function menuDayIsPublishVisible(doc: Record<string, unknown> | null): boolean {
  if (!doc) return false;
  return doc.customerVisible === true && doc.approvedForPublish === true;
}
