// app/api/superadmin/audit/[id]/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = {
  params: { id: string } | Promise<{ id: string }>;
};

function isUuid(v: string) {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(
    v
  );
}

export async function GET(_req: Request, ctx: Ctx) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  const params = await ctx.params;
  const id = String((params as any)?.id ?? "").trim();

  if (!isUuid(id)) {
    return jsonErr(rid, "Ugyldig audit-id", 400, "invalid_id");
  }

  const supabase = await supabaseServer();

  // --- auth ---
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return jsonErr(rid, "Ikke innlogget", 401, "unauthorized");
  }

  if (!(await isSuperadminProfile(user.id))) {
    return jsonErr(rid, "Kun superadmin har tilgang", 403, "forbidden");
  }

  // --- fetch audit ---
  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? e), 500, "missing_service_role_client");
  }

  // Velg kun felt vi faktisk trenger (stabil API-kontrakt)
  const { data, error } = await admin
    .from("audit_events")
    .select("id,created_at,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return jsonErr(rid, "Kunne ikke hente audit-hendelse", 500, { code: "read_failed", detail: { db: error } });
  }

  if (data) {
    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        audit: {
          id: data.id,
          created_at: data.created_at,
          actor_user_id: data.actor_user_id ?? null,
          actor_email: data.actor_email ?? null,
          actor_role: data.actor_role ?? null,
          action: data.action,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          summary: data.summary ?? null,
          detail: data.detail ?? null,
          audit_stream: "audit_events" as const,
        },
      },
      200,
    );
  }

  const { data: logRow, error: logErr } = await admin
    .from("audit_logs")
    .select("id,created_at,user_id,company_id,action,resource,metadata")
    .eq("id", id)
    .maybeSingle();

  if (logErr) {
    return jsonErr(rid, "Kunne ikke hente audit-hendelse", 500, { code: "read_failed", detail: { db: logErr } });
  }

  if (!logRow) {
    return jsonErr(rid, "Audit-hendelse finnes ikke", 404, "not_found");
  }

  const meta =
    logRow.metadata && typeof logRow.metadata === "object" && !Array.isArray(logRow.metadata)
      ? (logRow.metadata as Record<string, unknown>)
      : {};

  const ent =
    typeof meta.entity === "string" ? meta.entity : String(logRow.resource ?? "").split("#")[0] || "unknown";
  const eid =
    meta.entity_id != null
      ? String(meta.entity_id)
      : String(logRow.resource ?? "").includes("#")
        ? String(logRow.resource).split("#").slice(1).join("#")
        : "";

  const source = typeof meta.source === "string" ? meta.source : "unknown";

  return jsonOk(
    rid,
    {
      ok: true,
      rid,
      audit: {
        id: String(logRow.id),
        created_at: String(logRow.created_at),
        actor_user_id: logRow.user_id != null ? String(logRow.user_id) : null,
        actor_email: null,
        actor_role: typeof meta.actor_role === "string" ? meta.actor_role : null,
        action: String(logRow.action ?? ""),
        entity_type: ent,
        entity_id: eid,
        summary: `${source} · ${String(logRow.action ?? "")}`,
        detail: {
          before: meta.before ?? null,
          after: meta.after ?? null,
          source: meta.source ?? null,
          resource: logRow.resource,
          company_id: logRow.company_id,
          event_id: meta.event_id ?? null,
          timestamp_ms: meta.timestamp_ms ?? null,
          extra: meta,
        },
        audit_stream: "audit_logs" as const,
      },
    },
    200,
  );
}
