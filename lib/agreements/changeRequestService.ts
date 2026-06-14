// lib/agreements/changeRequestService.ts
import "server-only";

import { writeAuditEvent } from "@/lib/audit/write";
import { fetchAgreementDayTiersForCompany } from "@/lib/agreement/currentAgreement";
import type { AgreementChangeRequestRow, AgreementChangeRequestStatus } from "@/lib/agreements/changeRequestTypes";
import {
  buildCurrentSnapshot,
  parsePackageByDayRequestedChange,
  validateEffectiveFrom,
  validateEffectiveTo,
  validateOverridesAgainstDeliveryDays,
} from "@/lib/agreements/changeRequestValidation";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import type { DayKey, Tier } from "@/lib/agreements/normalize";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  const s = safeStr(v);
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

type ServiceOk<T> = { ok: true; rid: string; data: T };
type ServiceErr = { ok: false; rid: string; status: number; code: string; message: string; detail?: unknown };
type ServiceResult<T> = ServiceOk<T> | ServiceErr;

type ScopeForAudit = { user_id: string | null; email: string | null; role: string | null };

async function loadActiveAgreement(companyId: string) {
  const admin: any = supabaseAdmin();
  const { data, error } = await admin
    .from("agreements")
    .select("id,company_id,location_id,provider_id,status,tier,delivery_days")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data as {
    id: string;
    company_id: string;
    location_id: string;
    provider_id: string;
    status: string;
    tier: string | null;
    delivery_days: unknown;
  };
}

export async function createPackageByDayChangeRequest(opts: {
  rid: string;
  companyId: string;
  requestedByUserId: string | null;
  requestedByRole: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  requestedChange: unknown;
  note?: string | null;
}): Promise<ServiceResult<AgreementChangeRequestRow>> {
  const { rid, companyId, requestedByUserId, requestedByRole } = opts;
  const effectiveFrom = safeStr(opts.effectiveFrom);
  const effectiveTo = opts.effectiveTo ? safeStr(opts.effectiveTo) : null;

  const fromV = validateEffectiveFrom(effectiveFrom);
  if (fromV.ok === false) return { ok: false, rid, status: 422, code: fromV.code, message: fromV.message };

  const toV = validateEffectiveTo(effectiveFrom, effectiveTo);
  if (toV.ok === false) return { ok: false, rid, status: 422, code: toV.code, message: toV.message };

  const parsed = parsePackageByDayRequestedChange(opts.requestedChange);
  if (parsed.ok === false) return { ok: false, rid, status: 422, code: parsed.code, message: parsed.message };
  if (!parsed.value) return { ok: false, rid, status: 422, code: "INVALID_REQUESTED_CHANGE", message: "Ugyldig endringspayload." };

  const agreement = await loadActiveAgreement(companyId);
  if (!agreement) {
    return { ok: false, rid, status: 409, code: "NO_ACTIVE_AGREEMENT", message: "Firma har ingen aktiv avtale." };
  }

  const deliveryNorm = normalizeDeliveryDaysStrict(agreement.delivery_days);
  const overrideV = validateOverridesAgainstDeliveryDays(deliveryNorm.days, parsed.value);
  if (overrideV.ok === false) return { ok: false, rid, status: 422, code: overrideV.code, message: overrideV.message };

  const dayTiers = await fetchAgreementDayTiersForCompany(supabaseAdmin(), companyId);
  const currentSnapshot = buildCurrentSnapshot({
    agreementId: agreement.id,
    providerId: agreement.provider_id,
    tier: agreement.tier,
    deliveryDays: agreement.delivery_days,
    dayTiers: dayTiers as Partial<Record<DayKey, Tier>>,
  });

  const admin: any = supabaseAdmin();
  const row = {
    provider_id: agreement.provider_id,
    company_id: companyId,
    agreement_id: agreement.id,
    requested_by_user_id: requestedByUserId,
    requested_by_role: requestedByRole,
    status: "PENDING_PROVIDER_APPROVAL" satisfies AgreementChangeRequestStatus,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    change_type: "PACKAGE_BY_DAY",
    requested_change: parsed.value,
    current_snapshot: currentSnapshot,
    note: opts.note ? safeStr(opts.note) : null,
  };

  const ins = await admin.from("agreement_change_requests").insert(row as any).select("*").single();
  if (ins.error || !ins.data) {
    return {
      ok: false,
      rid,
      status: 500,
      code: "INSERT_FAILED",
      message: "Kunne ikke opprette endringsforespørsel.",
      detail: ins.error,
    };
  }

  return { ok: true, rid, data: ins.data as AgreementChangeRequestRow };
}

export async function listAgreementChangeRequests(opts: {
  rid: string;
  companyId: string;
  limit?: number;
}): Promise<ServiceResult<AgreementChangeRequestRow[]>> {
  const admin: any = supabaseAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);

  const { data, error } = await admin
    .from("agreement_change_requests")
    .select("*")
    .eq("company_id", opts.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, rid: opts.rid, status: 500, code: "READ_FAILED", message: "Kunne ikke hente forespørsler.", detail: error };
  }

  return { ok: true, rid: opts.rid, data: (data ?? []) as AgreementChangeRequestRow[] };
}

export async function approveAgreementChangeRequest(opts: {
  rid: string;
  requestId: string;
  actorUserId: string | null;
  scope: ScopeForAudit;
  expectedProviderId?: string | null;
}): Promise<ServiceResult<AgreementChangeRequestRow>> {
  const { rid, requestId, actorUserId, scope } = opts;
  if (!isUuid(requestId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig forespørsel." };
  }

  const admin: any = supabaseAdmin();
  const { data: existing, error: readErr } = await admin
    .from("agreement_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (readErr || !existing) {
    return { ok: false, rid, status: 404, code: "NOT_FOUND", message: "Fant ikke endringsforespørsel." };
  }

  const row = existing as AgreementChangeRequestRow;
  const pendingStatuses: AgreementChangeRequestStatus[] = [
    "PENDING_PROVIDER_APPROVAL",
    "PENDING_SUPERADMIN_APPROVAL",
  ];

  if (!pendingStatuses.includes(row.status)) {
    return { ok: false, rid, status: 409, code: "INVALID_STATUS", message: "Forespørselen kan ikke godkjennes i nåværende status." };
  }

  if (opts.expectedProviderId && row.provider_id !== opts.expectedProviderId) {
    return { ok: false, rid, status: 403, code: "PROVIDER_SCOPE_MISMATCH", message: "Forespørselen tilhører en annen leverandør." };
  }

  const { data: agreement, error: agreementErr } = await admin
    .from("agreements")
    .select("id,company_id,provider_id,status")
    .eq("id", row.agreement_id)
    .maybeSingle();

  if (agreementErr || !agreement) {
    return { ok: false, rid, status: 404, code: "AGREEMENT_NOT_FOUND", message: "Tilknyttet avtale finnes ikke." };
  }

  if (safeStr((agreement as any).company_id) !== row.company_id) {
    return { ok: false, rid, status: 409, code: "COMPANY_SCOPE_MISMATCH", message: "Avtale og forespørsel har ulikt firmascope." };
  }

  if (safeStr((agreement as any).provider_id) !== row.provider_id) {
    return { ok: false, rid, status: 409, code: "PROVIDER_AGREEMENT_MISMATCH", message: "Avtale og forespørsel har ulikt leverandørscope." };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await admin
    .from("agreement_change_requests")
    .update({
      status: "APPROVED",
      approved_by_user_id: actorUserId,
      approved_at: now,
    })
    .eq("id", requestId)
    .in("status", pendingStatuses)
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    return { ok: false, rid, status: 500, code: "APPROVE_FAILED", message: "Kunne ikke godkjenne forespørsel.", detail: updErr };
  }

  await writeAuditEvent({
    scope,
    action: "agreement_change_request.approved",
    entity_type: "agreement_change_request",
    entity_id: requestId,
    summary: "Avtaleendring godkjent",
    detail: {
      company_id: row.company_id,
      agreement_id: row.agreement_id,
      provider_id: row.provider_id,
      change_type: row.change_type,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      requested_change: row.requested_change,
    },
  });

  return { ok: true, rid, data: updated as AgreementChangeRequestRow };
}

export async function rejectAgreementChangeRequest(opts: {
  rid: string;
  requestId: string;
  actorUserId: string | null;
  scope: ScopeForAudit;
  reason?: string | null;
  expectedProviderId?: string | null;
}): Promise<ServiceResult<AgreementChangeRequestRow>> {
  const { rid, requestId, actorUserId, scope } = opts;
  if (!isUuid(requestId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig forespørsel." };
  }

  const admin: any = supabaseAdmin();
  const { data: existing } = await admin.from("agreement_change_requests").select("*").eq("id", requestId).maybeSingle();
  if (!existing) {
    return { ok: false, rid, status: 404, code: "NOT_FOUND", message: "Fant ikke endringsforespørsel." };
  }

  const row = existing as AgreementChangeRequestRow;
  if (opts.expectedProviderId && row.provider_id !== opts.expectedProviderId) {
    return { ok: false, rid, status: 403, code: "PROVIDER_SCOPE_MISMATCH", message: "Forespørselen tilhører en annen leverandør." };
  }

  const pendingStatuses: AgreementChangeRequestStatus[] = [
    "PENDING_PROVIDER_APPROVAL",
    "PENDING_SUPERADMIN_APPROVAL",
  ];
  if (!pendingStatuses.includes(row.status)) {
    return { ok: false, rid, status: 409, code: "INVALID_STATUS", message: "Forespørselen kan ikke avvises i nåværende status." };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("agreement_change_requests")
    .update({
      status: "REJECTED",
      rejected_by_user_id: actorUserId,
      rejected_at: now,
      rejection_reason: opts.reason ? safeStr(opts.reason) : null,
    })
    .eq("id", requestId)
    .in("status", pendingStatuses)
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, rid, status: 500, code: "REJECT_FAILED", message: "Kunne ikke avvise forespørsel.", detail: error };
  }

  await writeAuditEvent({
    scope,
    action: "agreement_change_request.rejected",
    entity_type: "agreement_change_request",
    entity_id: requestId,
    summary: "Avtaleendring avvist",
    detail: {
      company_id: row.company_id,
      agreement_id: row.agreement_id,
      rejection_reason: opts.reason ?? null,
    },
  });

  return { ok: true, rid, data: updated as AgreementChangeRequestRow };
}

export async function cancelAgreementChangeRequest(opts: {
  rid: string;
  requestId: string;
  companyId: string;
  actorUserId: string | null;
}): Promise<ServiceResult<AgreementChangeRequestRow>> {
  const { rid, requestId, companyId } = opts;
  if (!isUuid(requestId)) {
    return { ok: false, rid, status: 400, code: "BAD_INPUT", message: "Ugyldig forespørsel." };
  }

  const admin: any = supabaseAdmin();
  const { data: existing } = await admin.from("agreement_change_requests").select("*").eq("id", requestId).maybeSingle();
  if (!existing) {
    return { ok: false, rid, status: 404, code: "NOT_FOUND", message: "Fant ikke endringsforespørsel." };
  }

  const row = existing as AgreementChangeRequestRow;
  if (row.company_id !== companyId) {
    return { ok: false, rid, status: 403, code: "COMPANY_SCOPE_MISMATCH", message: "Forespørselen tilhører et annet firma." };
  }

  const cancellable: AgreementChangeRequestStatus[] = [
    "DRAFT",
    "PENDING_PROVIDER_APPROVAL",
    "PENDING_SUPERADMIN_APPROVAL",
  ];
  if (!cancellable.includes(row.status)) {
    return { ok: false, rid, status: 409, code: "INVALID_STATUS", message: "Forespørselen kan ikke kanselleres i nåværende status." };
  }

  const { data: updated, error } = await admin
    .from("agreement_change_requests")
    .update({ status: "CANCELLED" })
    .eq("id", requestId)
    .in("status", cancellable)
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    return { ok: false, rid, status: 500, code: "CANCEL_FAILED", message: "Kunne ikke kansellere forespørsel.", detail: error };
  }

  return { ok: true, rid, data: updated as AgreementChangeRequestRow };
}
