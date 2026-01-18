// app/api/superadmin/company-status/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";

type CompanyStatus = "active" | "paused" | "closed";
type Severity = "info" | "warning" | "critical";

function isStatus(x: any): x is CompanyStatus {
  return x === "active" || x === "paused" || x === "closed";
}

function isUuid(v: any) {
  return typeof v === "string" && /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v);
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function severityForCompanyStatus(status: CompanyStatus): Severity {
  if (status === "closed") return "critical";
  if (status === "paused") return "warning";
  return "info";
}

export async function POST(req: Request) {
  // 0) Parse body (robust)
  const body = (await req.json().catch(() => null)) as
    | { companyId?: string; status?: CompanyStatus; reason?: string }
    | null;

  const companyId = body?.companyId?.trim();
  const status = body?.status;
  const reason = (body?.reason ?? "").toString().trim().slice(0, 220);

  if (!companyId || !isUuid(companyId) || !isStatus(status)) {
    return NextResponse.json(
      {
        ok: false,
        error: "BAD_REQUEST",
        message: "Mangler companyId eller ugyldig status.",
      },
      { status: 400 }
    );
  }

  // 1) Session: må være innlogget
  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user || userErr) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED", message: "Ikke innlogget." },
      { status: 401 }
    );
  }

  // 2) Guard: må være superadmin (hos dere: profiles.user_id)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr || !profile || profile.role !== "superadmin") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: "Kun superadmin har tilgang." },
      { status: 403 }
    );
  }

  // 3) Oppdater via service role (slipper RLS-trøbbel i admin)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_SERVICE_ROLE_KEY",
        message: "SUPABASE_SERVICE_ROLE_KEY mangler i .env.local (server-only).",
      },
      { status: 500 }
    );
  }

  const admin = supabaseAdmin();

  // 3a) Hent eksisterende (for audit + 404 hvis ikke finnes)
  const { data: existing, error: exErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json(
      { ok: false, error: "COMPANY_LOOKUP_FAILED", message: exErr.message },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "Fant ikke firma." },
      { status: 404 }
    );
  }

  // Idempotent: hvis status allerede er ønsket, returnér ok (men logg ikke)
  const prevStatus = (existing.status ?? "active") as CompanyStatus;
  if (prevStatus === status) {
    return NextResponse.json(
      {
        ok: true,
        company: existing,
        meta: {
          prevStatus,
          newStatus: status,
          reason: reason || undefined,
          note: "No change (already in desired state).",
        },
      },
      { status: 200 }
    );
  }

  // 3b) Oppdater status
  const nowISO = new Date().toISOString();
  const { data: updated, error: upErr } = await admin
    .from("companies")
    .update({
      status,
      updated_at: nowISO,
      // (valgfritt fremtidig)
      // status_reason: reason || null,
      // status_changed_by: user.id,
      // status_changed_at: nowISO,
    })
    .eq("id", companyId)
    .select("id,name,orgnr,status,created_at,updated_at")
    .single();

  if (upErr || !updated) {
    return NextResponse.json(
      {
        ok: false,
        error: "UPDATE_FAILED",
        message: "Kunne ikke oppdatere firma.",
        detail: upErr?.message,
      },
      { status: 500 }
    );
  }

  // 4) Audit (minimum) – fail-quiet (skal aldri knekke adminflyt)
  try {
    await writeAudit({
      actor_user_id: user.id,
      actor_role: "superadmin",
      action: "company.status_changed",
      severity: severityForCompanyStatus(status),
      company_id: companyId,
      target_type: "company",
      target_id: companyId,
      target_label: (updated as any)?.name ?? null,
      before: { status: prevStatus },
      after: { status },
      meta: {
        reason: reason || null,
        orgnr: (updated as any)?.orgnr ?? null,
      },
    });
  } catch {
    // intentionally ignored
  }

  return NextResponse.json(
    {
      ok: true,
      company: updated,
      meta: {
        prevStatus,
        newStatus: status,
        reason: reason || undefined,
      },
    },
    { status: 200 }
  );
}
