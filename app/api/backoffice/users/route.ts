import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q as qParam } from "@/lib/http/routeGuard";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
  is_active: boolean | null;
};

type UserListItem = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  company_id: string | null;
  is_active: boolean;
};

function normalizeProfileRow(row: any): UserListItem | null {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const email = typeof row.email === "string" ? row.email.trim() || null : null;
  const name =
    (typeof row.full_name === "string" && row.full_name.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    (typeof row.display_name === "string" && row.display_name.trim()) ||
    null;
  const role = typeof row.role === "string" ? row.role.trim() || null : null;
  const company_id =
    typeof row.company_id === "string" && row.company_id.trim() ? row.company_id.trim() : null;
  const is_active = row.is_active === true;

  return {
    id,
    email,
    name,
    role,
    company_id,
    is_active,
  };
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;

  // Only superadmin may see global user list in this MVP.
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const searchRaw = qParam(request, "q") ?? "";
  const search = searchRaw.trim();

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    let query = supabase
      .from("profiles")
      .select("id,email,full_name,role,company_id,is_active")
      .order("created_at", { ascending: false })
      .limit(100);

    if (search) {
      // Simple case-insensitive search across email and full_name.
      // Uses ilike on email; name filter is skipped if not available.
      query = query.ilike("email", `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      const msg = typeof (error as any)?.message === "string" ? (error as any).message : "Kunne ikke hente brukere.";
      return jsonErr(ctx.rid, msg, 500, "USERS_LIST_FAILED");
    }

    const rows = Array.isArray(data) ? (data as ProfileRow[]) : [];
    const items: UserListItem[] = rows
      .map((r) => normalizeProfileRow(r))
      .filter((it): it is UserListItem => it != null);

    return jsonOk(ctx.rid, { items }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kunne ikke hente brukere.";
    return jsonErr(ctx.rid, msg, 500, "USERS_LIST_FAILED");
  }
}

