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
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "kitchen" || s === "kjokken") return "kitchen";
  if (s === "driver" || s === "sjafor") return "driver";
  return "employee";
}

function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

async function allowSuperadmin(req: NextRequest, rid: string): Promise<{ ok: true; actorId: string | null } | { ok: false; res: Response }> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const headerSecret = req.headers.get("x-cron-secret") || "";

  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    return { ok: true, actorId: null };
  }

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) return { ok: false, res: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED") };

    const hardRole = roleByEmail(user.email);
    if (hardRole === "superadmin") return { ok: true, actorId: user.id };

    const { data: profile } = await sb
      .from("profiles")
      .select("role, disabled_at, is_active")
      .eq("user_id", user.id)
      .maybeSingle<{ role: string | null; disabled_at: string | null; is_active: boolean | null }>();

    if (profile?.disabled_at || profile?.is_active === false) {
      return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN") };
    }

    const role = normalizeRole(profile?.role);
    if (role !== "superadmin") {
      return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN") };
    }

    return { ok: true, actorId: user.id };
  } catch {
    return { ok: false, res: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED") };
  }
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const gate = await allowSuperadmin(req, rid);
  if (gate.ok === false) return gate.res;

  const id = rid;
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

  // 2) Orders missing fields (company_id/location_id/slot/date)
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
        `order_missing_fields id=${o.id} date=${o.date ?? "null"} slot=${o.slot ?? "null"} company_id=${
          o.company_id ?? "null"
        } location_id=${o.location_id ?? "null"}`
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

  // 4) Critical data checks (recent orders)
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
    rid: id,
    ok,
    today,
    summary,
    anomalies,
    actor_id: gate.actorId,
  });

  if (!ok) {
    return jsonErr(id, "Daily sanity check feilet.", 500, { code: "SANITY_FAILED", detail: { summary, anomalies } });
  }

  return jsonOk(id, { ok, rid: id, summary, anomalies }, 200);
}
