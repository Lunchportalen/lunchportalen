// app/api/admin/employees/activity/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

/**
 * company_admin only: locked to own company via profiles.company_id
 */
async function requireCompanyAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();

  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const role = String(user.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, companyId: profile.company_id as string };
}

export type ActivityRow = {
  user_id: string;
  invited_at: string | null;
  last_sign_in_at: string | null;
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let idx = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  const rid = `emp_activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sb, companyId } = await requireCompanyAdmin();

    const body = await req.json().catch(() => ({} as any));
    const idsRaw: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : [];

    const userIds: string[] = idsRaw
      .map((x) => String(x ?? "").trim())
      .filter((x): x is string => isUuid(x));

    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, rid, activity: [] as ActivityRow[] }, { status: 200 });
    }

    if (userIds.length > 100) {
      return jsonError(400, "too_many_ids", "Maks 100 user_ids per request.", { rid });
    }

    // 1) Verify all ids belong to this company AND are employees
    const { data: rows, error: verErr } = await sb
      .from("profiles")
      .select("user_id, company_id, role")
      .in("user_id", userIds);

    if (verErr) return jsonError(500, "db_error", "Kunne ikke verifisere ansatte.", verErr);

    const allowed = new Set<string>();
    for (const r of rows ?? []) {
      const rCompany = String((r as any).company_id ?? "");
      const rRole = String((r as any).role ?? "").toLowerCase();
      const rUserId = String((r as any).user_id ?? "");
      if (rCompany === String(companyId) && rRole === "employee" && isUuid(rUserId)) {
        allowed.add(rUserId);
      }
    }

    // If any requested id is not allowed -> forbid (hard security)
    for (const id of userIds) {
      if (!allowed.has(id)) return jsonError(403, "forbidden", "Ingen tilgang til én eller flere brukere.", { rid });
    }

    // 2) Fetch auth activity using service role
    const admin = supabaseAdmin();

    // ✅ Tving TypeScript til å forstå at id er string
    const activity = await mapLimit<string, ActivityRow>(userIds, 8, async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);

      if (error) {
        return { user_id: id, invited_at: null, last_sign_in_at: null };
      }

      const u = data?.user as any;
      return {
        user_id: id,
        invited_at: (u?.invited_at as string | null) ?? null,
        last_sign_in_at: (u?.last_sign_in_at as string | null) ?? null,
      };
    });

    return NextResponse.json({ ok: true, rid, activity }, { status: 200 });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.");
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.");
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.");
    if (code === "role_mismatch") return jsonError(403, "role_mismatch", "Rolle mismatch mellom auth og profil.");
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", e?.detail);
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
