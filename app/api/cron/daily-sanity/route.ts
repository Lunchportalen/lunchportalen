// app/api/cron/daily-sanity/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { systemRoleByEmail } from "@/lib/system/emails";
import { requireCronAuth as requireCronAuthShared } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

/* =========================================================
   Cron auth (standardized)
   - Primary: Authorization: Bearer <CRON_SECRET>
   - Fallback: x-cron-secret: <CRON_SECRET>
========================================================= */
function requireCronAuth(req: NextRequest) {
  return requireCronAuthShared(req);
}

/**
 * Allow:
 * - Cron caller (secret) -> ok
 * - Superadmin (session) -> ok
 * Fail-closed otherwise
 */
async function allowSuperadminOrCron(
  req: NextRequest,
  rid: string
): Promise<{ ok: true; actorId: string | null; mode: "cron" | "superadmin" } | { ok: false; res: Response }> {
  // 1) Cron secret (preferred for scheduled runs)
  try {
    requireCronAuth(req);
    return { ok: true, actorId: null, mode: "cron" };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    // If CRON_SECRET missing -> configuration error, but still allow superadmin session.
    // In staging/prod, CRON_SECRET MUST exist (CODEX STOP THE LINE).
    const isCronAuthFail = msg === "forbidden" || code === "forbidden";
    const isCronMisconf = msg === "cron_secret_missing" || code === "cron_secret_missing";

    // Any other unexpected errors -> block hard
    if (!isCronAuthFail && !isCronMisconf) {
      return {
        ok: false,
        res: jsonErr(rid, "Uventet feil i cron-gate.", 500, {
          code: "CRON_GATE_ERROR",
          detail: { message: msg },
        }),
      };
    }
  }

  // 2) Superadmin session fallback
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) return { ok: false, res: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED") };

    // Hard role override by email (systemRoleByEmail)
    const hardRole = roleByEmail(user.email);
    if (hardRole === "superadmin") return { ok: true, actorId: user.id, mode: "superadmin" };

    // Profile role (IMPORTANT: profiles primary key is usually `id` == auth.users.id)
    // We check both `id` and legacy `user_id` to be robust during migrations.
    const p1 = await sb
      .from("profiles")
      .select("id, role, disabled_at, is_active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; role: string | null; disabled_at: string | null; is_active: boolean | null }>();

    const p2 =
      p1.data || !p1.error
        ? null
        : await sb
            .from("profiles")
            .select("id, role, disabled_at, is_active")
            .eq("user_id", user.id)
            .maybeSingle<{ id: string; role: string | null; disabled_at: string | null; is_active: boolean | null }>();

    const profile = (p1.data ?? p2?.data ?? null) as {
      role: string | null;
      disabled_at: string | null;
      is_active: boolean | null;
    } | null;

    if (profile?.disabled_at || profile?.is_active === false) {
      return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN") };
    }

    const role = normalizeRoleDefaultEmployee(profile?.role);
    if (role !== "superadmin") {
      return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN") };
    }

    return { ok: true, actorId: user.id, mode: "superadmin" };
  } catch {
    return { ok: false, res: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED") };
  }
}

/* =========================================================
   GET /api/cron/daily-sanity
========================================================= */
export async function GET(req: NextRequest) {
  const rid = makeRid();

  const gate = await allowSuperadminOrCron(req, rid);
  if (gate.ok === false) return gate.res;

  const today = osloTodayISODate();
  const admin = supabaseAdmin();

  const anomalies: string[] = [];

  const summary: Record<string, any> = {
    orders_today_total: 0,
    orders_today_by_status: {},
    anomalies: 0,
    company_admin_without_profile: 0,
  };

  let ok = true;

  // 1) Orders today by status
  try {
    const { data, error } = await admin.from("orders").select("status").eq("date", today);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const s = String((row as any).status ?? "unknown");
      counts[s] = (counts[s] ?? 0) + 1;
    }

    summary.orders_today_by_status = counts;
    summary.orders_today_total = (data ?? []).length;
  } catch {
    ok = false;
    anomalies.push("orders_today_query_failed");
  }

  // 2) Orders missing fields
  try {
    const { data, error } = await admin
      .from("orders")
      .select("id, date, slot, company_id, location_id")
      .or("company_id.is.null,location_id.is.null,slot.is.null,date.is.null")
      .limit(20);
    if (error) throw error;

    for (const row of data ?? []) {
      if (anomalies.length >= 20) break;
      const o: any = row;
      anomalies.push(
        `order_missing_fields id=${o.id} date=${o.date ?? "null"} slot=${o.slot ?? "null"} company_id=${o.company_id ?? "null"} location_id=${o.location_id ?? "null"}`
      );
    }
  } catch {
    ok = false;
    if (anomalies.length < 20) anomalies.push("orders_missing_fields_query_failed");
  }

  // 3) company_admin in metadata but no profile
  try {
    const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = res.data?.users ?? [];

    const adminUsers = users.filter((u) => {
      const r1 = String((u.user_metadata as any)?.role ?? "").toLowerCase();
      const r2 = String((u.app_metadata as any)?.role ?? "").toLowerCase();
      return r1 === "company_admin" || r2 === "company_admin";
    });

    const ids = adminUsers.map((u) => u.id);
    if (ids.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id").in("id", ids);
      const hasProfile = new Set((profiles ?? []).map((p: any) => p.id));

      const missing = adminUsers.filter((u) => !hasProfile.has(u.id));
      summary.company_admin_without_profile = missing.length;

      for (const u of missing.slice(0, Math.max(0, 20 - anomalies.length))) {
        anomalies.push(`company_admin_missing_profile id=${u.id} email=${u.email ?? "unknown"}`);
      }
    }
  } catch {
    ok = false;
    if (anomalies.length < 20) anomalies.push("company_admin_profile_check_failed");
  }

  // 4) Recent orders scan
  try {
    const { data } = await admin
      .from("orders")
      .select("id, created_at, updated_at, date")
      .order("created_at", { ascending: false })
      .limit(500);

    for (const row of data ?? []) {
      if (anomalies.length >= 20) break;
      const o: any = row;
      const created = new Date(o.created_at).getTime();
      const updated = new Date(o.updated_at).getTime();

      if (Number.isFinite(created) && Number.isFinite(updated) && updated < created) {
        anomalies.push(`order_updated_before_created id=${o.id}`);
      }

      if (o.date && !isIsoDate(o.date)) {
        anomalies.push(`order_invalid_iso_date id=${o.id} date=${o.date}`);
      }
    }
  } catch {
    ok = false;
    if (anomalies.length < 20) anomalies.push("orders_recent_scan_failed");
  }

  summary.anomalies = anomalies.length;

  opsLog("cron.daily-sanity", {
    rid,
    ok,
    today,
    summary,
    anomalies,
    actor_id: gate.actorId,
    mode: gate.mode,
  });

  if (!ok) {
    return jsonErr(rid, "Daily sanity check feilet.", 500, { code: "SANITY_FAILED", detail: { summary, anomalies } });
  }

  return jsonOk(rid, { ok, rid, summary, anomalies }, 200);
}




