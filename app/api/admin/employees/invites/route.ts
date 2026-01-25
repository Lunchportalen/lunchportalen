// app/api/admin/employees/invites/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeInt(v: any, def: number, min: number, max: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
function normQ(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

async function requireCompanyAdmin() {
  const sb = await supabaseServer();
  const { data: auth, error: uerr } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, disabled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (profile?.disabled_at) throw Object.assign(new Error("account_disabled"), { code: "account_disabled" });

  const roleDb = String(profile?.role ?? "").trim().toLowerCase();
  const roleMeta = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  const role = (roleDb || roleMeta || "employee") as Role;
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const companyId = profile?.company_id ? String(profile.company_id) : "";
  if (!companyId) throw Object.assign(new Error("missing_company"), { code: "missing_company" });

  return { companyId };
}

type InviteUiStatus = "active" | "used" | "expired";

function computeStatus(r: any): InviteUiStatus {
  if (r?.used_at) return "used";
  const exp = r?.expires_at ? new Date(r.expires_at).getTime() : 0;
  if (exp && exp < Date.now()) return "expired";
  return "active";
}

export async function GET(req: Request) {
  const rid = `inv_list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { companyId } = await requireCompanyAdmin();
    const admin = supabaseAdmin();

    const url = new URL(req.url);

    const q = normQ(url.searchParams.get("q") ?? url.searchParams.get("query") ?? "");
    const page = safeInt(url.searchParams.get("page"), 1, 1, 10_000);
    const limit = safeInt(url.searchParams.get("limit"), 50, 1, 200);

    // Filter switches (enterprise defaults):
    // - default: show ACTIVE only (not used, not expired)
    const includeExpired = String(url.searchParams.get("includeExpired") ?? "false").toLowerCase() === "true";
    const includeUsed = String(url.searchParams.get("includeUsed") ?? "false").toLowerCase() === "true";

    const nowIso = new Date().toISOString();

    /* =========================
       1) Stats (counts)
       ========================= */
    const statsTotalQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    const statsActiveQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .gt("expires_at", nowIso);

    const statsUsedQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("used_at", "is", null);

    const statsExpiredQ = admin
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .lt("expires_at", nowIso);

    const [stTotal, stActive, stUsed, stExpired] = await Promise.all([statsTotalQ, statsActiveQ, statsUsedQ, statsExpiredQ]);

    const statsErr = stTotal.error || stActive.error || stUsed.error || stExpired.error;
    if (statsErr) {
      return jsonError(500, "invites_stats_failed", "Kunne ikke hente invitasjonsstatistikk.", { rid, detail: statsErr });
    }

    const stats = {
      total: Number(stTotal.count ?? 0),
      active: Number(stActive.count ?? 0),
      used: Number(stUsed.count ?? 0),
      expired: Number(stExpired.count ?? 0),
    };

    /* =========================
       2) List (paged)
       ========================= */
    let query = admin
      .from("employee_invites")
      .select(
        "id, created_at, expires_at, used_at, last_sent_at, email, department, full_name, location_id, created_by_user_id, created_by_email",
        { count: "exact" }
      )
      .eq("company_id", companyId);

    // Default: ACTIVE only
    if (!includeUsed) query = query.is("used_at", null);
    if (!includeExpired) query = query.gt("expires_at", nowIso);

    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,department.ilike.%${q}%`);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

    if (error) return jsonError(500, "invites_list_failed", "Kunne ikke hente invitasjoner.", { rid, detail: error });

    return jsonOk({
      ok: true,
      rid,
      companyId,
      page,
      limit,
      total: Number(count ?? 0),

      // NEW: counts used by UI ("invitasjoner sendt")
      stats,

      invites: (data ?? []).map((r: any) => ({
        id: String(r.id),
        email: String(r.email),
        full_name: r.full_name ?? null,
        department: r.department ?? null,
        location_id: r.location_id ? String(r.location_id) : null,

        created_at: r.created_at ?? null,
        last_sent_at: r.last_sent_at ?? null,
        expires_at: r.expires_at ?? null,
        used_at: r.used_at ?? null,

        // NEW: helpful UI fields
        status: computeStatus(r), // active | used | expired
        created_by_user_id: r.created_by_user_id ? String(r.created_by_user_id) : null,
        created_by_email: r.created_by_email ?? null,
      })),
    });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.", { rid });
    if (code === "account_disabled") return jsonError(403, "account_disabled", "Kontoen er deaktivert.", { rid });
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.", { rid });
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.", { rid });
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", { rid, detail: e?.detail });
    return jsonError(500, "server_error", "Uventet feil.", { rid, detail: String(e?.message ?? e) });
  }
}

export async function POST() {
  return jsonError(405, "method_not_allowed", "Bruk GET for å liste invitasjoner.");
}
