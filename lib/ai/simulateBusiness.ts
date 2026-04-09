import "server-only";

/**
 * Deterministisk simulering (ingen sideeffekter).
 */
export function simulateStrategy(strategy: unknown): { safe: boolean; expectedImpact: number; preview: string } {
  const preview =
    typeof strategy === "string" ? strategy.slice(0, 500) : JSON.stringify(strategy ?? "").slice(0, 500);
  return {
    safe: true,
    expectedImpact: 0.1,
    preview,
  };
}
