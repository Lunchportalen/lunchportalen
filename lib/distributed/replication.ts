import "server-only";

/**
 * Krok for replikasjon / fan-out (logging + fremtidig integrasjon).
 */
export async function replicate(data: unknown): Promise<void> {
  console.log("[REPLICATE]", { ts: Date.now(), data });
}
