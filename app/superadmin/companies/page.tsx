// app/superadmin/companies/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

import CompaniesClient from "./companies-client";

import { getScope, requireSuperadmin } from "@/lib/auth/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Superadmin → Firmaoversikt
 * - Server-side auth + guard
 * - Prefetch første side for rask UI
 *
 * NB: getScope(req) krever NextRequest.
 * I Server Components finnes ikke req → vi bygger en NextRequest fra cookies()/headers().
 * I Next 15 kan cookies()/headers() være async → må await.
 */

type SearchParams = {
  q?: string;
  status?: "pending" | "active" | "paused" | "closed";
  include_closed?: "1";
  page?: string;
  limit?: string;
  sort?: "updated_at" | "created_at" | "name";
  dir?: "asc" | "desc";
};

async function cookieHeaderFromNextCookies() {
  const store = await cookies();
  const all = store.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function requestUrlFromHeaders(fallbackPath: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${fallbackPath}`;
}

export default async function SuperadminCompaniesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // -----------------------------
  // Build NextRequest for getScope(req)
  // -----------------------------
  const url = await requestUrlFromHeaders("/superadmin/companies");
  const cookieHeader = await cookieHeaderFromNextCookies();

  const req = new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  // -----------------------------
  // Auth + superadmin guard
  // -----------------------------
  try {
    const scope = await getScope(req);
    requireSuperadmin(scope);
  } catch {
    redirect("/login");
  }

  // -----------------------------
  // Query params (defaults)
  // -----------------------------
  const q = (searchParams?.q ?? "").trim();
  const status = searchParams?.status ?? null;
  const includeClosed = searchParams?.include_closed === "1";

  const page = Math.max(1, Number(searchParams?.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams?.limit ?? 50)));

  const sort = searchParams?.sort ?? "updated_at";
  const dir = searchParams?.dir ?? "desc";

  // -----------------------------
  // Prefetch liste (samme logikk som API)
  // -----------------------------
  const admin = supabaseAdmin();

  let query = admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at", { count: "exact" })
    .order(sort, { ascending: dir === "asc" })
    .range((page - 1) * limit, page * limit - 1);

  if (!includeClosed) query = query.neq("status", "closed");
  if (status) query = query.eq("status", status);
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    query = query.or(`name.ilike.${like},orgnr.ilike.${like}`);
  }

  const listRes = await query;

  const companies = listRes.data ?? [];
  const total = listRes.count ?? companies.length;

  // -----------------------------
  // Stats
  // -----------------------------
  const [p, a, pa, c] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "paused"),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "closed"),
  ]);

  const stats = {
    companiesPending: p.count ?? 0,
    companiesActive: a.count ?? 0,
    companiesPaused: pa.count ?? 0,
    companiesClosed: c.count ?? 0,
    companiesTotal: (p.count ?? 0) + (a.count ?? 0) + (pa.count ?? 0) + (c.count ?? 0),
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <CompaniesClient
      initial={{
        ok: true,
        page,
        limit,
        total,
        q: q || null,
        status,
        include_closed: includeClosed,
        sort,
        dir,
        stats,
        companies,
      }}
    />
  );
}
