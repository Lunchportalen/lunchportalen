import { createHash } from "node:crypto";

import "server-only";

/** Stable id for audit rows (no Date.now() in hot paths). */
export function deterministicIntegrationId(prefix: string, parts: string[]): string {
  const h = createHash("sha256").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex").slice(0, 20);
  return `${prefix}_${h}`;
}
