import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";
import {
  evaluateCompanyRemovalEligibility,
  loadCompanyDependencyCounts,
  type CompanyRemovalEligibility,
} from "@/lib/server/superadmin/companyRemovalPolicy";
import {
  executeCompanyRemoval,
  type CompanyRemovalActor,
  type CompanyRemovalResult,
} from "@/lib/server/superadmin/executeCompanyRemoval";
import { isSystemPlatformCompanyName } from "@/lib/server/superadmin/superadminEntityKind";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type ProviderScopedCustomer = {
  id: string;
  name: string | null;
  orgnr: string | null;
  providerId: string;
  deletedAt: string | null;
};

export type ProviderCustomerRemovalScopeError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "OUT_OF_SCOPE"; message: string }
  | { code: "PROTECTED_SYSTEM"; message: string };

export async function loadProviderScopedCustomer(
  admin: SupabaseClient,
  providerId: string,
  companyId: string
): Promise<ProviderScopedCustomer | ProviderCustomerRemovalScopeError> {
  const pid = safeStr(providerId);
  const cid = safeStr(companyId);
  if (!pid || !cid) return { code: "NOT_FOUND", message: "Fant ikke kunde." };

  const { data, error } = await admin
    .from("companies")
    .select("id,name,orgnr,provider_id,deleted_at")
    .eq("id", cid)
    .maybeSingle();

  if (error || !data?.id) return { code: "NOT_FOUND", message: "Fant ikke kunde." };

  const rowProviderId = safeStr((data as { provider_id?: string }).provider_id);
  if (rowProviderId !== pid) {
    return { code: "OUT_OF_SCOPE", message: "Kunden tilhører ikke denne leverandøren." };
  }

  const name = (data as { name?: string | null }).name ?? null;
  if (isSystemPlatformCompanyName(name)) {
    return { code: "PROTECTED_SYSTEM", message: "Lunchportalen er systemorganisasjon og kan ikke slettes." };
  }

  return {
    id: cid,
    name,
    orgnr: (data as { orgnr?: string | null }).orgnr ?? null,
    providerId: pid,
    deletedAt: (data as { deleted_at?: string | null }).deleted_at ?? null,
  };
}

export async function getProviderCustomerRemovalEligibility(
  admin: SupabaseClient,
  providerId: string,
  companyId: string
): Promise<
  | { ok: true; company: ProviderScopedCustomer; eligibility: CompanyRemovalEligibility }
  | { ok: false; code: string; message: string; blockers?: string[] }
> {
  const scoped = await loadProviderScopedCustomer(admin, providerId, companyId);
  if ("code" in scoped) {
    return {
      ok: false,
      code: scoped.code,
      message: scoped.message,
      blockers: [scoped.message],
    };
  }

  const dependencies = await loadCompanyDependencyCounts(admin, companyId);
  const eligibility = evaluateCompanyRemovalEligibility({
    companyName: scoped.name,
    orgnr: scoped.orgnr,
    deletedAt: scoped.deletedAt,
    dependencies,
  });

  return { ok: true, company: scoped, eligibility };
}

async function auditProviderCustomerRemovalAttempt(input: {
  rid: string;
  actor: CompanyRemovalActor;
  providerId: string;
  companyId: string;
  mode: "archive" | "hard_delete";
  outcome: "attempt" | "blocked" | "success";
  blockers?: string[];
  reason?: string | null;
}) {
  const action =
    input.outcome === "blocked"
      ? "provider.customer.remove.blocked"
      : input.outcome === "success"
        ? input.mode === "hard_delete"
          ? "provider.customer.hard_delete.success"
          : "provider.customer.archive.success"
        : input.mode === "hard_delete"
          ? "provider.customer.hard_delete.attempt"
          : "provider.customer.archive.attempt";

  try {
    await auditWriteMust({
      rid: input.rid,
      action,
      entity_type: "company",
      entity_id: input.companyId,
      company_id: input.companyId,
      actor_user_id: input.actor.userId,
      actor_email: input.actor.email,
      actor_role: "provider_admin",
      summary: action,
      detail: {
        providerId: input.providerId,
        customerCompanyId: input.companyId,
        mode: input.mode,
        outcome: input.outcome,
        blockers: input.blockers ?? [],
        reason: input.reason ?? null,
        via: "provider.customers.remove",
      },
    });
  } catch (err) {
    await logIncident({
      scope: "provider.customers",
      severity: "warn",
      rid: input.rid,
      message: "Provider customer removal audit failed",
      meta: {
        providerId: input.providerId,
        companyId: input.companyId,
        action,
        error: err instanceof Error ? err.message : String(err ?? "unknown"),
      },
    });
  }
}

export async function executeProviderCustomerRemoval(
  admin: SupabaseClient,
  actor: CompanyRemovalActor,
  input: {
    providerId: string;
    companyId: string;
    mode: "archive" | "hard_delete";
    confirmation: string;
    reason?: string | null;
  }
): Promise<CompanyRemovalResult> {
  const providerId = safeStr(input.providerId);
  const companyId = safeStr(input.companyId);
  const mode = input.mode;

  const scoped = await loadProviderScopedCustomer(admin, providerId, companyId);
  if ("code" in scoped) {
    await auditProviderCustomerRemovalAttempt({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      mode,
      outcome: "blocked",
      blockers: [scoped.message],
      reason: input.reason ?? null,
    });
    return {
      ok: false,
      code: scoped.code,
      message: scoped.message,
      blockers: [scoped.message],
    };
  }

  await auditProviderCustomerRemovalAttempt({
    rid: actor.rid,
    actor,
    providerId,
    companyId,
    mode,
    outcome: "attempt",
    reason: input.reason ?? null,
  });

  const result = await executeCompanyRemoval(admin, actor, {
    companyId,
    mode,
    confirmation: input.confirmation,
    reason: input.reason ?? null,
    requiredProviderId: providerId,
    actorRole: "provider_admin",
    auditVia: "provider.customers.remove",
  });

  if (result.ok === false) {
    await auditProviderCustomerRemovalAttempt({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      mode,
      outcome: "blocked",
      blockers: result.blockers ?? [result.message],
      reason: input.reason ?? null,
    });
    return result;
  }

  await auditProviderCustomerRemovalAttempt({
    rid: actor.rid,
    actor,
    providerId,
    companyId,
    mode,
    outcome: "success",
    reason: input.reason ?? null,
  });

  return result;
}
