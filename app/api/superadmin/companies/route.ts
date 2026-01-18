// app/api/superadmin/companies/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompanyStatus = "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string | null;
  orgnr: string | null;
  status: CompanyStatus | null;
  updated_at: string | null;
};

type ProfileRow = {
  company_id: string | null;
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("MISSING_NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "lunchportalen-superadmin-companies" } },
  });
}

function isCompanyStatus(v: any): v is CompanyStatus {
  return v === "active" || v === "paused" || v === "closed";
}

function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ ok: false, error, ...(extra || {}) }, { status });
}

export async function GET(req: Request) {
  // 0) Query params (valgfritt, men enterprise-praktisk)
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const statusParam = (url.searchParams.get("status") || "").trim().toLowerCase();
  const limitParam = url.searchParams.get("limit") || "500";
  const limit = Math.max(1, Math.min(Number.parseInt(limitParam, 10) || 500, 2000));

  const filterStatus: CompanyStatus | null = isCompanyStatus(statusParam) ? statusParam : null;

  // 1) Session-auth (vanlig bruker)
  const supabase = await supabaseServer();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr) {
    return jsonError("AUTH_FAILED", 401, { message: authErr.message });
  }

  const user = authData?.user;
  if (!user) return jsonError("AUTH_REQUIRED", 401);

  // 2) Superadmin-guard (hos dere: profiles.user_id)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return jsonError("PROFILE_READ_FAILED", 500, { message: profErr.message });
  }

  if (profile?.role !== "superadmin") {
    return jsonError("FORBIDDEN", 403);
  }

  // 3) Service role client (hard fail hvis env mangler)
  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(
      e?.message === "MISSING_SERVICE_ROLE_KEY" ? "MISSING_SERVICE_ROLE_KEY" : "SERVICE_ROLE_INIT_FAILED",
      500,
      { message: e?.message || String(e) }
    );
  }

  // 4) Hent firma (med optional filter)
  let companiesQuery = admin
    .from("companies")
    .select("id,name,status,updated_at,orgnr", { count: "exact" })
    .order("name", { ascending: true })
    .limit(limit);

  if (filterStatus) companiesQuery = companiesQuery.eq("status", filterStatus);

  // Enkelt søk på navn/orgnr
  if (q) {
    // PostgREST OR-syntax: or=(name.ilike.%q%,orgnr.ilike.%q%)
    const like = `%${q}%`;
    companiesQuery = companiesQuery.or(`name.ilike.${like},orgnr.ilike.${like}`);
  }

  const { data: companiesRaw, error: cErr, count: companiesCount } = await companiesQuery;

  if (cErr) {
    return jsonError("COMPANIES_READ_FAILED", 500, { message: cErr.message });
  }

  const companies = (companiesRaw ?? []) as CompanyRow[];

  // 5) Tell brukere per firma (robust, men ikke unødvendig tung: henter kun company_id)
  // NB: Dette teller alle profiler. Hvis dere ønsker "kun ansatte", legg inn filter på role.
  const { data: profilesRaw, error: pErr } = await admin
    .from("profiles")
    .select("company_id");

  if (pErr) {
    return jsonError("PROFILES_READ_FAILED", 500, { message: pErr.message });
  }

  const profiles = (profilesRaw ?? []) as ProfileRow[];

  const counts = new Map<string, number>();
  for (const row of profiles) {
    const cid = row.company_id;
    if (!cid) continue;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }

  // 6) Payload (stabil, null-safe)
  const payload = companies.map((c) => {
    const status = isCompanyStatus(c.status) ? c.status : "active";

    return {
      id: c.id,
      name: (c.name || "").trim() || "—",
      orgnr: c.orgnr || null,
      status,
      usersCount: counts.get(c.id) ?? 0,
      updatedAt: c.updated_at || null,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      meta: {
        limit,
        q: q || null,
        status: filterStatus,
        total: companiesCount ?? payload.length,
        returned: payload.length,
      },
      companies: payload,
    },
    { status: 200 }
  );
}
