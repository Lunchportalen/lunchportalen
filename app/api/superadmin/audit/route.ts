// app/api/superadmin/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { isSuperadminEmail } from "@/lib/system/emails";
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
  // best-effort: nÃƒÂ¸ytraliser wildcard-tegn
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
    source: "audit_events";
    filters: {
      cursor?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      companyId?: string;
      q?: string;
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
========================================================= */
export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    /* =========================
       Auth (cookie) Ã¢â‚¬â€ fail-closed
    ========================= */
    const sb = await supabaseServer();
    const { data: userRes, error: authErr } = await sb.auth.getUser();
    const user = userRes?.user ?? null;

    if (authErr || !user) return jsonErr(rid, "Du mÃƒÂ¥ vÃƒÂ¦re innlogget.", 401, "AUTH_REQUIRED");

    // Ã¢Å“â€¦ Hard superadmin gate by email
    if (!isSuperadminEmail(user.email)) return jsonErr(rid, "Ikke tilgang.", 403, "FORBIDDEN");

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

    const source = "audit_events" as const;

    /* =========================
       Query build
       - Prefer audit_events (view/table). If you only have ops_events, create a view named audit_events.
    ========================= */
    let qb = admin
      .from(source)
      .select("id,created_at,rid,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Cursor pagination: only older than cursor
    if (cursor) qb = qb.lt("created_at", cursor);

    // Best-effort company filter:
    // If your audit table has company_id column it can be added to select+filters,
    // but we keep this safe: we try entity_id match (most important), plus companyId param as entity_id.
    if (companyId) {
      // If your logs use entity_id for company, this works immediately:
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

    const { data: rows, error } = await qb;

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

    const items: AuditItem[] = (rows ?? []).map((x: any) => ({
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

    const nextCursor = items.length ? items[items.length - 1].created_at : null;

    const ok: ApiOk = {
      ok: true,
      rid,
      meta: {
        limit,
        nextCursor,
        source,
        filters: {
          ...(cursor ? { cursor } : {}),
          ...(actionRaw ? { action: actionRaw } : {}),
          ...(entityTypeRaw ? { entityType: entityTypeRaw } : {}),
          ...(entityId ? { entityId } : {}),
          ...(companyId ? { companyId } : {}),
          ...(qRaw ? { q: qRaw } : {}),
        },
      },
      items,
    };

    return jsonOk(rid, ok, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? "unknown");
    const err: ApiErr = { ok: false, rid, error: "SERVER_ERROR", message: msg };
    return jsonErr(rid, err.message || "Server error", 500, err);
  }
}


