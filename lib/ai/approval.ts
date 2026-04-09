import "server-only";

import { throwError } from "@/lib/core/errors";

/**
 * Hard stop for impact actions: execution must be approved out-of-band (UI / ops).
 */
export function requireApproval(action: string): never {
  const a = String(action ?? "").trim() || "unknown";
  throwError({
    code: "AI_APPROVAL_REQUIRED",
    message: `Manuell godkjenning kreves for: ${a}`,
    source: "ai",
    severity: "high",
  });
}
