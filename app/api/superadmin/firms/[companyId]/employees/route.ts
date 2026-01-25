// app/api/superadmin/firms/[companyId]/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function safeInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

async function requireSuperadmin() {
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (error || !user) throw new Error("not_authenticated");
  if (norm(user.email) !== "superadmin@lunchportalen.no") throw new Error("forbidden");
  return user;
}

export async function GET(req: Request, ctx: { params: { companyId: string } }) {
  const rid = `sa_emp_list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await requireSuperadmin();

    const companyId = String(ctx.params.companyId ?? "");
    const url = new URL(req.url);
    const q = norm(url.searchParams.get("q") ?? "");
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    const admin = supabaseAdmin();

    let query = admin
      .from("profiles")
      .select("user_id,email,name,department,location_id,is_active,disabled_at,created_at", { count: "exact" })
      .eq("company_id", companyId)
      .eq("role", "employee");

    if (q) {
      query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,department.ilike.%${q}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) return json({ ok: false, rid, error: "list_failed", message: "Kunne ikke hente ansatte.", detail: error }, 500);

    return json({
      ok: true,
      rid,
      page,
      limit,
      total: Number(count ?? 0),
      employees: (data ?? []).map((r: any) => ({
        user_id: String(r.user_id),
        email: r.email ?? null,
        name: r.name ?? null,
        department: r.department ?? null,
        location_id: r.location_id ? String(r.location_id) : null,
        is_active: Boolean(r.is_active),
        disabled_at: r.disabled_at ?? null,
        created_at: r.created_at ?? null,
      })),
    });
  } catch (e: any) {
    const m = String(e?.message ?? e);
    if (m === "not_authenticated") return json({ ok: false, rid, error: "not_authenticated" }, 401);
    if (m === "forbidden") return json({ ok: false, rid, error: "forbidden" }, 403);
    return json({ ok: false, rid, error: "server_error", detail: m }, 500);
  }
}
