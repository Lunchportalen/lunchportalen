import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";

type Body = {
  companyId: string;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  reason?: string;
};

export async function PATCH(req: Request) {
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.companyId || !body?.status) {
    return NextResponse.json({ ok: false, error: "Missing companyId/status" }, { status: 400 });
  }

  const reason = (body.reason || "").trim();
  if ((body.status === "PAUSED" || body.status === "CLOSED") && reason.length < 3) {
    return NextResponse.json({ ok: false, error: "Reason required for PAUSED/CLOSED" }, { status: 400 });
  }

  const patch: any = { status: body.status };
  if (body.status === "PAUSED") patch.paused_reason = reason;
  if (body.status === "CLOSED") patch.closed_reason = reason;
  if (body.status === "ACTIVE") {
    patch.paused_reason = null;
    patch.closed_reason = null;
  }

  const { data: updated, error: updErr } = await guard.supabase
    .from("companies")
    .update(patch)
    .eq("id", body.companyId)
    .select("id,name,status,employee_count,paused_reason,closed_reason")
    .single();

  if (updErr) return NextResponse.json({ ok: false, error: "DB error", detail: updErr.message }, { status: 500 });

  // Audit log (light)
  const { error: logErr } = await guard.supabase.from("superadmin_audit_log").insert({
    actor_id: guard.userId,
    action: "SET_STATUS",
    target_table: "companies",
    target_id: body.companyId,
    note: `${body.status}${reason ? `: ${reason}` : ""}`,
  });

  if (logErr) {
    // Ikke blokker status-endring, men logg feilen i serverlog
    console.error("[superadmin_audit_log]", logErr.message);
  }

  return NextResponse.json({ ok: true, company: updated });
}
