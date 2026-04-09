import { MAX_NEW_COMBO_TRAFFIC_FRACTION } from "./safety";

/**
 * Deterministisk 50 %-gate (eller `maxFraction`): skal denne brukeren eksponeres for nye MVO-comboer?
 * Brukes ved tildeling — ikke for server-side beslutning om «vinner» (ordrer = sannhet).
 */
export function shouldExposeToNewCombo(
  userId: string,
  maxFraction: number = MAX_NEW_COMBO_TRAFFIC_FRACTION
): boolean {
  const id = typeof userId === "string" ? userId : "";
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const unit = (hash % 10_000) / 10_000;
  const cap = Math.max(0, Math.min(1, maxFraction));
  return unit < cap;
}
