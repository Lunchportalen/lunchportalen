// app/api/kitchen/day/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import { fetchKitchenDayData } from "@/lib/kitchen/dayData";
import { isAfterCutoff0800 } from "@/lib/kitchen/cutoff";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeRole(v: any): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  return "employee";
}

export async function GET(req: NextRequest) {
  const rid = `kday_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");

    const admin = supabaseAdmin();
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("role, disabled_at, is_active, company_id, location_id")
    .or(`id.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
    .maybeSingle();

    if (pErr || !profile) return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");
    if (profile.disabled_at || profile.is_active === false) return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");

    const role = normalizeRole(profile.role);
    if (role !== "kitchen" && role !== "superadmin") return jsonErr(rid, "Forbudt.", 403, "FORBIDDEN");

    const companyId = safeStr(profile.company_id);
    const locationId = safeStr(profile.location_id);
    if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

    const url = new URL(req.url);
    const dateParam = safeStr(url.searchParams.get("date"));
    const slotParam = safeStr(url.searchParams.get("slot"));
    const dateISO = dateParam && isIsoDate(dateParam) ? dateParam : osloTodayISODate();
    const slot = slotParam ? slotParam : null;

    const cutoff = isAfterCutoff0800(dateISO);
    const { groups } = await fetchKitchenDayData({
      admin,
      dateISO,
      companyId,
      locationId: locationId || null,
      slot,
      rid,
      cutoffAtUTCISO: cutoff.cutoffAt,
      afterCutoff: cutoff.after,
    });

    return jsonOk(rid, {
      ok: true,
      rid,
      date: dateISO,
      groups,
    });
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente kjøkkenliste.", 500, { code: "KITCHEN_DAY_FAILED", detail: String(e?.message ?? e) });
  }
}
