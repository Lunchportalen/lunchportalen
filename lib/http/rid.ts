import "server-only";
import { randomUUID } from "crypto";

export function makeRid(prefix = "LP"): string {
  // Kort, logg-vennlig rid
  return `${prefix}_${randomUUID().slice(0, 8)}${randomUUID().slice(0, 4)}`;
}
