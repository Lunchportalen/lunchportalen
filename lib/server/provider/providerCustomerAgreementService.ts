// lib/server/provider/providerCustomerAgreementService.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { logIncident } from "@/lib/observability/incident";
import type {
  ProviderAgreementPatchInput,
  ProviderAgreementPatchPayload,
  ProviderAgreementReadModel,
} from "@/lib/providers/providerCustomerAgreementTypes";
import { loadProviderScopedCustomer } from "@/lib/server/provider/providerCustomerRemoval";
import {
  timeFromDbValue,
  timeToDbValue,
  validateProviderAgreementPatch,
} from "@/lib/server/provider/providerCustomerAgreementValidation";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type AgreementRow = {
  id: string;
  company_id: string;
  provider_id: string;
  location_id: string;
  status: string;
  tier: string | null;
  delivery_days: unknown;
  slot_start: string | null;
  slot_end: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  comment_from_company: string | null;
  updated_at: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
};

export type ProviderAgreementActor = {
  rid: string;
  userId: string;
  email: string | null;
};

export type ProviderAgreementServiceOk<T> = { ok: true; data: T };
export type ProviderAgreementServiceErr = {
  ok: false;
  code: string;
  message: string;
  status: number;
};
export type ProviderAgreementServiceResult<T> = ProviderAgreementServiceOk<T> | ProviderAgreementServiceErr;

function err(status: number, code: string, message: string): ProviderAgreementServiceErr {
  return { ok: false, status, code, message };
}

function buildWindowLabel(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return `${from}–${to}`;
}

async function loadActiveAgreement(
  admin: SupabaseClient,
  providerId: string,
  companyId: string,
): Promise<AgreementRow | null> {
  const { data, error } = await admin
    .from("agreements")
    .select(
      "id,company_id,provider_id,location_id,status,tier,delivery_days,slot_start,slot_end,submitted_by_name,submitted_by_email,comment_from_company,updated_at",
    )
    .eq("company_id", companyId)
    .eq("provider_id", providerId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data as AgreementRow;
}

async function loadLocation(admin: SupabaseClient, locationId: string): Promise<LocationRow | null> {
  const { data, error } = await admin
    .from("company_locations")
    .select("id,name,address")
    .eq("id", locationId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data as LocationRow;
}

async function loadRegistrationPhone(admin: SupabaseClient, agreementId: string): Promise<string | null> {
  const { data } = await admin
    .from("company_registrations")
    .select("contact_phone")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const phone = safeStr((data as { contact_phone?: string | null } | null)?.contact_phone);
  return phone || null;
}

function snapshotFromState(input: {
  agreement: AgreementRow;
  location: LocationRow | null;
  phone: string | null;
}): Record<string, unknown> {
  const days = normalizeDeliveryDaysStrict(input.agreement.delivery_days).days;
  const from = timeFromDbValue(input.agreement.slot_start);
  const to = timeFromDbValue(input.agreement.slot_end);
  return {
    plan: safeStr(input.agreement.tier).toUpperCase() || null,
    deliveryDays: days,
    location: input.location
      ? { id: input.location.id, name: input.location.name, address: input.location.address }
      : null,
    contact: {
      name: input.agreement.submitted_by_name,
      email: input.agreement.submitted_by_email,
      phone: input.phone,
    },
    deliveryWindow: from && to ? { from, to, label: buildWindowLabel(from, to) } : null,
    status: input.agreement.status,
    deliveryNote: input.agreement.comment_from_company,
  };
}

function buildReadModel(input: {
  agreement: AgreementRow;
  location: LocationRow | null;
  phone: string | null;
}): ProviderAgreementReadModel {
  const days = normalizeDeliveryDaysStrict(input.agreement.delivery_days).days;
  const from = timeFromDbValue(input.agreement.slot_start);
  const to = timeFromDbValue(input.agreement.slot_end);
  const tier = safeStr(input.agreement.tier).toUpperCase();
  const plan =
    tier === "BASIS" || tier === "LUXUS" || tier === "ENTERPRISE" ? (tier as Tier) : null;

  return {
    agreementId: input.agreement.id,
    companyId: input.agreement.company_id,
    providerId: input.agreement.provider_id,
    status: input.agreement.status,
    plan,
    deliveryDays: days,
    location: {
      id: input.location?.id ?? input.agreement.location_id,
      name: input.location?.name ?? null,
      address: input.location?.address ?? null,
    },
    contact: {
      name: input.agreement.submitted_by_name,
      email: input.agreement.submitted_by_email,
      phone: input.phone,
    },
    deliveryWindow: {
      from,
      to,
      label: buildWindowLabel(from, to),
    },
    deliveryNote: input.agreement.comment_from_company,
    updatedAt: input.agreement.updated_at,
  };
}

async function syncAgreementDayTiers(
  admin: SupabaseClient,
  agreementId: string,
  deliveryDays: DayKey[],
  tier: Tier,
): Promise<void> {
  await admin.from("agreement_delivery_days").delete().eq("agreement_id", agreementId);
  if (deliveryDays.length === 0) return;
  const rows = deliveryDays.map((weekday) => ({
    agreement_id: agreementId,
    weekday,
    tier,
  }));
  await admin.from("agreement_delivery_days").insert(rows);
}

async function writeAgreementAudit(input: {
  rid: string;
  action: string;
  agreementId: string;
  companyId: string;
  locationId: string | null;
  actor: ProviderAgreementActor;
  detail: Record<string, unknown>;
}) {
  await auditWriteMust({
    rid: input.rid,
    action: input.action,
    entity_type: "agreement",
    entity_id: input.agreementId,
    company_id: input.companyId,
    location_id: input.locationId,
    actor_user_id: input.actor.userId,
    actor_email: input.actor.email,
    actor_role: "provider_admin",
    summary: "Provider oppdaterte kundeavtale",
    detail: input.detail,
  });
}

export async function loadProviderCustomerAgreement(
  admin: SupabaseClient,
  providerId: string,
  companyId: string,
): Promise<ProviderAgreementServiceResult<ProviderAgreementReadModel>> {
  const scoped = await loadProviderScopedCustomer(admin, providerId, companyId);
  if ("code" in scoped) {
    const status =
      scoped.code === "NOT_FOUND" ? 404
      : scoped.code === "OUT_OF_SCOPE" || scoped.code === "PROTECTED_SYSTEM" || scoped.code === "SELF_CUSTOMER" ? 403
      : 403;
    return err(status, scoped.code, scoped.message);
  }

  const agreement = await loadActiveAgreement(admin, providerId, companyId);
  if (!agreement) {
    return err(409, "NO_ACTIVE_AGREEMENT", "Firma har ingen aktiv avtale.");
  }

  const [location, phone] = await Promise.all([
    loadLocation(admin, agreement.location_id),
    loadRegistrationPhone(admin, agreement.id),
  ]);

  return { ok: true, data: buildReadModel({ agreement, location, phone }) };
}

export async function executeProviderCustomerAgreementUpdate(
  admin: SupabaseClient,
  actor: ProviderAgreementActor,
  input: {
    providerId: string;
    companyId: string;
    patch: ProviderAgreementPatchInput;
  },
): Promise<ProviderAgreementServiceResult<ProviderAgreementReadModel>> {
  const { providerId, companyId } = input;

  const scoped = await loadProviderScopedCustomer(admin, providerId, companyId);
  if ("code" in scoped) {
    const status =
      scoped.code === "NOT_FOUND" ? 404
      : scoped.code === "OUT_OF_SCOPE" || scoped.code === "PROTECTED_SYSTEM" || scoped.code === "SELF_CUSTOMER" ? 403
      : 403;
    return err(status, scoped.code, scoped.message);
  }

  const agreement = await loadActiveAgreement(admin, providerId, companyId);
  if (!agreement) {
    return err(409, "NO_ACTIVE_AGREEMENT", "Firma har ingen aktiv avtale.");
  }

  const validated = validateProviderAgreementPatch(input.patch);
  if (validated.ok === false) {
    await writeAgreementAudit({
      rid: actor.rid,
      action: "provider.customer.agreement.update.blocked",
      agreementId: agreement.id,
      companyId,
      locationId: agreement.location_id,
      actor,
      detail: {
        provider_id: providerId,
        customer_company_id: companyId,
        agreement_id: agreement.id,
        code: validated.code,
        message: validated.message,
      },
    }).catch(() => undefined);
    const status = validated.code.startsWith("INVALID") || validated.code.includes("EMPTY") ? 400 : 422;
    return err(status, validated.code, validated.message);
  }

  const patch = validated.value;
  const [locationBefore, phoneBefore] = await Promise.all([
    loadLocation(admin, agreement.location_id),
    loadRegistrationPhone(admin, agreement.id),
  ]);
  const before = snapshotFromState({ agreement, location: locationBefore, phone: phoneBefore });

  await writeAgreementAudit({
    rid: actor.rid,
    action: "provider.customer.agreement.update.attempt",
    agreementId: agreement.id,
    companyId,
    locationId: agreement.location_id,
    actor,
    detail: {
      provider_id: providerId,
      customer_company_id: companyId,
      agreement_id: agreement.id,
      changed_fields: Object.keys(patch),
      before,
      reason: patch.reason ?? null,
    },
  }).catch(() => undefined);

  const agreementUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changedFields: string[] = [];

  if (patch.plan) {
    agreementUpdate.tier = patch.plan;
    changedFields.push("plan");
  }
  if (patch.deliveryDays) {
    agreementUpdate.delivery_days = patch.deliveryDays;
    changedFields.push("deliveryDays");
  }
  if (patch.status) {
    agreementUpdate.status = patch.status;
    changedFields.push("status");
  }
  if (patch.deliveryWindow) {
    agreementUpdate.slot_start = timeToDbValue(patch.deliveryWindow.from);
    agreementUpdate.slot_end = timeToDbValue(patch.deliveryWindow.to);
    changedFields.push("deliveryWindow");
  }
  if (patch.contact) {
    if (patch.contact.name !== undefined) {
      agreementUpdate.submitted_by_name = patch.contact.name || null;
      changedFields.push("contact.name");
    }
    if (patch.contact.email !== undefined) {
      agreementUpdate.submitted_by_email = patch.contact.email || null;
      changedFields.push("contact.email");
    }
  }
  if (patch.deliveryNote !== undefined) {
    agreementUpdate.comment_from_company = patch.deliveryNote;
    changedFields.push("deliveryNote");
  }

  try {
    if (Object.keys(agreementUpdate).length > 1) {
      const { error: updErr } = await admin.from("agreements").update(agreementUpdate).eq("id", agreement.id);
      if (updErr) throw updErr;
    }

    if (patch.location && locationBefore) {
      const locUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.location.name !== undefined) locUpdate.name = patch.location.name;
      if (patch.location.address !== undefined) locUpdate.address = patch.location.address;
      if (Object.keys(locUpdate).length > 1) {
        const { error: locErr } = await admin
          .from("company_locations")
          .update(locUpdate)
          .eq("id", locationBefore.id)
          .eq("company_id", companyId);
        if (locErr) throw locErr;
        changedFields.push("location");
      }
    }

    if (patch.contact?.phone !== undefined) {
      const { data: regRows } = await admin
        .from("company_registrations")
        .select("id")
        .eq("agreement_id", agreement.id)
        .limit(1);
      if (Array.isArray(regRows) && regRows.length > 0) {
        await admin
          .from("company_registrations")
          .update({ contact_phone: patch.contact.phone || null, updated_at: new Date().toISOString() })
          .eq("id", (regRows[0] as { id: string }).id);
      }
      changedFields.push("contact.phone");
    }

    const nextDays = patch.deliveryDays ?? normalizeDeliveryDaysStrict(agreement.delivery_days).days;
    const currentTier = safeStr(agreement.tier).toUpperCase();
    const effectiveTier = (patch.plan ?? currentTier) as Tier;
    if (patch.plan || patch.deliveryDays) {
      const tier: Tier =
        effectiveTier === "LUXUS" || effectiveTier === "ENTERPRISE" ? effectiveTier : "BASIS";
      await syncAgreementDayTiers(admin, agreement.id, nextDays, tier);
    }

    const refreshed = await loadActiveAgreement(admin, providerId, companyId);
    if (!refreshed) {
      return err(500, "RELOAD_FAILED", "Avtalen ble oppdatert, men kunne ikke lastes på nytt.");
    }

    const [locationAfter, phoneAfter] = await Promise.all([
      loadLocation(admin, refreshed.location_id),
      loadRegistrationPhone(admin, refreshed.id),
    ]);
    const after = snapshotFromState({ agreement: refreshed, location: locationAfter, phone: phoneAfter });

    await writeAgreementAudit({
      rid: actor.rid,
      action: "provider.customer.agreement.update.success",
      agreementId: agreement.id,
      companyId,
      locationId: refreshed.location_id,
      actor,
      detail: {
        provider_id: providerId,
        customer_company_id: companyId,
        agreement_id: agreement.id,
        changed_fields: changedFields,
        before,
        after,
        reason: patch.reason ?? null,
      },
    });

    return { ok: true, data: buildReadModel({ agreement: refreshed, location: locationAfter, phone: phoneAfter }) };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await logIncident({
      rid: actor.rid,
      scope: "provider.customer.agreement.update",
      severity: "error",
      message: "Provider agreement update failed",
      meta: { company_id: companyId, agreement_id: agreement.id, error: message },
    });
    await writeAgreementAudit({
      rid: actor.rid,
      action: "provider.customer.agreement.update.failed",
      agreementId: agreement.id,
      companyId,
      locationId: agreement.location_id,
      actor,
      detail: {
        provider_id: providerId,
        customer_company_id: companyId,
        agreement_id: agreement.id,
        changed_fields: changedFields,
        before,
        error: message,
        reason: patch.reason ?? null,
      },
    }).catch(() => undefined);
    return err(500, "UPDATE_FAILED", "Kunne ikke oppdatere avtale.");
  }
}

export function listEditableWeekdays(): Array<{ key: DayKey; label: string }> {
  return [
    { key: "mon", label: "Mandag" },
    { key: "tue", label: "Tirsdag" },
    { key: "wed", label: "Onsdag" },
    { key: "thu", label: "Torsdag" },
    { key: "fri", label: "Fredag" },
  ];
}

export const EDITABLE_PLANS: Tier[] = ["BASIS", "LUXUS", "ENTERPRISE"];
