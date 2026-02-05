export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Ikke innlogget" };

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return { ok: false as const, status: 403, message: "Ingen tilgang" };

  return { ok: true as const };
}

export async function GET(_: Request, ctx: { params: { runId: string } }) {
  const rid = makeRid();
  const guard = await requireSuperadmin();
  if (!guard.ok) return jsonErr(rid, guard.message, guard.status ?? 400, "AUTH");

  const runId = ctx.params.runId;
  if (!isUuid(runId)) return jsonErr(rid, "Ugyldig runId", 400, "BAD_REQUEST");

  const db = await adminDb();
  if (!db?.from) return jsonErr(rid, "supabaseAdmin er ikke tilgjengelig (mangler .from)", 500, "ADMIN_CLIENT_MISSING");

  const { data, error } = await db
    .from("invoice_exports")
    .select("id, exported_at, exported_by, status, file_name, rows_count, amount_ex_vat, detail")
    .eq("run_id", runId)
    .order("exported_at", { ascending: false })
    .limit(25);

  if (error) return jsonErr(rid, "Kunne ikke hente eksportlogg", 500, { code: "DB", detail: error });

  return jsonOk(rid, { exports: data ?? [] });
}
