import "server-only";

import { auditLog, buildAuditEvent } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { authLog } from "@/lib/auth/log";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function isCompanyUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export type ResolveAiTenantErr = {
  status: number;
  error: string;
  message: string;
  code: string;
};

/**
 * Server-only tenant + actor ids for AI execution (never trust body userId; companyId only for superadmin).
 */
export async function resolveAiTenantExecutionIds(input: {
  rid: string;
  bodyCompanyId: string;
  bodyUserId: string;
}): Promise<{ ok: true; companyId: string; userId: string } | { ok: false; err: ResolveAiTenantErr }> {
  const ctx = await getAuthContext({ rid: input.rid });

  if (!ctx.sessionOk) {
    auditLog(
      buildAuditEvent(ctx, {
        action: "ACCESS_DENIED",
        resource: "ai:tenant_resolve",
        metadata: { code: "UNAUTHORIZED" },
      }),
    );
    return {
      ok: false,
      err: { status: 401, error: "UNAUTHORIZED", message: "Authentication required.", code: "UNAUTHORIZED" },
    };
  }

  const userId = ctx.userId ?? ctx.user?.id ?? "";
  if (!userId) {
    return { ok: false, err: { status: 403, error: "FORBIDDEN", message: "Missing user.", code: "MISSING_USER" } };
  }

  const bodyCo = safeTrim(input.bodyCompanyId);
  const bodyUid = safeTrim(input.bodyUserId);

  if (bodyUid && bodyUid !== userId) {
    authLog(input.rid, "tenant_violation_attempt", {
      kind: "user_id_spoof",
      bodyUserId: bodyUid,
      sessionUserId: userId,
    });
    auditLog(
      buildAuditEvent(ctx, {
        action: "TENANT_VIOLATION",
        resource: "ai:tenant_resolve",
        metadata: { code: "IDENTITY_MISMATCH" },
      }),
    );
    return {
      ok: false,
      err: { status: 403, error: "FORBIDDEN", message: "Invalid context.", code: "IDENTITY_MISMATCH" },
    };
  }

  const role = ctx.role;

  if (role === "superadmin") {
    if (!bodyCo || !isCompanyUuid(bodyCo)) {
      return {
        ok: false,
        err: {
          status: 422,
          error: "MISSING_CONTEXT",
          message: "Valid companyId (UUID) is required.",
          code: "INVALID_OR_MISSING_COMPANY_ID",
        },
      };
    }
    return { ok: true, companyId: bodyCo, userId };
  }

  if (role === "company_admin" || role === "employee" || role === "kitchen" || role === "driver") {
    const co = safeTrim(ctx.company_id);
    if (!co || !isCompanyUuid(co)) {
      return {
        ok: false,
        err: {
          status: 403,
          error: "MISSING_COMPANY_SCOPE",
          message: "Mangler firmascope.",
          code: "MISSING_COMPANY_SCOPE",
        },
      };
    }
    if (bodyCo && bodyCo !== co) {
      authLog(input.rid, "tenant_violation_attempt", {
        kind: "company_id_drift",
        bodyCompanyId: bodyCo,
        ctxCompanyId: co,
        role,
      });
      auditLog(
        buildAuditEvent(ctx, {
          action: "TENANT_VIOLATION",
          resource: "ai:tenant_resolve",
          metadata: { code: "TENANT_MISMATCH", bodyCompanyId: bodyCo },
        }),
      );
      return {
        ok: false,
        err: { status: 403, error: "FORBIDDEN", message: "Invalid company scope.", code: "TENANT_MISMATCH" },
      };
    }
    return { ok: true, companyId: co, userId };
  }

  return {
    ok: false,
    err: { status: 403, error: "FORBIDDEN", message: "Role not allowed for this endpoint.", code: "FORBIDDEN" },
  };
}
