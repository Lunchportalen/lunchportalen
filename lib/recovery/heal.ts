import "server-only";

/**
 * Best-effort signal til drift (logger; blokkerer ikke forespørsel).
 */
export function autoHeal(signal: string): void {
  console.warn("[AUTO_HEAL]", { ts: new Date().toISOString(), signal });
}
