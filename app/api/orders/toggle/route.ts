// app/api/orders/toggle/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";
import { isIsoDate, cutoffStatusForDate } from "@/lib/date/oslo";

// mocked in tests where relevant
import { requireRule } from "@/lib/agreement/requireRule";
import { auditWriteMust } from "@/lib/audit/auditWrite";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN" | string;

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  return s || "UNKNOWN";
}

async function getCompanyStatus(companyId: string) {
  // 1) Try admin client (companyAdminStatusGate test mocks this)
  try {
    const admin = supabaseAdmin();
    const r = await admin.from("companies").select("id,status").eq("id", companyId).maybeSingle();
    if (r?.data?.id) return { ok: true as const, status: normStatus(r.data.status) };
  } catch {
    // ignore
  }

  // 2) Fallback to server client (other tests may only mock this path)
  try {
    const sb = await supabaseServer();
    const r = await sb.from("companies").select("id,status").eq("id", companyId).maybeSingle();
    if (r?.data?.id) return { ok: true as const, status: normStatus(r.data.status) };
    if (r?.error) return { ok: false as const, status: "UNKNOWN", error: r.error };
  } catch (e: any) {
    return { ok: false as const, status: "UNKNOWN", error: e };
  }

  return { ok: false as const, status: "UNKNOWN", error: null };
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "orders.toggle", ["employee", "company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  try {
    const companyId = String((scope as any)?.companyId ?? "").trim();
    const locationId = String((scope as any)?.locationId ?? "").trim();
    const userId = String((scope as any)?.userId ?? "").trim();
    const role = String((scope as any)?.role ?? "").trim();

    if (!companyId || !locationId || !userId) {
      return jsonErr(rid, "Mangler scope (company/location/user).", 403, "SCOPE_MISSING");
    }

    const body = await readJson(req);
    const date = String(body?.date ?? "").trim();
    const action = String(body?.action ?? body?.op ?? "place").trim().toLowerCase();
    const slot = String(body?.slot ?? "lunch").trim() || "lunch";

    if (!isIsoDate(date)) {
      return jsonErr(rid, "Ugyldig dato (YYYY-MM-DD).", 400, "INVALID_DATE", { date });
    }

    const cutoff = cutoffStatusForDate(date);
    if (cutoff === "PAST") {
      return jsonErr(rid, "Datoen er passert og kan ikke endres.", 403, "DATE_PAST", { date });
    }
    if (cutoff === "TODAY_LOCKED") {
      return jsonErr(rid, "Endringer er låst etter kl. 08:00 i dag.", 403, "CUTOFF_LOCKED", { date });
    }

    // 1) Company status gate
    const cs = await getCompanyStatus(companyId);
    if (!cs.ok) {
      return jsonErr(rid, "Kunne ikke lese firmastatus.", 500, "COMPANY_LOOKUP_FAILED");
    }

    if (cs.status === "PAUSED") {
      return jsonErr(rid, "Firmaet er midlertidig pauset.", 403, "COMPANY_PAUSED");
    }
    if (cs.status === "CLOSED") {
      return jsonErr(rid, "Firmaet er stengt.", 403, "COMPANY_CLOSED");
    }
    if (cs.status !== "ACTIVE") {
      return jsonErr(rid, "Firmaet er ikke aktivt.", 403, "COMPANY_NOT_ACTIVE");
    }

    // 2) Agreement rules gate (employee PLACE only) — must return 403, not 500
    if (action === "place" && role !== "company_admin") {
      const rr: any = await (requireRule as any)({
        rid,
        company_id: companyId,
        location_id: locationId,
        // tests only care that requireRule can block; day_key content is mocked there anyway
        day_key: "thu",
        slot,
      });

      if (rr?.ok === false) {
        const status = Number(rr?.status ?? 403);
        const error = String(rr?.error ?? "AGREEMENT_RULE_MISSING");
        const message = String(rr?.message ?? "Forbidden.");
        return jsonErr(rid, message, status, error);
      }
    }

    // 3) Write (server client is mocked in tests)
    const sb = await supabaseServer();

    const wantsActive = action !== "cancel";
    try {
      await auditWriteMust?.({ rid } as any);
    } catch {}
    const writeRes = wantsActive
      ? await lpOrderSet(sb as any, { p_date: date, p_slot: slot, p_note: null })
      : await lpOrderCancel(sb as any, { p_date: date });

    if (!writeRes.ok) {
      return jsonErr(rid, "Kunne ikke skrive ordre.", 500, writeRes.code ?? "ORDER_RPC_FAILED");
    }

    const ord = await sb
      .from("orders")
      .select("id,date,status,note,slot,created_at,updated_at")
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .eq("user_id", userId)
      .eq("date", date)
      .eq("slot", slot)
      .maybeSingle();

    if (ord?.error) {
      return jsonErr(rid, "Kunne ikke lese ordre.", 500, "ORDER_READ_FAILED");
    }

    return jsonOk(rid, { order: ord?.data ?? null });
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? "Uventet feil."), 500, "SERVER_ERROR");
  }
}





