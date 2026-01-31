// app/api/support/report/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}
function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function jsonError(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status });
}

export async function POST(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = crypto.randomUUID();

  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) return jsonError(401, rid, "UNAUTHORIZED", "Du må være innlogget.");

    const byEmail = roleByEmail(user.email);
    const role = byEmail ?? roleFromMetadata(user);

    if (role !== "superadmin" && role !== "company_admin") {
      return jsonError(403, rid, "FORBIDDEN", "Ingen tilgang.");
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").slice(0, 400);
    const path = String(body?.path ?? "").slice(0, 200);
    const company_id = String(body?.company_id ?? "") || null;
    const location_id = String(body?.location_id ?? "") || null;

    // audit_events: anta at dere har kolonner som i prosjektet (id, created_at, actor_*, action, entity_type, entity_id, summary, detail)
    const { error } = await supabase.from("audit_events").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      actor_role: role,
      action: "support_report",
      entity_type: "admin",
      entity_id: company_id ?? user.id,
      summary: "Supportrapport sendt fra Admin",
      detail: {
        rid,
        reason,
        path,
        company_id,
        location_id,
        email: user.email ?? null,
        ts: new Date().toISOString(),
        user_agent: req.headers.get("user-agent"),
      },
    });

    if (error) return jsonError(500, rid, "DB_ERROR", "Kunne ikke logge supportrapport.", error);

    return NextResponse.json({ ok: true, rid }, { status: 200 });
  } catch (e: any) {
    return jsonError(500, rid, "SERVER_ERROR", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}



