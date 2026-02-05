// app/api/kitchen/companies/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type BatchStatus = "queued" | "packed" | "delivered";

type ApiCompanyTotals = {
  locations: number;
  orders: number;
  queued: number;
  packed: number;
  delivered: number;
};

type ApiCompanyIndexItem = {
  company_id: string;
  company_name: string;
  totals: ApiCompanyTotals;
  // For index: locations lastes via /api/kitchen/company
  locations: null;
};

type ApiResp = {
  ok: true;
  date: string;
  window: string;
  summary: { companies: number; locations: number; orders: number };
  companies: ApiCompanyIndexItem[];
  page: { cursor: string | null; nextCursor: string | null; limit: number };
};

function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickCompanyName(c: any): string {
  return (
    pickString(c?.name, c?.title, c?.label, c?.display_name, c?.displayName) ||
    "Ukjent firma"
  );
}

/**
 * GET /api/kitchen/companies?date=YYYY-MM-DD&cursor=<company_id>&limit=50&window=Standard
 * Cursor er company_id (uuid) – stabilt og lett.
 */
export async function GET(req: Request) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  try {
    // Auth gate (tilgang)
    const authClient = await supabaseServer();
    const { data: auth } = await authClient.auth.getUser();
    if (!auth?.user) return jsonErr(rid, "Ikke innlogget.", 401, "unauthorized");

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const date = dateParam && isISODate(dateParam) ? dateParam : osloTodayISODate();

    const cursor = url.searchParams.get("cursor"); // company_id (uuid)
    const limit = clampInt(url.searchParams.get("limit"), 50, 10, 200);
    const window = url.searchParams.get("window") || "Standard";

    const supabase = serviceSupabase();

    // 1) Finn company_id som har orders denne dagen (paginert på company_id)
    let q = supabase
      .from("orders")
      .select("company_id", { head: false })
      .eq("date", date)
      .eq("integrity_status", "ok")
      .not("company_id", "is", null)
      .order("company_id", { ascending: true })
      .limit(limit);

    if (cursor) q = q.gt("company_id", cursor);

    const { data: companyRows, error: cidsErr } = await q;
    if (cidsErr) return jsonErr(rid, "Kunne ikke hente firma-IDer.", 500, { code: "company_ids_failed", detail: cidsErr.message });

    const companyIds = Array.from(
      new Set((companyRows ?? []).map((r: any) => String(r.company_id)).filter(Boolean))
    );

    if (companyIds.length === 0) {
      const out: ApiResp = {
        ok: true,
        date,
        window,
        summary: { companies: 0, locations: 0, orders: 0 },
        companies: [],
        page: { cursor: cursor ?? null, nextCursor: null, limit },
      };
      return jsonOk(rid, out, 200);
    }

    const nextCursor = companyIds[companyIds.length - 1] ?? null;

    // 2) Hent companies (robust)
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("*")
      .in("id", companyIds);

    if (compErr) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "companies_failed", detail: compErr.message });

    const compMap = new Map<string, any>();
    (companies ?? []).forEach((c: any) => compMap.set(String(c.id), c));

    // 3) Hent orders for disse firmaene for dagen (for totals)
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("id, company_id, location_id")
      .eq("date", date)
      .eq("integrity_status", "ok")
      .in("company_id", companyIds);

    if (oErr) return jsonErr(rid, "Kunne ikke hente ordre.", 500, { code: "orders_failed", detail: oErr.message });

    // 4) Batch-status (valgfritt): vi leser kitchen_batches hvis finnes, ellers null
    // Batch er per (delivery_date, company_location_id, delivery_window). Vi bruker window = Standard foreløpig.
    let batches: any[] = [];
    try {
      const locIds = Array.from(new Set((orders ?? []).map((o: any) => o.location_id).filter(Boolean)));
      if (locIds.length) {
        const { data: b, error: bErr } = await supabase
          .from("kitchen_batches")
          .select("delivery_date, delivery_window, company_location_id, status")
          .eq("delivery_date", date)
          .in("company_location_id", locIds);
        if (!bErr && b) batches = b as any[];
      }
    } catch {
      // ignore
    }

    const batchMap = new Map<string, BatchStatus>();
    for (const b of batches) {
      const key = `${String(b.delivery_window ?? window)}|${String(b.company_location_id)}`;
      batchMap.set(key, (b.status as BatchStatus) || "queued");
    }

    // 5) Totals per company
    const totalsMap = new Map<string, ApiCompanyTotals>();
    const locSetMap = new Map<string, Set<string>>();

    for (const o of orders ?? []) {
      const cid = String((o as any).company_id);
      const lid = String((o as any).location_id);

      if (!totalsMap.has(cid)) {
        totalsMap.set(cid, { locations: 0, orders: 0, queued: 0, packed: 0, delivered: 0 });
        locSetMap.set(cid, new Set());
      }

      const t = totalsMap.get(cid)!;
      t.orders += 1;

      if (lid) {
        locSetMap.get(cid)!.add(lid);
        const st = batchMap.get(`${window}|${lid}`) || "queued";
        if (st === "queued") t.queued += 1;
        else if (st === "packed") t.packed += 1;
        else t.delivered += 1;
      }
    }

    for (const [cid, set] of locSetMap.entries()) {
      const t = totalsMap.get(cid)!;
      t.locations = set.size;
    }

    // 6) Bygg response
    const companiesOut: ApiCompanyIndexItem[] = companyIds.map((cid) => {
      const c = compMap.get(cid);
      return {
        company_id: cid,
        company_name: pickCompanyName(c),
        totals: totalsMap.get(cid) || { locations: 0, orders: 0, queued: 0, packed: 0, delivered: 0 },
        locations: null,
      };
    });

    // summary for denne “siden” (ikke global for alle 5000)
    const sumCompanies = companiesOut.length;
    const sumOrders = companiesOut.reduce((a, c) => a + (c.totals.orders || 0), 0);
    const sumLocations = companiesOut.reduce((a, c) => a + (c.totals.locations || 0), 0);

    const out: ApiResp = {
      ok: true,
      date,
      window,
      summary: { companies: sumCompanies, locations: sumLocations, orders: sumOrders },
      companies: companiesOut,
      page: { cursor: cursor ?? null, nextCursor, limit },
    };

    return jsonOk(rid, out, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente kjøkken-oversikt.", 500, { code: "kitchen_companies_failed", detail: e?.message || String(e) });
  }
}



