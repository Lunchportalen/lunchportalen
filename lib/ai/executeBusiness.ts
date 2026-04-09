import "server-only";

/**
 * Ingen auto-kjøring av forretningskritiske steg — alltid vent på godkjenning.
 */
export async function executeStrategy(strategy: unknown): Promise<{ status: "pending_approval" }> {
  console.log("[EXECUTE_STRATEGY]", strategy);
  return { status: "pending_approval" };
}
