import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";

type Body = {
  reportId: string;
  status?: "NEW" | "IN_PROGRESS" | "RESOLVED";
  internalNote?: string;
};

export async function PATCH(req: Request) {
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.reportId) return NextResponse.json({ ok: false, error: "Missing reportId" }, { status: 400 });

  const patch: any = {};
  if (body.status) patch.status = body.status;
  if (typeof body.internalNote === "string") patch.internal_note = body.internalNote.trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error: updErr } = await guard.supabase
    .from("quality_reports")
    .update(patch)
    .eq("id", body.reportId)
    .select("id,company_id,date,category,status,internal_note,updated_at")
    .single();

  if (updErr) return NextResponse.json({ ok: false, error: "DB error", detail: updErr.message }, { status: 500 });

  const note = `status=${body.status || "-"} note=${(body.internalNote || "").slice(0, 160)}`;
  const { error: logErr } = await guard.supabase.from("superadmin_audit_log").insert({
    actor_id: guard.userId,
    action: "RESOLVE_QUALITY",
    target_table: "quality_reports",
    target_id: body.reportId,
    note,
  });
  if (logErr) console.error("[superadmin_audit_log]", logErr.message);

  return NextResponse.json({ ok: true, report: updated });
}
