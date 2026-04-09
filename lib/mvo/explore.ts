import { EXPLORATION_FRACTION_DENOMINATOR } from "./safety";

/**
 * ~20 % deterministisk utforskning (én av fem hash-bøtter; justeres via `safety`).
 */
export function shouldExplore(userId: string): boolean {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return false;

  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % EXPLORATION_FRACTION_DENOMINATOR === 0;
}
