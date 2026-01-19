// app/api/superadmin/companies/[companyId]/purge/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

type Severity = "info" | "warning" | "critical";

type RouteCtx = {
  // Next.js 15: params kan være Promise
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireSuperadmin() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user || userErr) return { ok: false as const, res: jsonError(401, "AUTH_REQUIRED", "Ikke innlogget.") };

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return {
      ok: false as const,
      res: jsonError(500, "PROFILE_LOOKUP_FAILED", "Kunne ikke lese profil.", profErr.message),
    };
  }

  if (!profile || profile.role !== "superadmin") {
    return { ok: false as const, res: jsonError(403, "FORBIDDEN", "Kun superadmin har tilgang.") };
  }

  return { ok: true as const, user };
}

async function getCompanyId(ctx: RouteCtx) {
  const { companyId } = await Promise.resolve(ctx.params);
  return companyId;
}

type PurgeBody = {
  confirm?: boolean;
  dryRun?: boolean;
  reason?: string;
};

// Supabase helpers
async function countEq(admin: any, table: string, col: string, val: string) {
  const r = await admin.from(table).select("id", { count: "exact", head: true }).eq(col, val);
  if (r.error) throw r.error;
  return r.count ?? 0;
}
async function countIn(admin: any, table: string, col: string, vals: string[]) {
  if (!vals.length) return 0;
  const r = await admin.from(table).select("id", { count: "exact", head: true }).in(col, vals);
  if (r.error) throw r.error;
  return r.count ?? 0;
}
async function delEq(admin: any, table: string, col: string, val: string) {
  const r = await admin.from(table).delete().eq(col, val);
  if (r.error) throw r.error;
}
async function delIn(admin: any, table: string, col: string, vals: string[]) {
  if (!vals.length) return;
  const r = await admin.from(table).delete().in(col, vals);
  if (r.error) throw r.error;
}

async function safeCount(fn: () => Promise<number>) {
  try {
    return await fn();
  } catch {
    return 0;
  }
}
async function safeDelete(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    // ignore (valgfri tabell mangler osv.)
  }
}

/**
 * GET: dry-run rapport
 * /api/superadmin/companies/:id/purge?dryRun=1
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonError(400, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", cErr.message);
  if (!company) return jsonError(404, "NOT_FOUND", "Fant ikke firma.");

  const { data: locs, error: locErr } = await admin.from("company_locations").select("id").eq("company_id", companyId);
  if (locErr) return jsonError(500, "LOCATIONS_LOOKUP_FAILED", "Kunne ikke hente lokasjoner.", locErr.message);

  const locationIds = (locs ?? []).map((x: any) => x.id).filter(isUuid);

  const report: Record<string, number> = {};

  // ✅ ORDERS-skjema hos deg: company_id + location_id
  report.orders = await safeCount(async () => countEq(admin, "orders", "company_id", companyId));

  // (valgfritt) dersom du har ordre per location_id og ønsker å sjekke begge:
  report.orders_by_location = await safeCount(async () => countIn(admin, "orders", "location_id", locationIds));

  report.profiles = await safeCount(async () => countEq(admin, "profiles", "company_id", companyId));
  report.company_locations = await safeCount(async () => countEq(admin, "company_locations", "company_id", companyId));

  // Valgfrie moduler (teller som 0 hvis tabell mangler)
  report.agreements = await safeCount(async () => countEq(admin, "agreements", "company_id", companyId));
  report.audit_events = await safeCount(async () => countEq(admin, "audit_events", "company_id", companyId));
  report.order_events = await safeCount(async () => countEq(admin, "order_events", "company_id", companyId));
  report.kitchen_batches = await safeCount(async () => countEq(admin, "kitchen_batches", "company_id", companyId));
  report.driver_routes = await safeCount(async () => countEq(admin, "driver_routes", "company_id", companyId));

  return NextResponse.json(
    {
      ok: true,
      dryRun,
      company,
      locationIds: { count: locationIds.length, sample: locationIds.slice(0, 30) },
      report,
      note: dryRun ? "Dry run aktiv." : "Kjør POST for å slette.",
    },
    { status: 200 }
  );
}

/**
 * POST: purge
 * Body: { confirm: true, dryRun?: boolean, reason?: string }
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonError(400, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin();
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => null)) as PurgeBody | null;
  if (!body?.confirm) return jsonError(400, "BAD_REQUEST", "Bekreft purge (confirm=true).");

  const dryRun = Boolean(body?.dryRun);
  const reason = String(body?.reason ?? "").trim().slice(0, 220);

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", cErr.message);
  if (!company) return jsonError(404, "NOT_FOUND", "Fant ikke firma.");

  const { data: locs, error: locErr } = await admin.from("company_locations").select("id").eq("company_id", companyId);
  if (locErr) return jsonError(500, "LOCATIONS_LOOKUP_FAILED", "Kunne ikke hente lokasjoner.", locErr.message);

  const locationIds = (locs ?? []).map((x: any) => x.id).filter(isUuid);

  // Rapport (robust)
  const report: Record<string, number> = {};
  report.orders = await safeCount(async () => countEq(admin, "orders", "company_id", companyId));
  report.orders_by_location = await safeCount(async () => countIn(admin, "orders", "location_id", locationIds));
  report.profiles = await safeCount(async () => countEq(admin, "profiles", "company_id", companyId));
  report.company_locations = await safeCount(async () => countEq(admin, "company_locations", "company_id", companyId));

  report.agreements = await safeCount(async () => countEq(admin, "agreements", "company_id", companyId));
  report.audit_events = await safeCount(async () => countEq(admin, "audit_events", "company_id", companyId));
  report.order_events = await safeCount(async () => countEq(admin, "order_events", "company_id", companyId));
  report.kitchen_batches = await safeCount(async () => countEq(admin, "kitchen_batches", "company_id", companyId));
  report.driver_routes = await safeCount(async () => countEq(admin, "driver_routes", "company_id", companyId));

  if (dryRun) {
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        company,
        locationIds: { count: locationIds.length, sample: locationIds.slice(0, 30) },
        report,
        note: "Ingen data ble slettet (dryRun=true).",
      },
      { status: 200 }
    );
  }

  // Slett i riktig rekkefølge (robust for valgfrie tabeller)
  try {
    await safeDelete(() => delEq(admin, "order_events", "company_id", companyId));
    await safeDelete(() => delEq(admin, "kitchen_batches", "company_id", companyId));
    await safeDelete(() => delEq(admin, "driver_routes", "company_id", companyId));

    // ✅ orders hos deg: company_id (primær) + location_id (ekstra sikkerhet)
    await delEq(admin, "orders", "company_id", companyId);
    await safeDelete(() => delIn(admin, "orders", "location_id", locationIds));

    await safeDelete(() => delEq(admin, "agreements", "company_id", companyId));
    await safeDelete(() => delEq(admin, "audit_events", "company_id", companyId));

    await delEq(admin, "profiles", "company_id", companyId);
    await delEq(admin, "company_locations", "company_id", companyId);

    await delEq(admin, "companies", "id", companyId);
  } catch (e: any) {
    return jsonError(409, "PURGE_DELETE_FAILED", "Purge stoppet (FK/trigger/policy).", e?.message ?? String(e));
  }

  // Audit (best effort)
  try {
    const mod = await import("@/lib/audit/log").catch(() => null);
    const writeAudit = (mod as any)?.writeAudit;
    if (typeof writeAudit === "function") {
      await writeAudit({
        actor_user_id: guard.user.id,
        actor_role: "superadmin",
        action: "company.purged",
        severity: "critical" as Severity,
        company_id: companyId,
        target_type: "company",
        target_id: companyId,
        target_label: (company as any)?.name ?? null,
        before: { company, report },
        after: null,
        meta: { reason: reason || null, orgnr: (company as any)?.orgnr ?? null },
      });
    }
  } catch {}

  return NextResponse.json(
    {
      ok: true,
      purged: { id: companyId, name: (company as any)?.name ?? null, orgnr: (company as any)?.orgnr ?? null },
      locationIds: { count: locationIds.length },
      report,
    },
    { status: 200 }
  );
}

/**
 * DELETE: tolerant hvis frontend sender DELETE ved “Slett”.
 * Videresender til POST-logikk (forventer samme body {confirm:true,...})
 */
export async function DELETE(req: Request, ctx: RouteCtx) {
  return POST(req, ctx);
}
