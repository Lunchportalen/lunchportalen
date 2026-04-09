import "server-only";

import type { AuthContext } from "@/lib/auth/getAuthContext";

/**
 * Non-blocking compliance visibility for a resolved auth context.
 * Opt-in only — not wired into middleware or layouts (no default runtime change).
 */
export function runSecuritySelfCheck(ctx: AuthContext) {
  const hasTenant =
    !!ctx.company_id?.trim() || ctx.role === "superadmin" || ctx.role === "kitchen" || ctx.role === "driver";

  const out = {
    hasSession: ctx.sessionOk,
    hasRole: ctx.role != null,
    hasTenant,
    hasRid: !!ctx.rid?.trim(),
  };

  if (process.env.LP_DEBUG_SECURITY === "1") {
    // eslint-disable-next-line no-console
    console.info("[security:selfcheck]", { rid: ctx.rid, ...out });
  }

  return out;
}
