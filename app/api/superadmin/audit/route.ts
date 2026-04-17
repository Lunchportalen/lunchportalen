// app/api/superadmin/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { enterpriseAuditRowToSuperadminListItem, getAuditLogs } from "@/lib/audit/query";
import { OPERATIVE_AUDIT_EVENTS_OR } from "@/lib/audit/operativeAuditStream";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* =========================================================
   Utils
========================================================= */
function safeText(v: any, maxLen: number) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.slice(0, maxLen);
}
function clampInt(v: any, min: number, max: number, def: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}
function isIsoTs(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
}
function escapeForIlike(v: string) {
  // best-effort: nøytraliser wildcard-tegn
  return v.replace(/[%_]/g, (m) => `\\${m}`);
}

/* =========================================================
   Types
========================================================= */
type AuditItem = {
  id: string;
  created_at: string;

  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;

  action: string | null;
  entity_type: string | null;
  entity_id: string | null;

  summary: string | null;
  detail: any | null;
};

type ApiOk = {
  ok: true;
  rid: string;
  meta: {
    limit: number;
    nextCursor: string | null;
    source: "audit_events" | "merged";
    filters: {
      cursor?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      companyId?: string;
      q?: string;
      since?: string;
      until?: string;
      auditSource?: string;
      withEnterprise?: boolean;
      actorUserId?: string;
      stream?: "operative";
    };
  };
  items: AuditItem[];
};

type ApiErr = { ok: false; rid: string; error: string; message?: string; detail?: any };

/* =========================================================
   GET /api/superadmin/audit

   Query:
    - limit=1..500 (default 300)
    - cursor=<created_at ISO> (pagination; fetch older than cursor)
    - companyId=<uuid> (optional filter; matches company_id in audit_events)   (best-effort)
    - entityType=<string> (optional ilike)
    - entityId=<uuid> (optional exact)
    - action=<string> (optional ilike)
    - q=<string> (optional search; actor_email/action/entity_type/summary/rid)
    - stream=operative — kun canonical operative audit_events (avtale/firma-status);
      tvinger withEnterprise=0 (ingen audit_logs-merge).
========================================================= */
export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    /* =========================
       Auth (cookie) — fail-closed
    ========================= */
    const sb = await supabaseServer();
    const { data: userRes, error: authErr } = await sb.auth.getUser();
    const user = userRes?.user ?? null;

    if (authErr || !user) return jsonErr(rid, "Du må være innlogget.", 401, "AUTH_REQUIRED");

    if (!(await isSuperadminProfile(user.id))) return jsonErr(rid, "Ikke tilgang.", 403, "FORBIDDEN");

    /* =========================
       Parse query
    ========================= */
    const u = new URL(req.url);

    const limit = clampInt(u.searchParams.get("limit") ?? "300", 1, 500, 300);

    const cursor = safeText(u.searchParams.get("cursor"), 60);
    if (cursor && !isIsoTs(cursor)) {
      return jsonErr(rid, "Ugyldig cursor (ISO timestamp).", 400, {
        code: "BAD_REQUEST",
        detail: { cursor },
      });
    }

    const companyId = safeText(u.searchParams.get("companyId"), 80);
    if (companyId && !isUuid(companyId)) {
      return jsonErr(rid, "Ugyldig companyId (uuid).", 400, {
        code: "BAD_REQUEST",
        detail: { companyId },
      });
    }

    const entityId = safeText(u.searchParams.get("entityId") || u.searchParams.get("entity_id"), 80);
    if (entityId && !isUuid(entityId)) {
      return jsonErr(rid, "Ugyldig entityId (uuid).", 400, {
        code: "BAD_REQUEST",
        detail: { entityId },
      });
    }

    const entityTypeRaw = safeText(u.searchParams.get("entityType") || u.searchParams.get("entity_type"), 60);
    const actionRaw = safeText(u.searchParams.get("action"), 120);
    const qRaw = safeText(u.searchParams.get("q"), 120);

    const sinceParam = safeText(u.searchParams.get("since"), 40);
    const untilParam = safeText(u.searchParams.get("until"), 40);
    if (sinceParam && !isIsoTs(sinceParam)) {
      return jsonErr(rid, "Ugyldig since (ISO timestamp).", 400, { code: "BAD_REQUEST", detail: { since: sinceParam } });
    }
    if (untilParam && !isIsoTs(untilParam)) {
      return jsonErr(rid, "Ugyldig until (ISO timestamp).", 400, { code: "BAD_REQUEST", detail: { until: untilParam } });
    }

    const auditSourceRaw = safeText(u.searchParams.get("auditSource") || u.searchParams.get("audit_source"), 12);
    const auditSource =
      auditSourceRaw === "system" || auditSourceRaw === "user" || auditSourceRaw === "ai"
        ? (auditSourceRaw as "system" | "user" | "ai")
        : undefined;

    const streamOperative = safeText(u.searchParams.get("stream"), 20) === "operative";
    const withEnterprise = streamOperative ? false : u.searchParams.get("withEnterprise") !== "0";

    const actorUserId = safeText(u.searchParams.get("actorUserId") || u.searchParams.get("actor_user_id"), 80);
    if (actorUserId && !isUuid(actorUserId)) {
      return jsonErr(rid, "Ugyldig actorUserId (uuid).", 400, {
        code: "BAD_REQUEST",
        detail: { actorUserId },
      });
    }

    const entityType = entityTypeRaw ? escapeForIlike(entityTypeRaw) : "";
    const actionFilter = actionRaw ? escapeForIlike(actionRaw) : "";
    const qSearch = qRaw ? escapeForIlike(qRaw) : "";

    /* =========================
       Service role client
    ========================= */
    let admin: ReturnType<typeof supabaseAdmin>;
    try {
      admin = supabaseAdmin();
    } catch (e: any) {
      return jsonErr(rid, String(e?.message ?? e), 500, "MISSING_SERVICE_ROLE_KEY");
    }

    const eventsTable = "audit_events" as const;

    /* =========================
       Query build — audit_events
    ========================= */
    let qb = admin
      .from(eventsTable)
      .select("id,created_at,rid,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Cursor pagination: only older than cursor
    if (cursor) qb = qb.lt("created_at", cursor);

    if (sinceParam) qb = qb.gte("created_at", sinceParam);
    if (untilParam) qb = qb.lte("created_at", untilParam);

    if (actorUserId) qb = qb.eq("actor_user_id", actorUserId);

    // Best-effort company filter:
    // If your audit table has company_id column it can be added to select+filters,
    // but we keep this safe: we try entity_id match (most important), plus companyId param as entity_id.
    if (streamOperative) {
      qb = qb.or(OPERATIVE_AUDIT_EVENTS_OR);
    }

    if (companyId) {
      qb = qb.or(`entity_id.eq.${companyId},detail->>company_id.eq.${companyId}`);
    }

    if (entityId) qb = qb.eq("entity_id", entityId);
    if (entityType) qb = qb.ilike("entity_type", `%${entityType}%`);
    if (actionFilter) qb = qb.ilike("action", `%${actionFilter}%`);

    // Search (OR over multiple columns)
    if (qSearch) {
      const like = `%${qSearch}%`;
      qb = qb.or(
        [
          `actor_email.ilike.${like}`,
          `action.ilike.${like}`,
          `entity_type.ilike.${like}`,
          `summary.ilike.${like}`,
          `rid.ilike.${like}`,
        ].join(",")
      );
    }

    const logPromise =
      withEnterprise === true
        ? getAuditLogs({
            since: sinceParam || undefined,
            until: untilParam || undefined,
            olderThan: cursor || undefined,
            actionIlike: actionRaw || undefined,
            entity: entityTypeRaw || undefined,
            entityId: entityId || undefined,
            source: auditSource,
            userId: actorUserId || undefined,
            companyId: companyId || undefined,
            limit,
          })
        : Promise.resolve([]);

    const [{ data: rows, error }, logRows] = await Promise.all([qb, logPromise]);

    if (error) {
      return jsonErr(rid, error.message, 500, {
        code: "READ_FAILED",
        detail: {
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        },
      });
    }

    const eventItems: AuditItem[] = (rows ?? []).map((x: any) => ({
      id: String(x.id),
      created_at: String(x.created_at),

      actor_user_id: x.actor_user_id ? String(x.actor_user_id) : null,
      actor_email: x.actor_email ? String(x.actor_email) : null,
      actor_role: x.actor_role ? String(x.actor_role) : null,

      action: x.action != null ? String(x.action) : null,
      entity_type: x.entity_type != null ? String(x.entity_type) : null,
      entity_id: x.entity_id != null ? String(x.entity_id) : null,

      summary: x.summary ? String(x.summary) : null,
      detail: x.detail ?? null,
    }));

    const logItems: AuditItem[] = logRows.map((r) => enterpriseAuditRowToSuperadminListItem(r));

    const includeLegacyEvents = auditSource == null;

    let merged: AuditItem[] =
      withEnterprise === true
        ? [...(includeLegacyEvents ? eventItems : []), ...logItems].sort((a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)),
          )
        : eventItems;

    if (qSearch && withEnterprise === true) {
      const needle = qRaw.trim().toLowerCase();
      merged = merged.filter((it) => {
        const blob = [
          it.actor_email,
          it.actor_user_id,
          it.action,
          it.entity_type,
          it.entity_id,
          it.summary,
          JSON.stringify(it.detail ?? {}),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(needle);
      });
    }

    merged = merged.slice(0, limit);

    const nextCursor = merged.length ? merged[merged.length - 1].created_at : null;

    const responseSource: ApiOk["meta"]["source"] = withEnterprise === true ? "merged" : "audit_events";

    const ok: ApiOk = {
      ok: true,
      rid,
      meta: {
        limit,
        nextCursor,
        source: responseSource,
        filters: {
          ...(cursor ? { cursor } : {}),
          ...(actionRaw ? { action: actionRaw } : {}),
          ...(entityTypeRaw ? { entityType: entityTypeRaw } : {}),
          ...(entityId ? { entityId } : {}),
          ...(companyId ? { companyId } : {}),
          ...(qRaw ? { q: qRaw } : {}),
          ...(sinceParam ? { since: sinceParam } : {}),
          ...(untilParam ? { until: untilParam } : {}),
          ...(auditSource ? { auditSource } : {}),
          withEnterprise,
          ...(actorUserId ? { actorUserId } : {}),
          ...(streamOperative ? { stream: "operative" as const } : {}),
        },
      },
      items: merged,
    };

    return jsonOk(rid, ok, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? "unknown");
    const err: ApiErr = { ok: false, rid, error: "SERVER_ERROR", message: msg };
    return jsonErr(rid, err.message || "Server error", 500, err);
  }
}


