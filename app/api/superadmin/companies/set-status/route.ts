// app/api/superadmin/companies/set-status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { logOpsEventBestEffort } from "@/lib/ops/logOpsEvent";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (enum): PENDING|ACTIVE|PAUSED|CLOSED
 * - payload aksepterer både companyId og company_id (kompat)
 * - status aksepterer både lower og UPPER (kompat), lagres som enum-label
 * - Superadmin-only
 * - Idempotent + audit (best-effort)
 */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

function normalizeCompanyStatus(raw: string | null): CompanyStatus | null {
  const u = safeStr(raw).toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "PAUSED") return "PAUSED";
  if (u === "CLOSED") return "CLOSED";
  if (u === "PENDING") return "PENDING";
  return null;
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const sb = await supabaseServer();
    const { data: au, error: auErr } = await sb.auth.getUser();

    if (auErr || !au?.user) {
      return jsonErr(rid, "Ikke innlogget.", 401, {
        code: "NOT_AUTH",
        detail: { message: auErr?.message ?? "No user" },
      });
    }

    const email = au.user.email ?? null;
    const role = systemRoleByEmail(email);
    if (role !== "superadmin") {
      return jsonErr(rid, "Ingen tilgang.", 403, {
        code: "FORBIDDEN",
        detail: { email: email ?? "unknown" },
      });
    }

    const body = await req.json().catch(() => null);

    const company_id = safeStr(body?.companyId ?? body?.company_id);
    const statusRaw = body?.status == null ? null : safeStr(body?.status);
    const next = normalizeCompanyStatus(statusRaw);

    if (!company_id) return jsonErr(rid, "companyId mangler.", 400, { code: "VALIDATION" });
    if (!next) return jsonErr(rid, "Ugyldig status.", 400, { code: "VALIDATION", detail: { status: statusRaw } });

    // Read current for idempotence + audit
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id,name,status")
      .eq("id", company_id)
      .single();

    if (cErr || !company) {
      return jsonErr(rid, "Fant ikke firma.", 404, {
        code: "NOT_FOUND",
        detail: { message: cErr?.message ?? "Missing company" },
      });
    }

    const prev = normalizeCompanyStatus(company.status) ?? "PENDING";

    // Idempotent: already correct state
    if (prev === next) {
      return jsonOk(rid, { companyId: company_id, status: next, already: true });
    }

    // Update
    const { error: uErr } = await sb.from("companies").update({ status: next }).eq("id", company_id);
    if (uErr) {
      return jsonErr(rid, "Kunne ikke oppdatere status.", 400, {
        code: "UPDATE_FAILED",
        detail: { message: uErr.message },
      });
    }

    // Audit (best-effort) — should never block the status change
    await logOpsEventBestEffort(sb, {
      rid,
      actor_user_id: au.user.id,
      actor_email: email,
      actor_role: "superadmin",
      action: "COMPANY_STATUS_CHANGED",
      entity_type: "company",
      entity_id: company_id,
      summary: `Company status changed: ${safeStr(company.name) || company_id}`,
      detail: { from: prev, to: next },
    });

    return jsonOk(rid, { companyId: company_id, status: next });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "SET_STATUS_CRASH",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
