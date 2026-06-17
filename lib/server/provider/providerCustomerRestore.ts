import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";
import { matchesHardDeleteConfirmation } from "@/lib/server/superadmin/companyRemovalPolicy";
import {
  loadProviderScopedCustomer,
  type ProviderCustomerRemovalScopeError,
} from "@/lib/server/provider/providerCustomerRemoval";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type CompanyRemovalActor = {
  rid: string;
  userId: string | null;
  email: string | null;
};

export type ProviderCustomerRestoreResult =
  | {
      ok: true;
      companyId: string;
      hasActiveAgreement: boolean;
      message: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      blockers?: string[];
    };

async function auditProviderCustomerRestore(input: {
  rid: string;
  actor: CompanyRemovalActor;
  providerId: string;
  companyId: string;
  outcome: "attempt" | "blocked" | "success";
  previousStatus?: string | null;
  newStatus?: string | null;
  blockers?: string[];
  reason?: string | null;
}) {
  const action =
    input.outcome === "blocked"
      ? "provider.customer.restore.blocked"
      : input.outcome === "success"
        ? "provider.customer.restore.success"
        : "provider.customer.restore.attempt";

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
        outcome: input.outcome,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
        blockers: input.blockers ?? [],
        reason: input.reason ?? null,
        via: "provider.customers.restore",
      },
    });
  } catch (err) {
    await logIncident({
      scope: "provider.customers",
      severity: "warn",
      rid: input.rid,
      message: "Provider customer restore audit failed",
      meta: {
        providerId: input.providerId,
        companyId: input.companyId,
        action,
        error: err instanceof Error ? err.message : String(err ?? "unknown"),
      },
    });
  }
}

function isArchivedCompany(row: {
  deleted_at?: string | null;
  status?: string | null;
}): boolean {
  if (safeStr(row.deleted_at)) return true;
  return safeStr(row.status).toUpperCase() === "CLOSED";
}

export async function executeProviderCustomerRestore(
  admin: SupabaseClient,
  actor: CompanyRemovalActor,
  input: {
    providerId: string;
    companyId: string;
    confirmation: string;
    reason?: string | null;
  }
): Promise<ProviderCustomerRestoreResult> {
  const providerId = safeStr(input.providerId);
  const companyId = safeStr(input.companyId);

  const scoped = await loadProviderScopedCustomer(admin, providerId, companyId);
  if ("code" in scoped) {
    await auditProviderCustomerRestore({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
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

  const { data: companyRow, error: companyErr } = await admin
    .from("companies")
    .select("id,status,deleted_at,deleted_by,delete_reason,name,orgnr,provider_id")
    .eq("id", companyId)
    .maybeSingle();

  if (companyErr || !companyRow?.id) {
    const message = "Fant ikke kunde.";
    await auditProviderCustomerRestore({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      outcome: "blocked",
      blockers: [message],
      reason: input.reason ?? null,
    });
    return { ok: false, code: "NOT_FOUND", message, blockers: [message] };
  }

  const row = companyRow as {
    status?: string | null;
    deleted_at?: string | null;
    name?: string | null;
    orgnr?: string | null;
  };

  if (!isArchivedCompany(row)) {
    const message = "Kunden er allerede aktiv.";
    await auditProviderCustomerRestore({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      outcome: "blocked",
      blockers: [message],
      previousStatus: row.status ?? null,
      reason: input.reason ?? null,
    });
    return { ok: false, code: "ALREADY_ACTIVE", message, blockers: [message] };
  }

  if (
    !matchesHardDeleteConfirmation({
      confirmation: input.confirmation,
      companyName: row.name ?? null,
      orgnr: row.orgnr ?? null,
    })
  ) {
    const message = "Bekreftelsen må være eksakt org.nr eller firmanavn.";
    await auditProviderCustomerRestore({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      outcome: "blocked",
      blockers: [message],
      previousStatus: row.status ?? null,
      reason: input.reason ?? null,
    });
    return { ok: false, code: "CONFIRM_MISMATCH", message, blockers: [message] };
  }

  await auditProviderCustomerRestore({
    rid: actor.rid,
    actor,
    providerId,
    companyId,
    outcome: "attempt",
    previousStatus: row.status ?? null,
    reason: input.reason ?? null,
  });

  const now = new Date().toISOString();
  const update = await admin
    .from("companies")
    .update({
      status: "ACTIVE",
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: now,
    } as Record<string, unknown>)
    .eq("id", companyId);

  if (update.error) {
    const message = "Kunne ikke gjenopprette kunde.";
    await auditProviderCustomerRestore({
      rid: actor.rid,
      actor,
      providerId,
      companyId,
      outcome: "blocked",
      blockers: [message],
      previousStatus: row.status ?? null,
      reason: input.reason ?? null,
    });
    return { ok: false, code: "DB_ERROR", message, blockers: [message] };
  }

  const { data: activeAgreement } = await admin
    .from("agreements")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  const hasActiveAgreement = Boolean(activeAgreement?.id);
  const message = hasActiveAgreement
    ? "Kunden er gjenopprettet."
    : "Kunden er gjenopprettet. Avtale må aktiveres før bestilling.";

  await auditProviderCustomerRestore({
    rid: actor.rid,
    actor,
    providerId,
    companyId,
    outcome: "success",
    previousStatus: row.status ?? null,
    newStatus: "ACTIVE",
    reason: input.reason ?? null,
  });

  return {
    ok: true,
    companyId,
    hasActiveAgreement,
    message,
  };
}

export type { ProviderCustomerRemovalScopeError };
