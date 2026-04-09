/**
 * SOC2-vennlig strukturlogg (stdout).
 */
export function structuredLog(event: { type: string; source: string; rid: string; payload?: unknown }): void {
  console.log("[STRUCTURED_LOG]", {
    ts: new Date().toISOString(),
    ...event,
  });
}
