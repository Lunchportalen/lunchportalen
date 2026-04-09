import "server-only";

export function emitBusinessEvent(event: unknown): void {
  console.log("[BUSINESS_EVENT]", event);
}
