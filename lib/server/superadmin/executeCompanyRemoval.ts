import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { isMissingRelationError } from "@/lib/db/missingRelation";
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

export function parseDbDependencyError(
  error: { message?: string; code?: string; details?: string } | null | undefined
): CompanyRemovalDependencyDetail & { isFkViolation: boolean } {
  const message = safeStr(error?.message);
  const code = safeStr(error?.code);
  const details = safeStr(error?.details);
  const blob = `${message} ${details}`.trim();
  const lower = blob.toLowerCase();
  const isFkViolation = code === "23503" || lower.includes("foreign key");

  const constraintMatch =
    blob.match(/constraint "([^"]+)"/i) ?? blob.match(/constraint\s+([a-z0-9_]+)/i);
  const blockingTableMatch = blob.match(/on table "([^"]+)"/gi);
  const blockingTable = blockingTableMatch?.at(-1)?.match(/"([^"]+)"/)?.[1];
  const referencedMatch = blob.match(/violates foreign key constraint[^"]*"([^"]+)"/i);

  return {
    isFkViolation,
    constraint: constraintMatch?.[1] ?? referencedMatch?.[1],
    table: blockingTable ?? referencedMatch?.[1],
  };
}

function dependencyBlockedMessage(table: string): string {
  const label = CLEANUP_TABLE_LABELS[table] ?? table.replaceAll("_", " ");
  return `Kunne ikke slette firma fordi ${label} fortsatt er koblet til firmaet.`;
}

function buildCleanupFailure(
  cleanupStep: string,
  table: string,
  error?: { message?: string; code?: string; details?: string } | null
): { ok: false; message: string; code: string; dependencyDetail: CompanyRemovalDependencyDetail } {
  const parsed = parseDbDependencyError(error ?? null);
  const failingTable = parsed.table ?? table;
  const message = parsed.isFkViolation
    ? dependencyBlockedMessage(failingTable)
    : cleanupFailureMessage(table, error);

  return {
    ok: false,
    message,
    code: parsed.isFkViolation ? "UNKNOWN_DEPENDENCY" : "DB_ERROR",
    dependencyDetail: {
      table: failingTable,
      constraint: parsed.constraint,
      cleanupStep,
    },
  };
}

async function logCleanupFailure(
  rid: string,
  companyId: string,
  failure: { message: string; code: string; dependencyDetail: CompanyRemovalDependencyDetail }
): Promise<void> {
  await logIncident({
    scope: "companies",
    severity: "warn",
    rid,
    message: "Company hard-delete cleanup failed",
    meta: {
      companyId,
      code: failure.code,
      ...failure.dependencyDetail,
      userMessage: failure.message,
    },
  });
}

async function writeHardDeletePreAudit(
  actor: CompanyRemovalActor,
  input: {
    companyId: string;
    companyName: string | null;
    orgnr: string | null;
    reason: string | null;
    dependencies: CompanyDependencyCounts;
    cleanup: string[];
  }
): Promise<void> {
  try {
    await auditWriteMust({
      rid: actor.rid,
      action: "company.hard_delete",
      entity_type: "company",
      entity_id: input.companyId,
      company_id: input.companyId,
      actor_user_id: actor.userId,
      actor_email: actor.email,
      actor_role: "superadmin",
      summary: "Superadmin slettet firma permanent",
      detail: {
        companyId: input.companyId,
        companyName: input.companyName,
        orgnr: input.orgnr,
        reason: input.reason,
        mode: "hard_delete",
        dependencies: input.dependencies,
        cleanup: input.cleanup,
        via: "companies.remove",
        phase: "pre_delete",
      },
    });
  } catch (err) {
    await logIncident({
      scope: "companies",
      severity: "warn",
      rid: actor.rid,
      message: "Hard delete pre-delete audit failed (continuing)",
      meta: {
        companyId: input.companyId,
        error: err instanceof Error ? err.message : String(err ?? "unknown"),
      },
    });
  }
}

export type CompanyRemovalActor = {
  rid: string;
  userId: string | null;
  email: string | null;
};

export type CompanyRemovalDependencyDetail = {
  table?: string;
  constraint?: string;
  cleanupStep?: string;
};

export type CompanyRemovalResult =
  | { ok: true; mode: "archive" | "hard_delete"; companyId: string; alreadyDone?: boolean }
  | {
      ok: false;
      code: string;
      message: string;
      blockers?: string[];
      dependencyDetail?: CompanyRemovalDependencyDetail;
    };

async function deleteCompanyAuthUsers(
  admin: SupabaseClient,
  companyId: string
): Promise<{ authUsersTargeted: number; authUsersDeleted: number; authPartialFailure: boolean }> {
  const profRes = await admin.from("profiles").select("user_id").eq("company_id", companyId);
  if (profRes.error) {
    return { authUsersTargeted: 0, authUsersDeleted: 0, authPartialFailure: true };
  }

  const userIds = Array.from(new Set((profRes.data ?? []).map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean)));

  let authUsersDeleted = 0;
  let authPartialFailure = false;
  for (const uid of userIds) {
    const del = await admin.auth.admin.deleteUser(uid);
    if (del?.error) {
      if (isAuthUserMissing(del.error)) continue;
      authPartialFailure = true;
      continue;
    }
    authUsersDeleted += 1;
  }

  return { authUsersTargeted: userIds.length, authUsersDeleted, authPartialFailure };
}

const CLEANUP_TABLE_LABELS: Record<string, string> = {
  location_closed_dates: "lokasjonsstengte dager",
  location_policies: "lokasjonspolicyer",
  day_choices: "lunsjvalg",
  menu_service_days: "menydager",
  standing_orders: "stående bestillinger",
  location_memberships: "lokasjonsmedlemskap",
  company_memberships: "firmamedlemskap",
  memberships: "identitetsmedlemskap",
  organizations: "organisasjonsdata",
  profiles: "profiler",
  lead_pipeline: "pipeline-rader",
  agreement_change_requests: "avtaleendringsforespørsler",
  agreement_requests: "avtaleforespørsler",
  company_registrations: "registreringsutkast",
  company_invites: "firmainvitasjoner",
  employee_invites: "ansattinvitasjoner",
  agreements: "avtaler",
  company_locations: "lokasjoner",
  company_deletions: "arkiveringsmetadata",
  companies: "firma",
};

function cleanupFailureMessage(table: string, error?: { message?: string; code?: string } | null): string {
  const parsed = parseDbDependencyError(error ?? null);
  if (parsed.isFkViolation) {
    return dependencyBlockedMessage(parsed.table ?? table);
  }
  const label = CLEANUP_TABLE_LABELS[table] ?? table;
  if (table === "profiles") {
    return "Kunne ikke slette firma fordi profiler fortsatt er koblet til firmaet.";
  }
  if (table === "company_locations") {
    return "Kunne ikke slette firma fordi lokasjoner fortsatt er koblet til firmaet.";
  }
  if (table === "agreements") {
    return "Kunne ikke slette firma fordi avtaler fortsatt er koblet til firmaet.";
  }
  return `Kunne ikke fjerne ${label} før sletting.`;
}

type CleanupFailure = {
  ok: false;
  message: string;
  code: string;
  dependencyDetail: CompanyRemovalDependencyDetail;
};

async function deleteByCompanyId(
  admin: SupabaseClient,
  table: string,
  companyId: string,
  cleanupStep: string
): Promise<{ ok: true } | CleanupFailure> {
  const del = await admin.from(table).delete().eq("company_id", companyId);
  if (del.error) {
    if (isMissingRelationError(del.error, table)) return { ok: true };
    return buildCleanupFailure(cleanupStep, table, del.error);
  }
  return { ok: true };
}

async function deleteSpineMembershipsByOrgId(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | CleanupFailure> {
  const del = await admin.from("memberships").delete().eq("org_id", companyId);
  if (del.error) {
    if (isMissingRelationError(del.error, "memberships")) return { ok: true };
    return buildCleanupFailure("spine_memberships", "memberships", del.error);
  }
  return { ok: true };
}

async function deleteOrganizationMirror(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | CleanupFailure> {
  const del = await admin.from("organizations").delete().eq("id", companyId);
  if (del.error) {
    if (isMissingRelationError(del.error, "organizations")) return { ok: true };
    return buildCleanupFailure("organizations", "organizations", del.error);
  }
  return { ok: true };
}

/** Controlled cleanup of non-operational rows before hard delete. Only safe when eligibility already passed. */
export async function cleanupHardDeleteDependencies(
  admin: SupabaseClient,
  companyId: string,
  rid?: string
): Promise<{ ok: true } | CleanupFailure> {
  const fail = async (result: CleanupFailure) => {
    if (rid) await logCleanupFailure(rid, companyId, result);
    return result;
  };

  const nullRefs = await admin
    .from("companies")
    .update({ default_location_id: null, paused_by: null, suspended_by: null } as Record<string, unknown>)
    .eq("id", companyId);
  if (nullRefs.error) {
    return fail(buildCleanupFailure("null_company_refs", "companies", nullRefs.error));
  }

  const locRes = await admin.from("company_locations").select("id").eq("company_id", companyId);
  if (locRes.error) {
    return fail(buildCleanupFailure("load_locations", "company_locations", locRes.error));
  }

  const locIds = (locRes.data ?? []).map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);

  if (locIds.length > 0) {
    const locationChildren = ["location_closed_dates", "location_policies"] as const;
    for (const table of locationChildren) {
      const del = await admin.from(table).delete().in("location_id", locIds);
      if (del.error) {
        return fail(buildCleanupFailure(`location_children:${table}`, table, del.error));
      }
    }
  }

  const setupDeletes = ["day_choices", "menu_service_days", "standing_orders"] as const;
  for (const table of setupDeletes) {
    const result = await deleteByCompanyId(admin, table, companyId, `setup:${table}`);
    if (result.ok === false) return fail(result);
  }

  const spineMemberships = await deleteSpineMembershipsByOrgId(admin, companyId);
  if (spineMemberships.ok === false) return fail(spineMemberships);

  const membershipTables = ["location_memberships", "company_memberships"] as const;
  for (const table of membershipTables) {
    const result = await deleteByCompanyId(admin, table, companyId, `legacy_memberships:${table}`);
    if (result.ok === false) return fail(result);
  }

  await deleteCompanyAuthUsers(admin, companyId);

  const profileDel = await admin.from("profiles").delete().eq("company_id", companyId);
  if (profileDel.error) {
    return fail(buildCleanupFailure("profiles", "profiles", profileDel.error));
  }

  const tableDeletes = [
    "lead_pipeline",
    "agreement_change_requests",
    "agreement_requests",
    "company_registrations",
    "company_invites",
    "employee_invites",
    "agreements",
    "company_deletions",
  ] as const;

  for (const table of tableDeletes) {
    const result = await deleteByCompanyId(admin, table, companyId, `company_rows:${table}`);
    if (result.ok === false) return fail(result);
  }

  const locDel = await admin.from("company_locations").delete().eq("company_id", companyId);
  if (locDel.error) {
    return fail(buildCleanupFailure("company_locations", "company_locations", locDel.error));
  }

  const orgDel = await deleteOrganizationMirror(admin, companyId);
  if (orgDel.ok === false) return fail(orgDel);

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
      return {
        ok: false,
        code: "ALREADY_ARCHIVED",
        message: "Firma kan ikke arkiveres.",
        blockers: eligibility.archiveBlockers,
      };
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

    const access = await deleteCompanyAuthUsers(admin, companyId);
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

  await writeHardDeletePreAudit(actor, {
    companyId,
    companyName: company.name,
    orgnr: company.orgnr,
    reason,
    dependencies: freshDependencies,
    cleanup: freshEligibility.cleanup,
  });

  const cleanup = await cleanupHardDeleteDependencies(admin, companyId, actor.rid);
  if (cleanup.ok === false) {
    return {
      ok: false,
      code: cleanup.code,
      message: cleanup.message,
      blockers: freshEligibility.blockers,
      dependencyDetail: cleanup.dependencyDetail,
    };
  }

  const delRes = await admin.from("companies").delete().eq("id", companyId);
  if (delRes.error) {
    const parsed = parseDbDependencyError(delRes.error);
    const failure = buildCleanupFailure("companies", "companies", delRes.error);
    await logCleanupFailure(actor.rid, companyId, failure);
    return {
      ok: false,
      code: parsed.isFkViolation ? "UNKNOWN_DEPENDENCY" : "DB_ERROR",
      message: failure.message,
      blockers: freshEligibility.blockers,
      dependencyDetail: failure.dependencyDetail,
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
