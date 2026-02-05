// app/api/superadmin/companies/[companyId]/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function dateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const ALLOWED_LIMITS = new Set([10, 25, 50, 100]);
function normalizeLimit(v: string | null, fallback: number) {
  const n = asInt(v, fallback);
  return ALLOWED_LIMITS.has(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.orders.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const url = new URL(req.url);
  const fromQ = safeStr(url.searchParams.get("from"));
  const toQ = safeStr(url.searchParams.get("to"));
  const statusQ = safeStr(url.searchParams.get("status")).toUpperCase();

  const page = clamp(asInt(url.searchParams.get("page"), 1) || 1, 1, 1_000_000);
  const limit = normalizeLimit(url.searchParams.get("limit"), 25);
  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  const now = new Date();
  const defaultTo = dateISO(now);
  const defaultFrom = dateISO(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));

  const from = isISODate(fromQ) ? fromQ : defaultFrom;
  const to = isISODate(toQ) ? toQ : defaultTo;

  if (!isISODate(from) || !isISODate(to)) {
    return jsonErr(a.rid, "Ugyldig periode.", 400, "BAD_REQUEST");
  }
  if (from > to) {
    return jsonErr(a.rid, "Fra-dato kan ikke være etter til-dato.", 400, "BAD_REQUEST");
  }

  const status = statusQ && statusQ !== "ALL" ? statusQ : "ALL";

  const admin = supabaseAdmin();

  let countQuery = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);

  if (status !== "ALL") countQuery = countQuery.eq("status", status);

  const { count, error: countError } = await countQuery;
  if (countError) {
    console.error("[api/superadmin/companies/orders] count failed", errDetail(countError));
    return jsonErr(a.rid, countError.message, 500, "DB_ERROR");
  }

  const total = Number(count ?? 0);

  let warning: string | null = null;

  const selectCols = "id,date,status,slot,created_at,user_id,note,unit_price,currency";
  const selectFallback = "id,date,status,slot,created_at,user_id,note,currency";

  let data: any[] | null | undefined;
  let error: any;

  ({ data, error } = await admin
    .from("orders")
    .select(selectCols)
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx));

  if (error && isMissingColumn(error)) {
    warning = "Mangler unit_price på orders – kan ikke beregne historisk økonomi korrekt.";
    ({ data, error } = await admin
      .from("orders")
      .select(selectFallback)
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx));
  }

  if (error) {
    console.error("[api/superadmin/companies/orders] list failed", errDetail(error));
    return jsonErr(a.rid, error.message, 500, "DB_ERROR");
  }

  const rows = (data ?? []) as any[];

  const userIds = Array.from(new Set(rows.map((r) => safeStr(r?.user_id)).filter(Boolean)));
  const userMap = new Map<string, { label: string | null }>();

  if (userIds.length) {
    const { data: profData, error: profError } = await admin
      .from("profiles")
      .select("user_id,email,name,full_name")
      .in("user_id", userIds);

    if (!profError) {
      for (const r of profData ?? []) {
        const uid = safeStr((r as any)?.user_id);
        if (!uid) continue;
        const full = safeStr((r as any)?.full_name);
        const name = safeStr((r as any)?.name);
        const email = safeStr((r as any)?.email);
        userMap.set(uid, { label: full || name || email || uid });
      }
    }
  }

  let sum: number | null = null;
  if (!warning) {
    let totalSum = 0;
    let missing = false;
    for (const r of rows) {
      const v = toNum((r as any)?.unit_price);
      if (v === null) {
        missing = true;
        break;
      }
      totalSum += v;
    }
    if (missing) {
      warning = "Mangler unit_price på orders – kan ikke beregne historisk økonomi korrekt.";
    } else {
      sum = totalSum;
    }
  }

  const currency = rows.map((r) => safeStr((r as any)?.currency)).find(Boolean) ?? null;

  const items = rows.map((r) => {
    const uid = safeStr(r?.user_id);
    return {
      id: safeStr(r?.id),
      date: r?.date ?? null,
      status: r?.status ?? null,
      slot: r?.slot ?? null,
      created_at: r?.created_at ?? null,
      user_id: uid || null,
      employee_label: userMap.get(uid)?.label ?? null,
      note: r?.note ?? null,
      unit_price: r?.unit_price ?? null,
      currency: r?.currency ?? null,
    };
  });

  return jsonOk(
    a.rid,
    {
      items,
      count: total,
      sum,
      warning,
      currency,
      page,
      limit,
      range: { from, to },
      status,
    },
    200
  );
}
