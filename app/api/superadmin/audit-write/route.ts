// app/api/superadmin/audit-write/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function isMissingTable(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  // Postgres undefined_table = 42P01
  return code === "42P01" || msg.includes("does not exist");
}

function isMissingColumn(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  // Postgres undefined_column = 42703
  return (
    code === "42703" ||
    msg.includes("could not find the") ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("does not exist")
  );
}

type Body = {
  action: string;
  entityId: string; // company uuid
  summary?: string | null;
  detail?: any;
};

function clampDetail(input: any) {
  // ✅ prefer-const fix (binding reassignes aldri)
  const detail: any = input ?? null;

  try {
    const s = detail === null ? "" : JSON.stringify(detail);
    if (s.length > 20_000) return { truncated: true, bytes: s.length };
    return detail;
  } catch {
    return { unserializable: true };
  }
}

/**
 * ✅ TS-bombesikkert:
 * Vi returnerer "kind" som discriminant i stedet for ok/error,
 * da forsvinner VSCode/tsserver-problemene du ser i bildet.
 */
type InsertAuditResult =
  | { kind: "ok"; table: "audit_events" | "audit_log" }
  | { kind: "err"; error: "audit_table_missing" | "db_error"; detail: any };

async function insertAudit(sb: any, payload: any): Promise<InsertAuditResult> {
  // 1) Prøv audit_events (primær)
  const a = await sb.from("audit_events").insert(payload);
  if (!a.error) return { kind: "ok", table: "audit_events" };

  // 2) Fallback audit_log (hvis dere har den)
  if (isMissingTable(a.error) || isMissingColumn(a.error)) {
    const b = await sb.from("audit_log").insert(payload);
    if (!b.error) return { kind: "ok", table: "audit_log" };

    if (isMissingTable(b.error) || isMissingColumn(b.error)) {
      return {
        kind: "err",
        error: "audit_table_missing",
        detail: { audit_events: a.error, audit_log: b.error },
      };
    }

    return { kind: "err", error: "db_error", detail: b.error };
  }

  return { kind: "err", error: "db_error", detail: a.error };
}

/** supabaseAdmin kan være client eller factory */
async function adminClient(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

export async function POST(req: Request) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  try {
    // 0) Cookie-session (for å identifisere actor)
    const supabase = await supabaseServer();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const actor = userData?.user ?? null;

    if (userErr || !actor) {
      return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");
    }

    // ✅ Hard superadmin-fasit på e-post (ikke metadata)
    if (!isSuperadminEmail(actor.email)) {
      return jsonErr(rid, "Krever superadmin.", 403, "FORBIDDEN");
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || typeof body.action !== "string" || typeof body.entityId !== "string") {
      return jsonErr(rid, "Mangler action eller entityId.", 400, "BAD_REQUEST");
    }

    const action = body.action.trim().slice(0, 120);
    const entityId = body.entityId.trim();

    if (!action.length) return jsonErr(rid, "Ugyldig action.", 400, "BAD_REQUEST");
    if (!isUuid(entityId)) return jsonErr(rid, "Ugyldig entityId (uuid).", 400, "BAD_REQUEST");

    const summary =
      body.summary === undefined || body.summary === null ? null : String(body.summary).trim().slice(0, 500) || null;

    const detail = clampDetail(body.detail);

    // 1) Service role (audit skal aldri stoppes av RLS)
    let sb: any;
    try {
      sb = await adminClient();
    } catch (e: any) {
      return jsonErr(rid, "Mangler admin-konfigurasjon.", 500, { code: "SERVICE_ROLE_MISSING", detail: {
        error: String(e?.message ?? e),
      } });
    }

    const payload = {
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      actor_role: "superadmin",
      action,
      entity_type: "company",
      entity_id: entityId,
      summary,
      detail,
      created_at: new Date().toISOString(),
    };

    const ins = await insertAudit(sb, payload);

    if (ins.kind === "err") {
      if (ins.error === "audit_table_missing") {
        return jsonErr(rid, "Finner verken audit_events eller audit_log i databasen.", 500, { code: "AUDIT_TABLE_MISSING", detail: {
          hint: "Opprett audit-tabell (audit_events), eller endre route til eksisterende tabell.",
          detail: ins.detail,
        } });
      }

      return jsonErr(rid, "Kunne ikke skrive audit.", 500, { code: "DB_ERROR", detail: { detail: ins.detail } });
    }

    return jsonOk(rid, { ok: true, rid, storedIn: ins.table }, 200);
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? "unknown"), 500, "SERVER_ERROR");
  }
}

