// app/api/support/report/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { jsonOk, jsonErr } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}
function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = crypto.randomUUID();

  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHORIZED");

    const byEmail = roleByEmail(user.email);
    const role = byEmail ?? roleFromMetadata(user);

    if (role !== "superadmin" && role !== "company_admin") {
      return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").slice(0, 400);
    const path = String(body?.path ?? "").slice(0, 200);
    const company_id = String(body?.company_id ?? "") || null;
    const location_id = String(body?.location_id ?? "") || null;
    const agreement_id = String(body?.agreement_id ?? "") || null;
    const desired_change = String(body?.desired_change ?? "").slice(0, 2000) || null;
    const extra = body?.extra ?? null;

    // audit_events: anta at dere har kolonner som i prosjektet (id, created_at, actor_*, action, entity_type, entity_id, summary, detail)
    const { error } = await supabase.from("audit_events").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      actor_role: role,
      action: "support_report",
      entity_type: "admin",
      entity_id: agreement_id ?? company_id ?? user.id,
      summary: "Supportrapport sendt fra Admin",
      detail: {
        rid,
        reason,
        path,
        company_id,
        location_id,
        agreement_id,
        desired_change,
        extra,
        email: user.email ?? null,
        ts: new Date().toISOString(),
        user_agent: req.headers.get("user-agent"),
      },
    });

    if (error) return jsonErr(rid, "Kunne ikke logge supportrapport.", 500, { code: "DB_ERROR", detail: error });

    return jsonOk(rid, { stored: true }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}
