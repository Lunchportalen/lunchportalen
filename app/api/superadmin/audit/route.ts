// app/api/superadmin/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isIsoTs(v: any) {
  // enkel sjekk for ISO timestamp (brukes som cursor)
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !isNaN(Date.parse(v));
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

function clampInt(v: any, min: number, max: number, def: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeText(v: any, maxLen: number) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.slice(0, maxLen);
}

function escapeForIlike(v: string) {
  // best-effort: unngå wildcard-injeksjon
  // NB: Supabase PostgREST støtter ikke alltid ESCAPE-klause via klienten,
  // men vi "nøytraliserer" % og _ så brukeren ikke kan styre wildcardene.
  return v.replace(/[%_]/g, (m) => `\\${m}`);
}

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

/**
 * GET /api/superadmin/audit
 * Query:
 *  - limit=1..500 (default 300)
 *  - cursor=<created_at ISO> (pagination; fetch older than cursor)
 *  - companyId=<uuid> (optional filter; matches entity_id i audit_events)
 *  - action=<string> (optional filter, ilike)
 *  - q=<string> (optional search; actor_email/action/entity_type/summary)
 *
 * Returns:
 *  { ok:true, items:[], meta:{ limit, nextCursor, source } }
 */
export async function GET(req: Request) {
  const rid = `sa_audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth (cookie)
    const supabase = await supabaseServer();
    const { data, error: authErr } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (authErr || !user) {
      return json(401, { ok: false, error: "AUTH_REQUIRED", rid });
    }

    // ✅ Hard superadmin-fasit (unngå metadata-triksing)
    const email = normEmail(user.email);
    if (email !== "superadmin@lunchportalen.no") {
      return json(403, { ok: false, error: "FORBIDDEN", rid });
    }

    // Parse query
    const u = new URL(req.url);

    const limit = clampInt(u.searchParams.get("limit") ?? "300", 1, 500, 300);

    const cursor = u.searchParams.get("cursor");
    if (cursor && !isIsoTs(cursor)) {
      return json(400, {
        ok: false,
        error: "BAD_REQUEST",
        message: "Ugyldig cursor (ISO timestamp).",
        rid,
      });
    }

    const companyId = u.searchParams.get("companyId");
    if (companyId && !isUuid(companyId)) {
      return json(400, {
        ok: false,
        error: "BAD_REQUEST",
        message: "Ugyldig companyId (uuid).",
        rid,
      });
    }

    const actionFilterRaw = safeText(u.searchParams.get("action"), 120);
    const qRaw = safeText(u.searchParams.get("q"), 120);

    const actionFilter = actionFilterRaw ? escapeForIlike(actionFilterRaw) : "";
    const qSearch = qRaw ? escapeForIlike(qRaw) : "";

    // Service role
    let admin: ReturnType<typeof supabaseAdmin>;
    try {
      admin = supabaseAdmin();
    } catch (e: any) {
      return json(500, {
        ok: false,
        error: "MISSING_SERVICE_ROLE_KEY",
        message: String(e?.message ?? e),
        rid,
      });
    }

    // ✅ Prod-standard: audit_events (ingen legacy fallback)
    const source: "audit_events" = "audit_events";

    // Bygg query
    let qb = admin
      .from("audit_events")
      .select(
        "id,created_at,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) qb = qb.lt("created_at", cursor);
    if (companyId) qb = qb.eq("entity_id", companyId);
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
        detail: error,
      });
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

    return json(200, {
      ok: true,
      rid,
      meta: { limit, nextCursor, source },
      items: safeItems,
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: "SERVER_ERROR",
      message: String(e?.message ?? "unknown"),
      rid,
    });
  }
}
