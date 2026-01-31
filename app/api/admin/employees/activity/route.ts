// app/api/admin/employees/activity/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
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
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.activity", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  const body = await readJson(req);
  const idsRaw: unknown[] = Array.isArray((body as any)?.user_ids) ? (body as any).user_ids : [];

  const userIds: string[] = idsRaw.map((x) => String(x ?? "").trim()).filter((x): x is string => isUuid(x));

  if (userIds.length === 0) return jsonOk({ ok: true, rid, activity: [] as ActivityRow[] });

  if (userIds.length > 100) {
    return jsonErr(400, rid, "TOO_MANY_IDS", "Maks 100 user_ids per request.");
  }

  try {
    // 1) Verify all ids belong to this company AND are employees (tenant gate)
    const sb = await supabaseServer();

    const { data: rows, error: verErr } = await sb.from("profiles").select("user_id, company_id, role").in("user_id", userIds);

    if (verErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke verifisere ansatte.", verErr);

    const allowed = new Set<string>();
    for (const r of rows ?? []) {
      const rCompany = String((r as any).company_id ?? "");
      const rRole = String((r as any).role ?? "").toLowerCase();
      const rUserId = String((r as any).user_id ?? "");
      if (rCompany === companyId && rRole === "employee" && isUuid(rUserId)) allowed.add(rUserId);
    }

    for (const id of userIds) {
      if (!allowed.has(id)) return jsonErr(403, rid, "FORBIDDEN", "Ingen tilgang til én eller flere brukere.");
    }

    // 2) Fetch auth activity using service role
    const admin = supabaseAdmin();

    const activity = await mapLimit<string, ActivityRow>(userIds, 8, async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) return { user_id: id, invited_at: null, last_sign_in_at: null };

      const u = (data as any)?.user as any;
      return {
        user_id: id,
        invited_at: (u?.invited_at as string | null) ?? null,
        last_sign_in_at: (u?.last_sign_in_at as string | null) ?? null,
      };
    });

    return jsonOk({ ok: true, rid, activity });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


