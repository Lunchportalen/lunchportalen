// app/api/superadmin/users/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function safeInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (error || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  if (!(await isSuperadminProfile(user.id))) {
    throw Object.assign(new Error("forbidden"), { code: "forbidden" });
  }

  return user;
}

export async function GET(req: Request) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    await requireSuperadmin();
    const admin = supabaseAdmin();

    const url = new URL(req.url);
    const q = norm(url.searchParams.get("q") ?? "");
    const role = norm(url.searchParams.get("role") ?? "all"); // ALL | employee | company_admin | ...
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    // profiles + companies join
    let query = admin
      .from("profiles")
      .select(
        `
        user_id,
        email,
        name,
        role,
        company_id,
        is_active,
        disabled_at,
        created_at,
        companies:companies ( name )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (role !== "all") query = query.eq("role", role);

    if (q) {
      // Søk på email, name, company_id, company name
      query = query.or(
        `email.ilike.%${q}%,name.ilike.%${q}%,company_id::text.ilike.%${q}%,companies.name.ilike.%${q}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) return jsonErr(rid, "Kunne ikke hente brukere.", 500, { code: "list_failed", detail: error });

    return jsonOk(rid, {
      ok: true,
      rid,
      page,
      limit,
      total: Number(count ?? 0),
      users: (data ?? []).map((r: any) => ({
        user_id: String(r.user_id),
        email: r.email ?? null,
        name: r.name ?? null,
        role: r.role ?? null,
        company_id: r.company_id ? String(r.company_id) : null,
        company_name: r.companies?.name ?? null,
        is_active: r.is_active ?? null,
        disabled_at: r.disabled_at ?? null,
        created_at: r.created_at ?? null,
      })),
    }, 200);
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonErr(rid, "Ikke innlogget.", 401, "not_authenticated");
    if (code === "forbidden") return jsonErr(rid, "Ingen tilgang.", 403, "forbidden");
    return jsonErr(rid, "Uventet feil.", 500, { code: "server_error", detail: String(e?.message ?? e) });
  }
}
