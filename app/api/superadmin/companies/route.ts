// app/api/superadmin/companies/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type CompanyStatus = "pending" | "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
  created_at?: string | null;
  updated_at: string | null;
};

function noStore() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json(
    { ok: false, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function b64decodeJson<T>(s: string): T | null {
  try {
    const json = Buffer.from(s, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function b64encodeJson<T>(obj: T) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

type Cursor = { name: string; id: string };

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeStatusParam(v: string | null): CompanyStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "pending") return "pending";
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return null;
}

export async function GET(req: Request) {
  const rid = `sa_companies_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = await supabaseServer();
    const url = new URL(req.url);

    const limit = clampInt(url.searchParams.get("limit"), 10, 200, 50);

    const qRaw = url.searchParams.get("q") ?? "";
    const q = normalizeQuery(qRaw);

    const status = normalizeStatusParam(url.searchParams.get("status"));

    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? b64decodeJson<Cursor>(cursorRaw) : null;

    // ✅ grunnquery: stabil sort for keyset paging
    let qb = supabase
      .from("companies")
      .select("id,name,orgnr,status,created_at,updated_at")
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);

    // ✅ statusfilter (server-side) — nå inkluderer vi pending
    if (status) {
      qb = qb.eq("status", status);
    }

    // ✅ søk
    if (q.length) {
      const onlyDigits = /^[0-9]+$/.test(q);

      if (isUuid(q)) {
        qb = qb.eq("id", q);
      } else if (onlyDigits) {
        qb = qb.ilike("orgnr", `${q}%`);
      } else {
        qb = qb.ilike("name", `${q}%`);
      }
    }

    // ✅ keyset cursor: (name, id) > (cursor.name, cursor.id)
    if (cursor?.name && cursor?.id) {
      const safeName = String(cursor.name);
      const safeId = String(cursor.id);
      qb = qb.or(`name.gt.${safeName},and(name.eq.${safeName},id.gt.${safeId})`);
    }

    const { data, error } = await qb;
    if (error) return jsonError(500, "DB_ERROR", error.message, { rid });

    const rows = (data ?? []) as CompanyRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor =
      hasMore && page.length
        ? b64encodeJson<Cursor>({
            name: page[page.length - 1]!.name,
            id: page[page.length - 1]!.id,
          })
        : null;

    return NextResponse.json(
      { ok: true, rid, items: page, nextCursor },
      { status: 200, headers: noStore() }
    );
  } catch (e: any) {
    return jsonError(500, "SERVER_ERROR", String(e?.message ?? "unknown"), { rid });
  }
}
