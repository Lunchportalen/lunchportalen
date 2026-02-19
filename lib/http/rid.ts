import "server-only";
import { randomUUID } from "crypto";

/**
 * Genererer en kort, logg-vennlig Request ID.
 *
 * Format:
 *   LP_ks8fj29a_ab12cd34
 *
 * Struktur:
 *   <prefix>_<timeBase36>_<uuidPart>
 *
 * - prefix: standard "LP"
 * - timeBase36: Date.now() i base36 (kort og sortérbar)
 * - uuidPart: 8 tegn fra randomUUID (kollisjonssikker)
 */
export function makeRid(prefix: string = "LP"): string {
  const timePart = Date.now().toString(36); // sortérbar, kort
  const uuidPart = randomUUID().replace(/-/g, "").slice(0, 8);

  return `${prefix}_${timePart}_${uuidPart}`;
}

/**
 * ISO-timestamp (UTC)
 * Brukes i alle kvitteringer
 */
export function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Validerer om en streng ser ut som en gyldig rid
 * (brukes i evt. middleware/logg-verifikasjon)
 */
export function isRid(value: unknown, prefix: string = "LP"): boolean {
  if (typeof value !== "string") return false;
  const regex = new RegExp(`^${prefix}_[a-z0-9]+_[a-f0-9]{8}$`, "i");
  return regex.test(value);
}
