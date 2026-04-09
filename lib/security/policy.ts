import "server-only";

export type SecurityPolicyCtx = {
  user?: { role?: string | null; id?: string | null } | null;
  action: string;
};

/**
 * Valgfritt strikte gate for kallende kode (ikke global middleware).
 */
export function enforceSecurityPolicy(ctx: SecurityPolicyCtx): void {
  if (!ctx.user) {
    throw {
      code: "SECURITY_UNAUTHENTICATED",
      message: "User not authenticated",
      source: "security",
      severity: "high" as const,
    };
  }

  const role = ctx.user.role;
  if (role == null || String(role).trim() === "") {
    throw {
      code: "SECURITY_INVALID_CONTEXT",
      message: "Missing role",
      source: "security",
      severity: "high" as const,
    };
  }
}
