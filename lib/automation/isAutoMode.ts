import "server-only";

/**
 * Server-side AI_AUTO_MODE (ingen klient-toggle uten persistens).
 */
export function isAutoMode(): boolean {
  return String(process.env.AI_AUTO_MODE ?? "").trim().toLowerCase() === "true";
}
