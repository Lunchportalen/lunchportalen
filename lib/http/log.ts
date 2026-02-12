import "server-only";

export function opsLog(event: string, data: Record<string, unknown>) {
  // Bytt til din logger senere (Axiom/Datadog/etc)
  console.log(`[LP] ${event}`, data);
}
