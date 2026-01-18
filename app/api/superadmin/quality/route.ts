import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function GET(req: Request) {
  const guard = await requireRole(["superadmin"]);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

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
  if (error) return NextResponse.json({ ok: false, error: "DB error", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reports: data });
}
