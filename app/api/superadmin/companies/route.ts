// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/superadmin/paging";

type CompanyStatus = "active" | "paused" | "closed";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeStatus(v: string | null): CompanyStatus | "all" {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "active" || s === "paused" || s === "closed") return s;
  return "all";
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Søk: enkel ilike på tekstkolonner. UUID håndteres separat.
function buildSearchOr(q: string) {
  const qq = q.trim();
  const like = `%${qq}%`;
  // ⚠️ IKKE id.ilike / id::text.ilike her – det knekker ofte pga uuid/cast i PostgREST.
  return `name.ilike.${like},orgnr.ilike.${like}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const qRaw = url.searchParams.get("q") ?? "";
  const q = qRaw.trim();
  const status = normalizeStatus(url.searchParams.get("status"));
  const limit = clampInt(url.searchParams.get("limit"), 10, 200, 50);
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const supabase = await supabaseServer();

  // ✅ SIKKERHET: role check (superadmin)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonError(401, "unauthorized", "Ikke innlogget");

  const role = String(userData.user.user_metadata?.role ?? "");
  if (role !== "superadmin") {
    // ✅ Prod-safe: ingen sensitive detaljer tilbake til klient
    return jsonError(403, "forbidden", "Mangler tilgang");
  }

  // Base query
  let query = supabase
    .from("companies")
    .select("id,name,orgnr,status,updated_at,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // hent 1 ekstra for å vite om det finnes flere

  // Status filter
  if (status !== "all") query = query.eq("status", status);

  // Search
  if (q.length) {
    if (isUuid(q)) {
      // ✅ trygt UUID-søk
      query = query.eq("id", q);
    } else {
      // ✅ trygt tekst-søk
      query = query.or(buildSearchOr(q));
    }
  }

  // Cursor: "less than" på (created_at, id) i DESC-sort
  if (cursor) {
    // created_at < cursor.created_at OR (created_at = cursor.created_at AND id < cursor.id)
    // NB: id.lt på uuid fungerer, men vi må uttrykke det med or().
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) return jsonError(500, "db_error", "Kunne ikke hente firma");

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last?.created_at && last?.id ? encodeCursor({ created_at: last.created_at, id: last.id }) : null;

  return NextResponse.json({
    ok: true,
    rows: page.map((r: any) => ({
      id: r.id,
      name: r.name,
      orgnr: r.orgnr ?? null,
      status: r.status, // kan være lower-case (UI normaliserer)
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    nextCursor,
  });
}
