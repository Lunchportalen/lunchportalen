import { requireRole } from "@/lib/auth/requireRole";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Body = {
  reportId: string;
  status?: "NEW" | "IN_PROGRESS" | "RESOLVED";
  internalNote?: string;
};

export async function PATCH(req: Request) {
  const rid = makeRid();
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return jsonErr(rid, "Ingen tilgang.", guard.status ?? 400, guard.error);

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.reportId) return jsonErr(rid, "reportId mangler.", 400, "Missing reportId");

  const patch: any = {};
  if (body.status) patch.status = body.status;
  if (typeof body.internalNote === "string") patch.internal_note = body.internalNote.trim();

  if (Object.keys(patch).length === 0) {
    return jsonErr(rid, "Ingen felter å oppdatere.", 400, "No fields to update");
  }

  const { data: updated, error: updErr } = await guard.supabase
    .from("quality_reports")
    .update(patch)
    .eq("id", body.reportId)
    .select("id,company_id,date,category,status,internal_note,updated_at")
    .single();

  if (updErr) return jsonErr(rid, "Databasefeil.", 500, { code: "DB error", detail: updErr.message });

  const note = `status=${body.status || "-"} note=${(body.internalNote || "").slice(0, 160)}`;
  const { error: logErr } = await guard.supabase.from("superadmin_audit_log").insert({
    actor_id: guard.userId,
    action: "RESOLVE_QUALITY",
    target_table: "quality_reports",
    target_id: body.reportId,
    note,
  });
  if (logErr) console.error("[superadmin_audit_log]", logErr.message);

  return jsonOk(rid, { ok: true, report: updated }, 200);
}
