import { requireRole } from "@/lib/auth/requireRole";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET(req: Request) {
  const rid = makeRid();
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return jsonErr(rid, "Ingen tilgang.", guard.status ?? 400, guard.error);

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // NEW|IN_PROGRESS|RESOLVED|null
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);

  let q = guard.supabase
    .from("quality_reports")
    .select("id,company_id,location_id,date,category,message,status,internal_note,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return jsonErr(rid, "Databasefeil.", 500, { code: "DB error", detail: error.message });

  return jsonOk(rid, { ok: true, reports: data }, 200);
}
