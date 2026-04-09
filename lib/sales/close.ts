import "server-only";

/**
 * Fail-closed: closing a deal always requires explicit human approval upstream.
 */
export function closeDeal(_deal: unknown): { status: "requires_approval" } {
  return { status: "requires_approval" as const };
}
