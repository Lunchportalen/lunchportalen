/**
 * U20/U30/U30X — Les content_audit_log for redaksjonell tidslinje (superadmin).
 * Read-only. Skal ikke 500-e ved kjent schema-/tabellmangel; returner degradert state.
 */
import type { NextRequest } from "next/server";
import {
  isAuditLogRouteDegradableError,
  resolveAuditLogDegradedPayload,
  serializeAuditError,
} from "@/lib/cms/auditLogTableError";
import {
  isContentBackendUnavailableError,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import {
  scopeOr401,
  requireRoleOr403,
  denyResponse,
  q,
} from "@/lib/http/routeGuard";
import { isLocalCmsRuntimeError, listLocalCmsAuditEntries } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

type AuditRow = {
  id: string;
  page_id: string | null;
  variant_id: string | null;
  environment: string | null;
  locale: string | null;
  action: string;
  actor_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

function trimMetadata(meta: unknown): Record<string, unknown> {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return {};
  const obj = meta as Record<string, unknown>;

  try {
    const raw = JSON.stringify(obj);
    if (raw.length <= 800) return obj;
    return {
      _truncated: true,
      preview: `${raw.slice(0, 400)}…`,
    };
  } catch {
    return {};
  }
}

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function isUuidLike(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getErrorCode(error: unknown): string | null {
  return typeof (error as { code?: unknown })?.code === "string"
    ? ((error as { code: string }).code ?? null)
    : null;
}

function getErrorMessage(error: unknown): string {
  const msg = serializeAuditError(error);
  return typeof msg === "string" ? msg.toLowerCase() : "";
}

async function logIncident(params: {
  rid: string;
  route: string;
  message: string;
  error?: string;
  code?: string | null;
}) {
  try {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("incident", {
      rid: params.rid,
      route: params.route,
      message: params.message,
      error: params.error,
      code: params.code ?? undefined,
    });
  } catch {
    // Logging must never break the route
  }
}

function toAuditRow(row: Record<string, unknown>): AuditRow {
  return {
    id: String(row.id ?? ""),
    page_id: row.page_id == null ? null : String(row.page_id),
    variant_id: row.variant_id == null ? null : String(row.variant_id),
    environment: row.environment == null ? null : String(row.environment),
    locale: row.locale == null ? null : String(row.locale),
    action: String(row.action ?? ""),
    actor_email: row.actor_email == null ? null : String(row.actor_email),
    metadata: trimMetadata(row.metadata),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const limit = parseLimit(q(request, "limit"));
  const pageId = q(request, "page_id");
  const variantId = q(request, "variant_id");
  const locale = q(request, "locale");
  const environment = q(request, "environment");
  const action = q(request, "action");

  if (isLocalCmsRuntimeEnabled()) {
    try {
      const out = listLocalCmsAuditEntries({
        limit,
        page_id: pageId,
        variant_id: variantId,
        locale,
        environment,
        action,
      });
      return jsonOk(ctx.rid, out, 200);
    } catch (error) {
      if (isLocalCmsRuntimeError(error)) {
        return jsonErr(ctx.rid, error.message, error.status, error.code, error.detail);
      }
      const detail = serializeAuditError(error);
      return jsonErr(ctx.rid, detail || "Kunne ikke hente audit-logg.", 500, "AUDIT_LOG_FAILED", {
        detail,
      });
    }
  }

  if (isLocalDevContentReserveEnabled()) {
    return jsonOk(
      ctx.rid,
      {
        items: [],
        source: "local_dev_content_reserve" as const,
        degraded: true as const,
        reason: "LOCAL_DEV_CONTENT_RESERVE" as const,
        historyStatus: "degraded" as const,
        operatorMessage:
          "Audit-loggen bruker reservevisning mens LOCAL_DEV_CONTENT_RESERVE er aktivert eksplisitt.",
        operatorAction:
          "Deaktiver LOCAL_DEV_CONTENT_RESERVE nar Supabase er tilbake for a hente ekte audit-spor.",
      },
      200,
    );
  }

  if (pageId && !isUuidLike(pageId.trim())) {
    return jsonErr(ctx.rid, "page_id må være en gyldig UUID.", 422, "INVALID_PAGE_ID", {
      field: "page_id",
    });
  }

  if (variantId && !isUuidLike(variantId.trim())) {
    return jsonErr(
      ctx.rid,
      "variant_id må være en gyldig UUID.",
      422,
      "INVALID_VARIANT_ID",
      {
        field: "variant_id",
      },
    );
  }

  try {
    const supabase = supabaseAdmin();

    let query = supabase
      .from("content_audit_log")
      .select(
        "id, page_id, variant_id, environment, locale, action, actor_email, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (isUuidLike(pageId?.trim() ?? null)) {
      query = query.eq("page_id", pageId.trim());
    }

    if (isUuidLike(variantId?.trim() ?? null)) {
      query = query.eq("variant_id", variantId.trim());
    }

    if (locale && locale.trim()) {
      query = query.eq("locale", locale.trim());
    }

    if (environment && environment.trim()) {
      query = query.eq("environment", environment.trim());
    }

    if (action && action.trim()) {
      query = query.eq("action", action.trim());
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const items = rows.map((row) => toAuditRow(row as Record<string, unknown>));

    return jsonOk(
      ctx.rid,
      {
        items,
        source: "postgres_content_audit_log" as const,
        degraded: false as const,
        historyStatus: "ready" as const,
        operatorMessage:
          items.length > 0
            ? "Audit-logg hentet fra content_audit_log."
            : "Ingen audit-rader for valgt filter.",
      },
      200,
    );
  } catch (error) {
    const detail = serializeAuditError(error);
    const code = getErrorCode(error);

    if (isContentBackendUnavailableError(error)) {
      await logIncident({
        rid: ctx.rid,
        route: "/api/backoffice/content/audit-log",
        message: "content_audit_log backend unavailable; returning degraded empty list",
        error: detail,
        code,
      });

      return jsonOk(
        ctx.rid,
        {
          items: [],
          source: "postgres_content_audit_log" as const,
          degraded: true as const,
          reason: "BACKEND_UNREACHABLE" as const,
          historyStatus: "degraded" as const,
          operatorMessage:
            "Audit-loggen svarte ikke fra backend. Viser degradert reservevisning til Supabase er tilbake.",
          operatorAction:
            "Kontroller DNS eller nettverk mot Supabase hvis du trenger ekte audit-spor i dette miljoet.",
          schemaHints: {
            detail,
            code,
          },
        },
        200,
      );
    }

    if (isAuditLogRouteDegradableError(error)) {
      const degradedPayload = resolveAuditLogDegradedPayload(error);
      if (!degradedPayload) {
        throw error;
      }
      await logIncident({
        rid: ctx.rid,
        route: "/api/backoffice/content/audit-log",
        message:
          "content_audit_log missing or inaccessible; returning degraded empty list",
        error: detail,
        code,
      });

      return jsonOk(
        ctx.rid,
        {
          items: [],
          source: "postgres_content_audit_log" as const,
          degraded: true as const,
          reason: degradedPayload.reason,
          historyStatus: "degraded" as const,
          operatorMessage: degradedPayload.operatorMessage,
          operatorAction: degradedPayload.operatorAction,
          schemaHints: degradedPayload.schemaHints,
        },
        200,
      );
    }

    await logIncident({
      rid: ctx.rid,
      route: "/api/backoffice/content/audit-log",
      message: "audit route failed unexpectedly",
      error: detail,
      code,
    });

    return jsonErr(
      ctx.rid,
      detail || "Kunne ikke hente audit-logg.",
      500,
      "AUDIT_LOG_FAILED",
      {
        detail,
        code,
      },
    );
  }
}