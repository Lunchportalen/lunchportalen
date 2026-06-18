// lib/server/provider/providerCustomerAgreementService.ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { logIncident } from "@/lib/observability/incident";
import type {
  ProviderAgreementDayMenu,
  ProviderAgreementBilling,
  ProviderAgreementPatchInput,
  ProviderAgreementReadModel,
  ProviderAgreementUpdateResult,
} from "@/lib/providers/providerCustomerAgreementTypes";
import {
  buildProviderInvoiceSettings,
  invoiceMethodLabel,
} from "@/lib/providers/providerCustomerBilling";
import { loadProviderScopedCustomer } from "@/lib/server/provider/providerCustomerRemoval";
import {
  defaultPlanFromDayMenus,
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

type CompanyBillingRow = {
  orgnr: string | null;
  organization_number: string | null;
  billing_email: string | null;
  ehf_enabled: boolean;
  ehf_endpoint: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type DayMenuRow = {
  weekday: string;
  tier: string;
};

async function loadCompanyBilling(admin: SupabaseClient, companyId: string): Promise<CompanyBillingRow | null> {
  const { data, error } = await admin
    .from("companies")
    .select(
      "orgnr,organization_number,billing_email,ehf_enabled,ehf_endpoint,contact_name,contact_email,contact_phone",
    )
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CompanyBillingRow;
}

function buildBillingReadModel(row: CompanyBillingRow | null): ProviderAgreementBilling {
  const settings = buildProviderInvoiceSettings({
    orgnr: row?.orgnr,
    organizationNumber: row?.organization_number,
    billingEmail: row?.billing_email,
    ehfEnabled: row?.ehf_enabled,
    ehfEndpoint: row?.ehf_endpoint,
    contactName: row?.contact_name,
    contactEmail: row?.contact_email,
    contactPhone: row?.contact_phone,
  });
  return {
    method: settings.method,
    methodLabel: invoiceMethodLabel(settings.method),
    invoiceEmail: settings.invoiceEmail,
    orgnr: settings.orgnr,
    ehfEndpoint: settings.ehfEndpoint,
    contact: settings.billingContact,
    recipientLabel: settings.recipientLabel,
  };
}

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

function dbErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return safeStr((error as { message?: string }).message) || "Databasefeil.";
  }
  return safeStr(error) || "Databasefeil.";
}

function throwIfDbError(error: unknown, context: string): void {
  if (error) {
    const wrapped = new Error(`${context}: ${dbErrorMessage(error)}`);
    (wrapped as { cause?: unknown }).cause = error;
    throw wrapped;
  }
}

function buildWindowLabel(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  return `${from}–${to}`;
}

function normTierValue(v: unknown): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

function buildDayMenusFromRows(
  deliveryDays: DayKey[],
  rows: DayMenuRow[],
  fallbackTier: Tier | null,
): ProviderAgreementDayMenu[] {
  const byDay = new Map<DayKey, Tier>();
  for (const row of rows) {
    const day = safeStr(row.weekday).toLowerCase();
    const tier = normTierValue(row.tier);
    if ((DAY_KEYS as readonly string[]).includes(day) && tier) {
      byDay.set(day as DayKey, tier);
    }
  }
  const fallback = fallbackTier ?? "BASIS";
  return deliveryDays.map((day) => ({
    day,
    plan: byDay.get(day) ?? fallback,
  }));
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

async function loadAgreementDayMenuRows(admin: SupabaseClient, agreementId: string): Promise<DayMenuRow[]> {
  const { data, error } = await admin
    .from("agreement_delivery_days")
    .select("weekday,tier")
    .eq("agreement_id", agreementId);
  if (error) return [];
  return Array.isArray(data) ? (data as DayMenuRow[]) : [];
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
  dayMenus: ProviderAgreementDayMenu[];
  billing?: ProviderAgreementBilling;
}): Record<string, unknown> {
  const days = normalizeDeliveryDaysStrict(input.agreement.delivery_days).days;
  const from = timeFromDbValue(input.agreement.slot_start);
  const to = timeFromDbValue(input.agreement.slot_end);
  return {
    defaultPlan: safeStr(input.agreement.tier).toUpperCase() || null,
    deliveryDays: days,
    dayMenus: input.dayMenus,
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
    billing: input.billing ?? null,
  };
}

function buildReadModel(input: {
  agreement: AgreementRow;
  location: LocationRow | null;
  phone: string | null;
  dayMenus: ProviderAgreementDayMenu[];
  billing: ProviderAgreementBilling;
  warnings?: string[];
}): ProviderAgreementUpdateResult {
  const days = normalizeDeliveryDaysStrict(input.agreement.delivery_days).days;
  const from = timeFromDbValue(input.agreement.slot_start);
  const to = timeFromDbValue(input.agreement.slot_end);
  const tier = safeStr(input.agreement.tier).toUpperCase();
  const defaultPlan =
    tier === "BASIS" || tier === "LUXUS" || tier === "ENTERPRISE" ? (tier as Tier) : null;

  return {
    agreementId: input.agreement.id,
    companyId: input.agreement.company_id,
    providerId: input.agreement.provider_id,
    status: input.agreement.status,
    defaultPlan,
    deliveryDays: days,
    dayMenus: input.dayMenus,
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
    billing: input.billing,
    updatedAt: input.agreement.updated_at,
    warnings: input.warnings,
  };
}

async function syncAgreementDayMenus(
  admin: SupabaseClient,
  agreementId: string,
  dayMenus: ProviderAgreementDayMenu[],
): Promise<void> {
  const { error: delErr } = await admin.from("agreement_delivery_days").delete().eq("agreement_id", agreementId);
  throwIfDbError(delErr, "Kunne ikke oppdatere meny per dag");

  if (dayMenus.length === 0) return;

  const rows = dayMenus.map(({ day, plan }) => ({
    agreement_id: agreementId,
    weekday: day,
    tier: plan,
  }));
  const { error: insErr } = await admin.from("agreement_delivery_days").insert(rows);
  throwIfDbError(insErr, "Kunne ikke lagre meny per dag");
}

async function writeAgreementAudit(input: {
  rid: string;
  action: string;
  agreementId: string;
  companyId: string;
  locationId: string | null;
  actor: ProviderAgreementActor;
  detail: Record<string, unknown>;
  must?: boolean;
}) {
  const write = auditWriteMust({
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
  if (input.must) {
    await write;
  } else {
    await write.catch(() => undefined);
  }
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

  const [location, phone, dayRows, billingRow] = await Promise.all([
    loadLocation(admin, agreement.location_id),
    loadRegistrationPhone(admin, agreement.id),
    loadAgreementDayMenuRows(admin, agreement.id),
    loadCompanyBilling(admin, companyId),
  ]);

  const deliveryDays = normalizeDeliveryDaysStrict(agreement.delivery_days).days;
  const fallback = normTierValue(agreement.tier);
  const dayMenus = buildDayMenusFromRows(deliveryDays, dayRows, fallback);
  const billing = buildBillingReadModel(billingRow);

  return { ok: true, data: buildReadModel({ agreement, location, phone, dayMenus, billing }) };
}

export async function executeProviderCustomerAgreementUpdate(
  admin: SupabaseClient,
  actor: ProviderAgreementActor,
  input: {
    providerId: string;
    companyId: string;
    patch: ProviderAgreementPatchInput;
  },
): Promise<ProviderAgreementServiceResult<ProviderAgreementUpdateResult>> {
  const { providerId, companyId } = input;
  const warnings: string[] = [];

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
    });
    const status = validated.code.startsWith("INVALID") || validated.code.includes("EMPTY") || validated.code.includes("MISSING") ? 400 : 422;
    return err(status, validated.code, validated.message);
  }

  const patch = validated.value;
  const [locationBefore, phoneBefore, dayRowsBefore, billingBeforeRow] = await Promise.all([
    loadLocation(admin, agreement.location_id),
    loadRegistrationPhone(admin, agreement.id),
    loadAgreementDayMenuRows(admin, agreement.id),
    loadCompanyBilling(admin, companyId),
  ]);
  const billingBefore = buildBillingReadModel(billingBeforeRow);
  const deliveryDaysBefore = normalizeDeliveryDaysStrict(agreement.delivery_days).days;
  const dayMenusBefore = buildDayMenusFromRows(
    deliveryDaysBefore,
    dayRowsBefore,
    normTierValue(agreement.tier),
  );
  const before = snapshotFromState({
    agreement,
    location: locationBefore,
    phone: phoneBefore,
    dayMenus: dayMenusBefore,
    billing: billingBefore,
  });

  const auditAction = patch.billing ? "provider.customer.billing.update.attempt" : "provider.customer.agreement.update.attempt";
  await writeAgreementAudit({
    rid: actor.rid,
    action: auditAction,
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
  });

  const agreementUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const changedFields: string[] = [];

  const nextDayMenus =
    patch.dayMenus ??
    (patch.plan && patch.deliveryDays
      ? patch.deliveryDays.map((day) => ({ day, plan: patch.plan! }))
      : undefined);

  if (patch.deliveryDays) {
    agreementUpdate.delivery_days = patch.deliveryDays;
    changedFields.push("deliveryDays");
  }
  if (nextDayMenus) {
    agreementUpdate.tier = defaultPlanFromDayMenus(nextDayMenus);
    changedFields.push("dayMenus", "defaultPlan");
  } else if (patch.plan) {
    agreementUpdate.tier = patch.plan;
    changedFields.push("defaultPlan");
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

  const companyBillingUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.billing) {
    if (patch.billing.method === "EMAIL") {
      companyBillingUpdate.billing_email = patch.billing.invoiceEmail ?? null;
      companyBillingUpdate.ehf_enabled = false;
      companyBillingUpdate.ehf_endpoint = null;
      changedFields.push("billing.method", "billing.invoiceEmail");
    }
    if (patch.billing.method === "EHF") {
      companyBillingUpdate.ehf_enabled = true;
      companyBillingUpdate.ehf_endpoint = patch.billing.ehfEndpoint ?? null;
      if (patch.billing.orgnr) companyBillingUpdate.orgnr = patch.billing.orgnr;
      changedFields.push("billing.method", "billing.ehfEndpoint");
      if (patch.billing.orgnr) changedFields.push("billing.orgnr");
    }
    if (patch.billing.contact) {
      if (patch.billing.contact.name !== undefined) {
        companyBillingUpdate.contact_name = patch.billing.contact.name || null;
        changedFields.push("billing.contact.name");
      }
      if (patch.billing.contact.email !== undefined) {
        companyBillingUpdate.contact_email = patch.billing.contact.email || null;
        changedFields.push("billing.contact.email");
      }
      if (patch.billing.contact.phone !== undefined) {
        companyBillingUpdate.contact_phone = patch.billing.contact.phone || null;
        changedFields.push("billing.contact.phone");
      }
    }
  }

  try {
    if (Object.keys(agreementUpdate).length > 1) {
      const { error: updErr } = await admin.from("agreements").update(agreementUpdate).eq("id", agreement.id);
      throwIfDbError(updErr, "Kunne ikke oppdatere avtale");
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
        throwIfDbError(locErr, "Kunne ikke oppdatere lokasjon");
        changedFields.push("location");
      }
    }

    if (patch.billing && Object.keys(companyBillingUpdate).length > 1) {
      const { error: billingErr } = await admin
        .from("companies")
        .update(companyBillingUpdate)
        .eq("id", companyId)
        .eq("provider_id", providerId);
      throwIfDbError(billingErr, "Kunne ikke oppdatere fakturering");
    }

    if (patch.contact?.phone !== undefined) {
      try {
        const { data: regRows, error: regLookupErr } = await admin
          .from("company_registrations")
          .select("id")
          .eq("agreement_id", agreement.id)
          .limit(1);
        throwIfDbError(regLookupErr, "Kunne ikke slå opp registrering for telefon");
        if (Array.isArray(regRows) && regRows.length > 0) {
          const { error: regErr } = await admin
            .from("company_registrations")
            .update({ contact_phone: patch.contact.phone || null, updated_at: new Date().toISOString() })
            .eq("id", (regRows[0] as { id: string }).id);
          throwIfDbError(regErr, "Kunne ikke oppdatere telefon");
          changedFields.push("contact.phone");
        } else {
          warnings.push("Telefon ble ikke lagret fordi kunden ikke har koblet registrering.");
        }
      } catch (phoneErr: unknown) {
        warnings.push(
          phoneErr instanceof Error ? phoneErr.message : "Telefon kunne ikke lagres, men øvrige felter ble oppdatert.",
        );
      }
    }

    const effectiveDeliveryDays =
      patch.deliveryDays ?? normalizeDeliveryDaysStrict(agreement.delivery_days).days;
    let menusToSync = nextDayMenus;
    if (!menusToSync && patch.plan) {
      menusToSync = effectiveDeliveryDays.map((day) => ({ day, plan: patch.plan! }));
    }
    if (!menusToSync && patch.deliveryDays) {
      const fallback = normTierValue(agreement.tier) ?? "BASIS";
      menusToSync = buildDayMenusFromRows(effectiveDeliveryDays, dayRowsBefore, fallback);
    }
    if (menusToSync) {
      await syncAgreementDayMenus(admin, agreement.id, menusToSync);
    }

    const refreshed = await loadActiveAgreement(admin, providerId, companyId);
    if (!refreshed) {
      return err(500, "RELOAD_FAILED", "Avtalen ble oppdatert, men kunne ikke lastes på nytt.");
    }

    const [locationAfter, phoneAfter, dayRowsAfter, billingAfterRow] = await Promise.all([
      loadLocation(admin, refreshed.location_id),
      loadRegistrationPhone(admin, refreshed.id),
      loadAgreementDayMenuRows(admin, refreshed.id),
      loadCompanyBilling(admin, companyId),
    ]);
    const billingAfter = buildBillingReadModel(billingAfterRow);
    const deliveryDaysAfter = normalizeDeliveryDaysStrict(refreshed.delivery_days).days;
    const dayMenusAfter = buildDayMenusFromRows(
      deliveryDaysAfter,
      dayRowsAfter,
      normTierValue(refreshed.tier),
    );
    const after = snapshotFromState({
      agreement: refreshed,
      location: locationAfter,
      phone: phoneAfter,
      dayMenus: dayMenusAfter,
      billing: billingAfter,
    });

    const successAction = patch.billing
      ? "provider.customer.billing.update.success"
      : "provider.customer.agreement.update.success";
    await writeAgreementAudit({
      rid: actor.rid,
      action: successAction,
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
        warnings,
      },
    });

    return {
      ok: true,
      data: buildReadModel({
        agreement: refreshed,
        location: locationAfter,
        phone: phoneAfter,
        dayMenus: dayMenusAfter,
        billing: billingAfter,
        warnings: warnings.length > 0 ? warnings : undefined,
      }),
    };
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
    });
    const userMessage = message.startsWith("Kunne ikke") ? message : `Kunne ikke oppdatere avtale: ${message}`;
    return err(500, "UPDATE_FAILED", userMessage);
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
