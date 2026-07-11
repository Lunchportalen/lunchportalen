"use server";
import "server-only";

import { makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { logOpsEventBestEffort } from "@/lib/ops/logOpsEvent";
import {
  applyCompanyLifecycleStatus,
  normalizeCompanyLifecycleStatus,
  type CompanyLifecycleStatus,
} from "@/lib/server/superadmin/companyLifecycleStatusApply";

export type CompanyStatus = CompanyLifecycleStatus;

export type SetCompanyStatusResult =
  | { ok: true; rid: string; companyId: string; status: CompanyStatus; already: boolean }
  | { ok: false; rid: string; error: string; message: string; status: number };

/**
 * SEC-004: allowed lifecycle transitions for the superadmin status action.
 * Mirrors the UI affordances (pending → aktiver/arkiver, active → pause/arkiver,
 * paused → gjenoppta/arkiver, closed → gjenåpne). Same-status is idempotent no-op.
 */
const ALLOWED_TRANSITIONS: Record<CompanyLifecycleStatus, readonly CompanyLifecycleStatus[]> = {
  PENDING: ["ACTIVE", "PAUSED", "CLOSED"],
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: ["ACTIVE"],
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function err(rid: string, error: string, message: string, status: number): SetCompanyStatusResult {
  return { ok: false, rid, error, message, status };
}

/**
 * setCompanyStatus (server action) — SEC-004 hardened.
 *
 * - Explicit superadmin gate (session + profiles.role) — never relies on UI or RLS alone.
 * - Strict input validation: unknown status is REJECTED (no silent PENDING fallback).
 * - Transition matrix enforced; idempotent when prev === next.
 * - Delegates the write to the canonical `applyCompanyLifecycleStatus` path
 *   (same as POST /api/superadmin/companies/set-status).
 * - Audit: actor, tenant, before/after, timestamp via `logOpsEventBestEffort`.
 */
export async function setCompanyStatus(
  companyId: string,
  status: CompanyStatus
): Promise<SetCompanyStatusResult> {
  const rid = makeRid();

  const company_id = safeStr(companyId);
  if (!company_id) {
    return err(rid, "BAD_COMPANY_ID", "Ugyldig companyId.", 400);
  }

  const nextStatus = normalizeCompanyLifecycleStatus(safeStr(status));
  if (!nextStatus) {
    return err(rid, "VALIDATION", "Ugyldig status.", 400);
  }

  try {
    const sb = await supabaseServer();

    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr || !auth?.user?.id) {
      return err(rid, "UNAUTHORIZED", "Ikke innlogget.", 401);
    }

    const uid = safeStr(auth.user.id);
    if (!(await isSuperadminProfile(uid))) {
      return err(rid, "FORBIDDEN", "Ingen tilgang.", 403);
    }

    const { data: company, error: readErr } = await sb
      .from("companies")
      .select("id,name,status")
      .eq("id", company_id)
      .maybeSingle();

    if (readErr) {
      return err(rid, "COMPANY_READ_FAILED", "Kunne ikke lese firma.", 500);
    }
    if (!company?.id) {
      return err(rid, "COMPANY_NOT_FOUND", "Firma ikke funnet.", 404);
    }

    const prevStatus = normalizeCompanyLifecycleStatus(safeStr(company.status)) ?? "PENDING";

    if (prevStatus === nextStatus) {
      return { ok: true, rid, companyId: company_id, status: nextStatus, already: true };
    }

    if (!ALLOWED_TRANSITIONS[prevStatus].includes(nextStatus)) {
      return err(rid, "INVALID_TRANSITION", "Ugyldig statusovergang.", 409);
    }

    const applied = await applyCompanyLifecycleStatus(sb, rid, company_id, nextStatus);
    if (applied.ok === false) {
      const httpStatus = applied.response.status || 500;
      return err(rid, "COMPANY_STATUS_UPDATE_FAILED", "Kunne ikke oppdatere firmastatus.", httpStatus);
    }

    if (!applied.already) {
      await logOpsEventBestEffort(sb, {
        rid,
        actor_user_id: uid,
        actor_email: auth.user.email ?? null,
        actor_role: "superadmin",
        action: "COMPANY_STATUS_CHANGED",
        entity_type: "company",
        entity_id: company_id,
        summary: `Company status changed: ${applied.companyName || company_id}`,
        detail: {
          from: applied.prev,
          to: applied.next,
          via: "superadmin.firms.setCompanyStatus",
          at: new Date().toISOString(),
        },
      });
    }

    return { ok: true, rid, companyId: company_id, status: nextStatus, already: applied.already };
  } catch {
    return err(rid, "COMPANY_STATUS_EXCEPTION", "Uventet feil.", 500);
  }
}
