// app/api/superadmin/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   Response helpers (no-store)
========================================================= */
function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  } as const;
}
function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

/* =========================================================
   Utils
========================================================= */
function makeRid() {
  return `sa_audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
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
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !isNaN(Date.parse(v));
}
function escapeForIlike(v: string) {
  // best-effort: nøytraliser wildcard-tegn
  return v.replace(/[%_]/g, (m) => `\\${m}`);
}

/* =========================================================
   Supabase admin (service role)
========================================================= */
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
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

  action: string;
  entity_type: string;
  entity_id: string;

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
    - companyId=<uuid> (optional filter; matches company_id in audit_events)
    - entityType=<string> (optional exact/ilike)
    - entityId=<uuid> (optional exact)
    - action=<string> (optional filter, ilike)
    - q=<string> (optional search; actor_email/action/entity_type/summary/rid)
========================================================= */
export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    /* =========================
       Auth (cookie)
    ========================= */
    const supabase = await supabaseServer();
    const { data, error: authErr } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (authErr || !user) {
      return json(401, { ok: false, error: "AUTH_REQUIRED", message: "Du må være innlogget.", rid } satisfies ApiErr);
    }

    // ✅ Superadmin gate (hard-fasit epost)
    const email = normEmail(user.email);
    if (email !== "superadmin@lunchportalen.no") {
      return json(403, { ok: false, error: "FORBIDDEN", message: "Ikke tilgang.", rid } satisfies ApiErr);
    }

    /* =========================
       Parse query
    ========================= */
    const u = new URL(req.url);

    const limit = clampInt(u.searchParams.get("limit") ?? "300", 1, 500, 300);

    const cursor = safeText(u.searchParams.get("cursor"), 60);
    if (cursor && !isIsoTs(cursor)) {
      return json(400, {
        ok: false,
        error: "BAD_REQUEST",
        message: "Ugyldig cursor (ISO timestamp).",
        rid,
        detail: { cursor },
      } satisfies ApiErr);
    }

    const companyId = safeText(u.searchParams.get("companyId"), 80);
    if (companyId && !isUuid(companyId)) {
      return json(400, {
        ok: false,
        error: "BAD_REQUEST",
        message: "Ugyldig companyId (uuid).",
        rid,
        detail: { companyId },
      } satisfies ApiErr);
    }

    const entityId = safeText(u.searchParams.get("entityId"), 80);
    if (entityId && !isUuid(entityId)) {
      return json(400, {
        ok: false,
        error: "BAD_REQUEST",
        message: "Ugyldig entityId (uuid).",
        rid,
        detail: { entityId },
      } satisfies ApiErr);
    }

    const entityTypeRaw = safeText(u.searchParams.get("entityType"), 60);
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
      return json(500, {
        ok: false,
        error: "MISSING_SERVICE_ROLE_KEY",
        message: String(e?.message ?? e),
        rid,
      } satisfies ApiErr);
    }

    const source = "audit_events" as const;

    /* =========================
       Query build
    ========================= */
    let qb = admin
      .from("audit_events")
      .select(
        "id,created_at,rid,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,company_id,location_id,summary,detail"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) qb = qb.lt("created_at", cursor);

    if (companyId) qb = qb.eq("company_id", companyId);
    if (entityId) qb = qb.eq("entity_id", entityId);
    if (entityType) qb = qb.ilike("entity_type", `%${entityType}%`);
    if (actionFilter) qb = qb.ilike("action", `%${actionFilter}%`);

    // 🔎 Søk (OR over flere felt)
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

    const { data: items, error } = await qb;

    if (error) {
      return json(500, {
        ok: false,
        error: "READ_FAILED",
        message: error.message,
        rid,
        detail: { code: error.code, details: (error as any).details, hint: (error as any).hint },
      } satisfies ApiErr);
    }

    const safeItems: AuditItem[] = (items ?? []).map((x: any) => ({
      id: String(x.id),
      created_at: String(x.created_at),

      actor_user_id: x.actor_user_id ? String(x.actor_user_id) : null,
      actor_email: x.actor_email ? String(x.actor_email) : null,
      actor_role: x.actor_role ? String(x.actor_role) : null,

      action: String(x.action),
      entity_type: String(x.entity_type),
      entity_id: String(x.entity_id),

      summary: x.summary ? String(x.summary) : null,
      detail: x.detail ?? null,
    }));

    const nextCursor = safeItems.length ? safeItems[safeItems.length - 1].created_at : null;

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
      items: safeItems,
    };

    return json(200, ok);
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "SERVER_ERROR",
      message: String(e?.message ?? "unknown"),
      rid,
    } satisfies ApiErr);
  }
}
