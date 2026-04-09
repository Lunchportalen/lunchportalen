import "server-only";

import type { AuthContext } from "@/lib/auth/getAuthContext";

/**
 * Warn-only invariant checks for handlers that already have `AuthContext`.
 * Does not throw; does not block requests.
 */
export function assertAuditInvariant(ctx: AuthContext): void {
  try {
    if (!ctx.rid?.trim()) {
      // eslint-disable-next-line no-console
      console.warn("[security] missing rid on auth context");
    }

    if (!ctx.sessionOk) {
      // eslint-disable-next-line no-console
      console.warn("[security] unauthenticated context (sessionOk=false) in audited path");
    }
  } catch {
    /* never throw */
  }
}
