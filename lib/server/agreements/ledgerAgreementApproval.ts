import "server-only";

/**
 * Ledger-mutasjoner for public.agreements: approve / reject / pause.
 * HTTP/server-action-kallere MÅ gate superadmin før kall hit (se app/api/superadmin/agreements/... og actions.ts).
 * RPC: lp_agreement_approve_active, lp_agreement_reject_pending, lp_agreement_pause_ledger_active — ingen definert resume for PAUSED i canonical SQL.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditEvent } from "@/lib/audit/write";
import { validateLedgerAgreementForApproval, type LedgerAgreementValidationResult } from "@/lib/server/agreements/validateLedgerAgreementForApproval";
import { parseWeekdayMealTiersFromJson, type WeekdayMealTiers } from "@/lib/registration/weekdayMealTiers";
import {
  deriveSuperadminAgreementListRowPresentation,
  deriveSuperadminRegistrationPipelineNext,
  deriveSuperadminRegistrationPipelinePrimaryHref,
  indexLedgerAgreementsByCompanyId,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  const s = safeStr(v);
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

type ScopeForAudit = { user_id: string | null; email: string | null; role: string | null };

export type LedgerMutationResult =
  | { ok: true; rid: string; data: Record<string, unknown> }
  | { ok: false; rid: string; status: number; code: string; message: string; detail?: unknown };

type AgreementRow = {
  id: string;
  company_id: string;
  status: string;
  tier: string;
  delivery_days: unknown;
  price_per_employee: unknown;
};

export async function fetchLedgerAgreementDetail(agreementId: string): Promise<
  | { ok: true; agreement: AgreementRow; company_name: string; agreement_json: unknown }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!isUuid(agreementId)) {
    return { ok: false, status: 400, code: "BAD_INPUT", message: "Ugyldig avtale." };
  }

  const admin = supabaseAdmin();
  const { data: a, error: aErr } = await admin
    .from("agreements")
    .select("id, company_id, location_id, status, tier, delivery_days, slot_start, slot_end, starts_at, ends_at, binding_months, notice_months, price_per_employee, created_at, updated_at, activated_at, rejection_reason")
    .eq("id", agreementId)
    .maybeSingle();

  if (aErr) {
    return { ok: false, status: 500, code: "READ_FAILED", message: "Kunne ikke hente avtale." };
  }
  if (!a?.id) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Fant ikke avtale." };
  }

  const { data: c, error: cErr } = await admin
    .from("companies")
    .select("name, agreement_json")
    .eq("id", (a as any).company_id)
    .maybeSingle();

  if (cErr) {
    return { ok: false, status: 500, code: "COMPANY_READ_FAILED", message: "Kunne ikke hente firma." };
  }

  return {
    ok: true,
    agreement: {
      id: safeStr((a as any).id),
      company_id: safeStr((a as any).company_id),
      status: safeStr((a as any).status).toUpperCase(),
      tier: safeStr((a as any).tier).toUpperCase(),
      delivery_days: (a as any).delivery_days,
      price_per_employee: (a as any).price_per_employee,
    },
    company_name: safeStr((c as any)?.name) || "Firma",
    agreement_json: (c as any)?.agreement_json ?? null,
  };
}

export async function runLedgerAgreementApprove(opts: {
  rid: string;
  agreementId: string;
  actorUserId: string | null;
  scope: ScopeForAudit;
}): Promise<LedgerMutationResult> {
  const { rid, agreementId, actorUserId, scope } = opts;
  if (!isUuid(agreementId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig avtale." };
  }

  const bundle = await fetchLedgerAgreementDetail(agreementId);
  if (bundle.ok === false) {
    return { ok: false, rid, status: bundle.status, code: bundle.code, message: bundle.message };
  }

  if (bundle.agreement.status !== "PENDING") {
    return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_PENDING", message: "Avtalen er ikke i status Venter." };
  }

  const v = await validateLedgerAgreementForApproval({
    tier: bundle.agreement.tier,
    delivery_days: bundle.agreement.delivery_days,
    price_per_employee: bundle.agreement.price_per_employee,
    agreement_json: bundle.agreement_json,
  });

  if (v.ok === false) {
    return {
      ok: false,
      rid,
      status: 422,
      code: v.code,
      message: "Avtalen er ugyldig og kan ikke godkjennes",
      detail: { validation_message: v.message },
    };
  }

  const admin = supabaseAdmin();
  const { data: coBefore } = await admin
    .from("companies")
    .select("status")
    .eq("id", bundle.agreement.company_id)
    .maybeSingle();
  const companyStatusBeforeRaw = coBefore ? safeStr((coBefore as { status?: unknown }).status).toUpperCase() : "";
  const companyStatusBefore = companyStatusBeforeRaw || null;

  const { data, error } = await admin.rpc("lp_agreement_approve_active", {
    p_agreement_id: agreementId,
    p_actor_user_id: safeStr(actorUserId) || null,
  });

  if (error) {
    const m = safeStr(error.message).toUpperCase();
    if (m.includes("AGREEMENT_NOT_FOUND")) {
      return { ok: false, rid, status: 404, code: "AGREEMENT_NOT_FOUND", message: "Fant ikke avtale." };
    }
    if (m.includes("ACTIVE_AGREEMENT_EXISTS")) {
      return { ok: false, rid, status: 409, code: "ACTIVE_AGREEMENT_EXISTS", message: "Det finnes allerede en aktiv avtale for dette firmaet." };
    }
    if (m.includes("AGREEMENT_NOT_PENDING")) {
      return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_PENDING", message: "Avtalen er ikke i status Venter." };
    }
    return { ok: false, rid, status: 500, code: "AGREEMENT_APPROVE_FAILED", message: "Kunne ikke godkjenne avtalen." };
  }

  const out = (data ?? null) as Record<string, unknown> | null;
  const outAgreementId = safeStr(out?.agreement_id);
  const companyId = safeStr(out?.company_id);
  const status = safeStr(out?.status).toUpperCase();
  const receipt = safeStr(out?.receipt);

  if (!outAgreementId || !companyId || !status || !receipt) {
    return { ok: false, rid, status: 500, code: "AGREEMENT_APPROVE_BAD_RESPONSE", message: "Kunne ikke godkjenne avtalen." };
  }

  const { data: coAfter } = await admin.from("companies").select("status").eq("id", companyId).maybeSingle();
  const companyStatusAfter = safeStr((coAfter as { status?: unknown } | null)?.status).toUpperCase() || null;
  const companyActivatedInSameRpc =
    companyStatusBefore !== null &&
    companyStatusBefore !== "ACTIVE" &&
    companyStatusAfter === "ACTIVE";

  const audit = await writeAuditEvent({
    scope,
    action: "agreement.approve_active",
    entity_type: "agreement",
    entity_id: outAgreementId,
    summary: `Godkjente avtale for company ${companyId}`,
    detail: {
      rid,
      company_id: companyId,
      status_before: "PENDING",
      status_after: status,
      receipt,
      company_status_before: companyStatusBefore,
      company_status_after: companyStatusAfter,
      company_activated_in_same_rpc: companyActivatedInSameRpc,
    },
  });

  return {
    ok: true,
    rid,
    data: {
      agreementId: outAgreementId,
      companyId,
      status,
      receipt,
      message: "Avtalen er godkjent",
      audit_ok: (audit as any)?.ok === true,
      company_status_before: companyStatusBefore,
      company_status_after: companyStatusAfter,
      company_activated_in_same_rpc: companyActivatedInSameRpc,
    },
  };
}

export async function runLedgerAgreementReject(opts: {
  rid: string;
  agreementId: string;
  reason: string | null;
  actorUserId: string | null;
  scope: ScopeForAudit;
}): Promise<LedgerMutationResult> {
  const { rid, agreementId, reason, actorUserId, scope } = opts;
  if (!isUuid(agreementId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig avtale." };
  }

  const bundle = await fetchLedgerAgreementDetail(agreementId);
  if (bundle.ok === false) {
    return { ok: false, rid, status: bundle.status, code: bundle.code, message: bundle.message };
  }

  if (bundle.agreement.status !== "PENDING") {
    return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_PENDING", message: "Avtalen er ikke i status Venter." };
  }

  const trimmed = reason ? safeStr(reason).slice(0, 4000) : "";

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("lp_agreement_reject_pending", {
    p_agreement_id: agreementId,
    p_actor_user_id: safeStr(actorUserId) || null,
    p_reason: trimmed || null,
  });

  if (error) {
    const m = safeStr(error.message).toUpperCase();
    if (m.includes("AGREEMENT_NOT_FOUND")) {
      return { ok: false, rid, status: 404, code: "AGREEMENT_NOT_FOUND", message: "Fant ikke avtale." };
    }
    if (m.includes("AGREEMENT_NOT_PENDING")) {
      return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_PENDING", message: "Avtalen er ikke i status Venter." };
    }
    return { ok: false, rid, status: 500, code: "AGREEMENT_REJECT_FAILED", message: "Kunne ikke avslå avtalen." };
  }

  const out = (data ?? null) as Record<string, unknown> | null;
  const outAgreementId = safeStr(out?.agreement_id);
  const companyId = safeStr(out?.company_id);
  const status = safeStr(out?.status).toUpperCase();

  if (!outAgreementId || !companyId || status !== "REJECTED") {
    return { ok: false, rid, status: 500, code: "AGREEMENT_REJECT_BAD_RESPONSE", message: "Kunne ikke avslå avtalen." };
  }

  const audit = await writeAuditEvent({
    scope,
    action: "agreement.reject_pending",
    entity_type: "agreement",
    entity_id: outAgreementId,
    summary: `Avslo avtale for company ${companyId}`,
    detail: {
      rid,
      company_id: companyId,
      status_before: "PENDING",
      status_after: status,
      reason: trimmed || null,
    },
  });

  return {
    ok: true,
    rid,
    data: {
      agreementId: outAgreementId,
      companyId,
      status,
      message: "Avtalen er avslått",
      audit_ok: (audit as any)?.ok === true,
    },
  };
}

export async function runLedgerAgreementPause(opts: {
  rid: string;
  agreementId: string;
  actorUserId: string | null;
  scope: ScopeForAudit;
}): Promise<LedgerMutationResult> {
  const { rid, agreementId, actorUserId, scope } = opts;
  if (!isUuid(agreementId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig avtale." };
  }

  const bundle = await fetchLedgerAgreementDetail(agreementId);
  if (bundle.ok === false) {
    return { ok: false, rid, status: bundle.status, code: bundle.code, message: bundle.message };
  }

  if (bundle.agreement.status !== "ACTIVE") {
    return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_ACTIVE", message: "Bare aktive avtaler kan pauses." };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("lp_agreement_pause_ledger_active", {
    p_agreement_id: agreementId,
    p_actor_user_id: safeStr(actorUserId) || null,
  });

  if (error) {
    const m = safeStr(error.message).toUpperCase();
    if (m.includes("AGREEMENT_NOT_FOUND")) {
      return { ok: false, rid, status: 404, code: "AGREEMENT_NOT_FOUND", message: "Fant ikke avtale." };
    }
    if (m.includes("AGREEMENT_NOT_ACTIVE")) {
      return { ok: false, rid, status: 409, code: "AGREEMENT_NOT_ACTIVE", message: "Bare aktive avtaler kan pauses." };
    }
    return { ok: false, rid, status: 500, code: "AGREEMENT_PAUSE_FAILED", message: "Kunne ikke pause avtalen." };
  }

  const out = (data ?? null) as Record<string, unknown> | null;
  const outAgreementId = safeStr(out?.agreement_id);
  const companyId = safeStr(out?.company_id);
  const status = safeStr(out?.status).toUpperCase();

  if (!outAgreementId || !companyId || status !== "PAUSED") {
    return { ok: false, rid, status: 500, code: "AGREEMENT_PAUSE_BAD_RESPONSE", message: "Kunne ikke pause avtalen." };
  }

  const audit = await writeAuditEvent({
    scope,
    action: "agreement.pause_ledger",
    entity_type: "agreement",
    entity_id: outAgreementId,
    summary: `Pauset ledger-avtale for company ${companyId}`,
    detail: {
      rid,
      company_id: companyId,
      status_before: "ACTIVE",
      status_after: status,
    },
  });

  return {
    ok: true,
    rid,
    data: {
      agreementId: outAgreementId,
      companyId,
      status,
      message: "Avtalen er satt på pause",
      audit_ok: (audit as any)?.ok === true,
    },
  };
}

export type LedgerAgreementDetailRow = {
  id: string;
  company_id: string;
  location_id: string | null;
  status: string;
  tier: string;
  delivery_days: unknown;
  slot_start: string | null;
  slot_end: string | null;
  starts_at: string | null;
  ends_at: string | null;
  binding_months: number | null;
  notice_months: number | null;
  price_per_employee: number | null;
  created_at: string | null;
  updated_at: string | null;
  activated_at: string | null;
  rejection_reason: string | null;
};

export type LedgerAgreementDetailView =
  | {
      ok: true;
      agreement: LedgerAgreementDetailRow;
      company_name: string;
      company_status: string | null;
      agreement_json: unknown;
      locations: { id: string; name: string }[];
      approvalValidity: LedgerAgreementValidationResult;
      registration_exists: boolean;
      ledger_pending_agreement_id: string | null;
      ledger_active_agreement_id: string | null;
      weekday_meal_tiers: WeekdayMealTiers | null;
      pipeline_stage_label: string;
      pipeline_next_label: string;
      pipeline_next_href: string;
      pipeline_primary_href: string;
    }
  | { ok: false; status: number; code: string; message: string };

export async function loadSuperadminLedgerAgreementDetail(agreementId: string): Promise<LedgerAgreementDetailView> {
  if (!isUuid(agreementId)) {
    return { ok: false, status: 400, code: "BAD_INPUT", message: "Ugyldig avtale." };
  }

  const admin = supabaseAdmin();
  const { data: a, error: aErr } = await admin
    .from("agreements")
    .select(
      "id, company_id, location_id, status, tier, delivery_days, slot_start, slot_end, starts_at, ends_at, binding_months, notice_months, price_per_employee, created_at, updated_at, activated_at, rejection_reason"
    )
    .eq("id", agreementId)
    .maybeSingle();

  if (aErr) {
    return { ok: false, status: 500, code: "READ_FAILED", message: "Kunne ikke hente avtale." };
  }
  if (!a?.id) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Fant ikke avtale." };
  }

  const companyId = safeStr((a as any).company_id);

  const [{ data: c, error: cErr }, { data: locRows, error: lErr }, { data: regRow, error: regErr }, { data: ledgerRows, error: leErr }] =
    await Promise.all([
      admin.from("companies").select("name, agreement_json, status").eq("id", companyId).maybeSingle(),
      admin.from("company_locations").select("id, name").eq("company_id", companyId).order("name", { ascending: true }),
      admin.from("company_registrations").select("company_id, weekday_meal_tiers").eq("company_id", companyId).maybeSingle(),
      admin
        .from("agreements")
        .select("id,company_id,status,created_at")
        .eq("company_id", companyId)
        .in("status", ["PENDING", "ACTIVE"]),
    ]);

  if (cErr) {
    return { ok: false, status: 500, code: "COMPANY_READ_FAILED", message: "Kunne ikke hente firma." };
  }

  if (lErr) {
    return { ok: false, status: 500, code: "LOCATIONS_READ_FAILED", message: "Kunne ikke hente lokasjoner." };
  }

  if (regErr) {
    return { ok: false, status: 500, code: "REGISTRATION_READ_FAILED", message: "Kunne ikke hente firmaregistrering." };
  }

  if (leErr) {
    return { ok: false, status: 500, code: "LEDGER_INDEX_FAILED", message: "Kunne ikke hente ledger-status for firma." };
  }

  const locations = (locRows ?? []).map((r: any) => ({
    id: safeStr(r?.id),
    name: safeStr(r?.name) || "Lokasjon",
  }));

  const company_status = c ? safeStr((c as any).status).toUpperCase() || null : null;
  const registration_exists = !!(regRow && safeStr((regRow as any).company_id));
  const weekday_meal_tiers = parseWeekdayMealTiersFromJson((regRow as any)?.weekday_meal_tiers ?? null);
  const idx = indexLedgerAgreementsByCompanyId((ledgerRows ?? []) as Record<string, unknown>[]);
  const ledger_pending_agreement_id = idx.pendingIdByCompany.get(companyId) ?? null;
  const ledger_active_agreement_id = idx.activeIdByCompany.get(companyId) ?? null;

  const agreement: LedgerAgreementDetailRow = {
    id: safeStr((a as any).id),
    company_id: companyId,
    location_id: (a as any).location_id ? safeStr((a as any).location_id) : null,
    status: safeStr((a as any).status).toUpperCase(),
    tier: safeStr((a as any).tier).toUpperCase(),
    delivery_days: (a as any).delivery_days,
    slot_start: (a as any).slot_start ?? null,
    slot_end: (a as any).slot_end ?? null,
    starts_at: (a as any).starts_at ?? null,
    ends_at: (a as any).ends_at ?? null,
    binding_months: (a as any).binding_months ?? null,
    notice_months: (a as any).notice_months ?? null,
    price_per_employee:
      (a as any).price_per_employee != null && Number.isFinite(Number((a as any).price_per_employee))
        ? Number((a as any).price_per_employee)
        : null,
    created_at: (a as any).created_at ?? null,
    updated_at: (a as any).updated_at ?? null,
    activated_at: (a as any).activated_at ?? null,
    rejection_reason: (a as any).rejection_reason ?? null,
  };

  const agreement_json = (c as any)?.agreement_json ?? null;

  const approvalValidity = await validateLedgerAgreementForApproval({
    tier: agreement.tier,
    delivery_days: agreement.delivery_days,
    price_per_employee: agreement.price_per_employee,
    agreement_json,
  });

  const pipe = deriveSuperadminRegistrationPipelineNext({
    company_status,
    ledger_pending_agreement_id,
    ledger_active_agreement_id,
  });
  const rowPres = deriveSuperadminAgreementListRowPresentation({
    agreement_id: agreement.id,
    agreement_status: agreement.status,
    company_status,
    ledger_pending_agreement_id,
    ledger_active_agreement_id,
  });
  const pipeline_primary_href = deriveSuperadminRegistrationPipelinePrimaryHref({
    company_id: companyId,
    company_status,
    ledger_pending_agreement_id,
    ledger_active_agreement_id,
    registration_exists,
    pipe,
  });

  return {
    ok: true,
    agreement,
    company_name: safeStr((c as any)?.name) || "Firma",
    company_status,
    agreement_json,
    locations,
    approvalValidity,
    registration_exists,
    ledger_pending_agreement_id,
    ledger_active_agreement_id,
    weekday_meal_tiers,
    pipeline_stage_label: rowPres.pipeline_stage_label,
    pipeline_next_label: rowPres.next_label,
    pipeline_next_href: rowPres.next_href,
    pipeline_primary_href,
  };
}
