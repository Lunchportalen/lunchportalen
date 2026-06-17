import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";
import {
  evaluateCompanyRemovalEligibility,
  loadCompanyDependencyCounts,
  matchesArchiveConfirmation,
  matchesHardDeleteConfirmation,
  type CompanyDependencyCounts,
} from "@/lib/server/superadmin/companyRemovalPolicy";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isAuthUserMissing(err: unknown) {
  const e = err as { message?: string; status?: number; statusCode?: number };
  const msg = String(e?.message ?? "").toLowerCase();
  const status = Number(e?.status ?? e?.statusCode ?? 0);
  return status === 404 || msg.includes("not found") || msg.includes("user not found");
}

export type CompanyRemovalActor = {
  rid: string;
  userId: string | null;
  email: string | null;
};

export type CompanyRemovalResult =
  | { ok: true; mode: "archive" | "hard_delete"; companyId: string; alreadyDone?: boolean }
  | { ok: false; code: string; message: string; blockers?: string[] };

async function archiveCompanyAccess(
  admin: SupabaseClient,
  companyId: string
): Promise<{ authUsersTargeted: number; authUsersDeleted: number }> {
  const profRes = await admin.from("profiles").select("user_id").eq("company_id", companyId);
  if (profRes.error) throw new Error("PROFILES_LOOKUP_FAILED");

  const userIds = Array.from(new Set((profRes.data ?? []).map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean)));

  let authUsersDeleted = 0;
  for (const uid of userIds) {
    const del = await admin.auth.admin.deleteUser(uid);
    if (del?.error) {
      if (isAuthUserMissing(del.error)) continue;
      throw new Error("AUTH_DELETE_FAILED");
    }
    authUsersDeleted += 1;
  }

  return { authUsersTargeted: userIds.length, authUsersDeleted };
}

/** Controlled cleanup of non-operational rows before hard delete. Only safe when eligibility already passed. */
export async function cleanupHardDeleteDependencies(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const nullDefault = await admin.from("companies").update({ default_location_id: null }).eq("id", companyId);
  if (nullDefault.error) {
    return { ok: false, message: "Kunne ikke nullstille standardlokasjon før sletting." };
  }

  const locRes = await admin.from("company_locations").select("id").eq("company_id", companyId);
  if (locRes.error) {
    return { ok: false, message: "Kunne ikke hente lokasjoner før sletting." };
  }

  const locIds = (locRes.data ?? []).map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);

  if (locIds.length > 0) {
    const locationChildren = ["location_closed_dates", "location_policies"] as const;
    for (const table of locationChildren) {
      const del = await admin.from(table).delete().in("location_id", locIds);
      if (del.error) {
        return { ok: false, message: `Kunne ikke fjerne ${table} før sletting.` };
      }
    }
  }

  const menuDel = await admin.from("menu_service_days").delete().eq("company_id", companyId);
  if (menuDel.error) {
    return { ok: false, message: "Kunne ikke fjerne menydager før sletting." };
  }

  const tableDeletes = [
    "lead_pipeline",
    "agreement_change_requests",
    "agreement_requests",
    "company_registrations",
    "company_invites",
    "employee_invites",
    "company_memberships",
  ] as const;

  for (const table of tableDeletes) {
    const del = await admin.from(table).delete().eq("company_id", companyId);
    if (del.error) {
      return { ok: false, message: `Kunne ikke fjerne ${table} før sletting.` };
    }
  }

  const locDel = await admin.from("company_locations").delete().eq("company_id", companyId);
  if (locDel.error) {
    return { ok: false, message: "Kunne ikke fjerne lokasjoner før sletting." };
  }

  return { ok: true };
}

export async function executeCompanyRemoval(
  admin: SupabaseClient,
  actor: CompanyRemovalActor,
  input: {
    companyId: string;
    mode: "archive" | "hard_delete";
    confirmation: string;
    reason?: string | null;
  }
): Promise<CompanyRemovalResult> {
  const companyId = safeStr(input.companyId);
  const mode = input.mode;
  const reason = safeStr(input.reason).slice(0, 500) || null;

  const companyRes = await admin
    .from("companies")
    .select("id,name,orgnr,deleted_at,status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyRes.error || !companyRes.data?.id) {
    return { ok: false, code: "NOT_FOUND", message: "Fant ikke firma." };
  }

  const company = companyRes.data as {
    id: string;
    name: string | null;
    orgnr: string | null;
    deleted_at: string | null;
    status: string | null;
  };

  const dependencies = await loadCompanyDependencyCounts(admin, companyId);
  const eligibility = evaluateCompanyRemovalEligibility({
    companyName: company.name,
    orgnr: company.orgnr,
    deletedAt: company.deleted_at,
    dependencies,
  });

  if (mode === "archive") {
    if (!eligibility.canArchive) {
      return { ok: false, code: "ALREADY_ARCHIVED", message: "Firma er allerede arkivert.", blockers: eligibility.blockers };
    }

    const orgnr = safeStr(company.orgnr);
    if (!orgnr) {
      return { ok: false, code: "BAD_REQUEST", message: "Firma mangler org.nr og kan ikke arkiveres." };
    }

    if (!matchesArchiveConfirmation({ confirmation: input.confirmation, orgnr })) {
      return {
        ok: false,
        code: "CONFIRM_MISMATCH",
        message: `Bekreftelsen må være «${orgnr} ARKIVER».`,
      };
    }

    const access = await archiveCompanyAccess(admin, companyId);
    const now = new Date().toISOString();

    const companyUpdate = await admin
      .from("companies")
      .update({
        status: "CLOSED",
        deleted_at: now,
        deleted_by: actor.userId,
        delete_reason: reason,
      } as Record<string, unknown>)
      .eq("id", companyId);

    if (companyUpdate.error) {
      return { ok: false, code: "DB_ERROR", message: "Kunne ikke arkivere firma." };
    }

    await auditWriteMust({
      rid: actor.rid,
      action: "company.archive",
      entity_type: "company",
      entity_id: companyId,
      company_id: companyId,
      actor_user_id: actor.userId,
      actor_email: actor.email,
      actor_role: "superadmin",
      summary: "Superadmin arkiverte firma",
      detail: { companyId, reason, mode: "archive", ...access, via: "companies.remove" },
    });

    await logIncident({
      scope: "companies",
      severity: "info",
      rid: actor.rid,
      message: "Company archived",
      meta: { companyId, reason, mode: "archive", ...access },
    });

    return { ok: true, mode: "archive", companyId };
  }

  if (!eligibility.canHardDelete) {
    return {
      ok: false,
      code: "HARD_DELETE_BLOCKED",
      message: "Permanent sletting er ikke tillatt for dette firmaet.",
      blockers: eligibility.blockers,
    };
  }

  if (
    !matchesHardDeleteConfirmation({
      confirmation: input.confirmation,
      companyName: company.name,
      orgnr: company.orgnr,
    })
  ) {
    return {
      ok: false,
      code: "CONFIRM_MISMATCH",
      message: "Bekreftelsen må matche firmanavn eller org.nr nøyaktig.",
    };
  }

  const freshDependencies = await loadCompanyDependencyCounts(admin, companyId);
  const freshEligibility = evaluateCompanyRemovalEligibility({
    companyName: company.name,
    orgnr: company.orgnr,
    deletedAt: company.deleted_at,
    dependencies: freshDependencies,
  });

  if (!freshEligibility.canHardDelete) {
    return {
      ok: false,
      code: "HARD_DELETE_BLOCKED",
      message: "Permanent sletting er ikke tillatt — avhengigheter endret.",
      blockers: freshEligibility.blockers,
    };
  }

  await auditWriteMust({
    rid: actor.rid,
    action: "company.hard_delete",
    entity_type: "company",
    entity_id: companyId,
    company_id: companyId,
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: "superadmin",
    summary: "Superadmin slettet firma permanent",
    detail: {
      companyId,
      companyName: company.name,
      orgnr: company.orgnr,
      reason,
      mode: "hard_delete",
      dependencies: freshDependencies,
      via: "companies.remove",
      phase: "pre_delete",
    },
  });

  const cleanup = await cleanupHardDeleteDependencies(admin, companyId);
  if (cleanup.ok === false) {
    return { ok: false, code: "DB_ERROR", message: cleanup.message, blockers: freshEligibility.blockers };
  }

  const delRes = await admin.from("companies").delete().eq("id", companyId);
  if (delRes.error) {
    return {
      ok: false,
      code: "DB_ERROR",
      message: "Kunne ikke slette firma — ukjente avhengigheter kan fortsatt finnes.",
      blockers: freshEligibility.blockers,
    };
  }

  await logIncident({
    scope: "companies",
    severity: "warn",
    rid: actor.rid,
    message: "Company hard deleted",
    meta: { companyId, reason, mode: "hard_delete", dependencies: freshDependencies },
  });

  return { ok: true, mode: "hard_delete", companyId };
}

export type { CompanyDependencyCounts };
