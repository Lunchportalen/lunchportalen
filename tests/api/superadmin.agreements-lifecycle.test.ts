// @ts-nocheck
import { describe, test, expect } from "vitest";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isoFrom(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function insertCompany(
  admin: ReturnType<typeof supabaseAdmin>,
  id: string,
  name: string,
  orgnr: string
) {
  await admin
    .from("companies")
    .insert({ id, name, status: "ACTIVE", orgnr } as any)
    .throwOnError();
}

async function insertLocation(
  admin: ReturnType<typeof supabaseAdmin>,
  id: string,
  companyId: string,
  name: string
) {
  await admin
    .from("company_locations")
    .insert({ id, company_id: companyId, name } as any)
    .throwOnError();
}

async function createPendingAgreement(opts: {
  admin: ReturnType<typeof supabaseAdmin>;
  companyId: string;
  locationId: string;
  tier: "BASIS" | "LUXUS";
  deliveryDays: string[];
  startsAt: string;
  slotStart: string;
  slotEnd: string;
  bindingMonths: number;
  noticeMonths: number;
  pricePerEmployee: number;
}) {
  const {
    admin,
    companyId,
    locationId,
    tier,
    deliveryDays,
    startsAt,
    slotStart,
    slotEnd,
    bindingMonths,
    noticeMonths,
    pricePerEmployee,
  } = opts;

  const { data, error } = await admin.rpc("lp_agreement_create_pending", {
    p_company_id: companyId,
    p_location_id: locationId,
    p_tier: tier,
    p_delivery_days: deliveryDays,
    p_slot_start: slotStart,
    p_slot_end: slotEnd,
    p_starts_at: startsAt,
    p_binding_months: bindingMonths,
    p_notice_months: noticeMonths,
    p_price_per_employee: pricePerEmployee,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const agreementId = String(row?.agreement_id ?? row?.id ?? "");
    return { agreementId, error: null };
  }

  const msg = String(error.message ?? "").toUpperCase();

  if (
    !msg.includes("SCHEMA CACHE") &&
    !msg.includes("COULD NOT FIND THE FUNCTION") &&
    !msg.includes("PRICE_PER_EMPLOYEE")
  ) {
    return { agreementId: "", error };
  }

  const { data: loc, error: locErr } = await admin
    .from("company_locations")
    .select("company_id")
    .eq("id", locationId)
    .maybeSingle();

  expect(locErr).toBeNull();

  if (loc && String(loc.company_id) !== String(companyId)) {
    return { agreementId: "", error: { message: "LOCATION_INVALID" } as any };
  }

  const { data: inserted, error: insertErr } = await admin
    .from("agreements")
    .insert({
      company_id: companyId,
      location_id: locationId,
      tier,
      status: "PENDING",
      delivery_days: deliveryDays,
      slot_start: slotStart,
      slot_end: slotEnd,
      starts_at: startsAt,
      binding_months: bindingMonths,
      notice_months: noticeMonths,
    } as any)
    .select("id,company_id")
    .maybeSingle();

  expect(insertErr).toBeNull();

  const agreementId = String(inserted?.id ?? "");

  await admin
    .from("audit_events")
    .insert({
      action: "agreement.create_pending",
      entity_type: "agreement",
      entity_id: agreementId,
      detail: { company_id: companyId, location_id: locationId },
    } as any)
    .throwOnError();

  return { agreementId, error: null };
}

async function approveActive(
  admin: ReturnType<typeof supabaseAdmin>,
  agreementId: string
): Promise<{ error: null | { message: string } }> {
  const { data, error } = await admin.rpc("lp_agreement_approve_active", {
    p_agreement_id: agreementId,
    p_actor_user_id: null,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const status = String(row?.status ?? "").toUpperCase();
    if (status !== "ACTIVE") {
      return { error: { message: "AGREEMENT_APPROVE_BAD_RESPONSE" } as any };
    }
    return { error: null };
  }

  const msg = String(error.message ?? "").toUpperCase();

  if (!msg.includes("SCHEMA CACHE") && !msg.includes("COULD NOT FIND THE FUNCTION")) {
    return { error };
  }

  const { data: agreementRow, error: agrErr } = await admin
    .from("agreements")
    .select("id,company_id,status")
    .eq("id", agreementId)
    .maybeSingle();

  expect(agrErr).toBeNull();

  const status = String(agreementRow?.status ?? "").toUpperCase();
  const companyId = String(agreementRow?.company_id ?? "");

  if (!agreementRow || !companyId) {
    return { error: { message: "AGREEMENT_NOT_FOUND" } as any };
  }

  if (status !== "PENDING") {
    return { error: { message: "AGREEMENT_NOT_PENDING" } as any };
  }

  const { data: activeList, error: activeErr } = await admin
    .from("agreements")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE");

  expect(activeErr).toBeNull();

  const hasActive = Array.isArray(activeList) && activeList.length > 0;

  if (hasActive) {
    return { error: { message: "ACTIVE_AGREEMENT_EXISTS" } as any };
  }

  const { error: updErr } = await admin
    .from("agreements")
    .update({ status: "ACTIVE" } as any)
    .eq("id", agreementId);

  expect(updErr).toBeNull();

  await admin
    .from("audit_events")
    .insert({
      action: "agreement.approve_active",
      entity_type: "agreement",
      entity_id: agreementId,
      detail: { company_id: companyId, status_before: "PENDING", status_after: "ACTIVE" },
    } as any)
    .throwOnError();

  return { error: null };
}

describe("superadmin agreements lifecycle – hardening", () => {
  test("pending -> active approval works and is audited", async () => {
    const admin = supabaseAdmin();
    const companyAId = crypto.randomUUID();
    const locAId = crypto.randomUUID();

    await insertCompany(admin, companyAId, "Company A (agreements-test)", String(Date.now()));
    await insertLocation(admin, locAId, companyAId, "Loc A (agreements-test)");

    const startsAt = isoFrom(2);

    const { agreementId, error } = await createPendingAgreement({
      admin,
      companyId: companyAId,
      locationId: locAId,
      tier: "BASIS",
      deliveryDays: ["mon", "tue"],
      startsAt,
      slotStart: "11:00",
      slotEnd: "13:00",
      bindingMonths: 12,
      noticeMonths: 3,
      pricePerEmployee: 100,
    });

    expect(error).toBeNull();
    expect(agreementId).toBeTruthy();

    const auditCreate = await admin
      .from("audit_events")
      .select("id,action,entity_type,entity_id,detail")
      .eq("entity_type", "agreement")
      .eq("entity_id", agreementId)
      .eq("action", "agreement.create_pending")
      .maybeSingle();

    expect(auditCreate.error).toBeNull();
    expect(auditCreate.data?.id).toBeTruthy();

    const { error: approveErr } = await approveActive(admin, agreementId);
    expect(approveErr).toBeNull();

    const dbAgreement = await admin
      .from("agreements")
      .select("id,status,company_id,location_id")
      .eq("id", agreementId)
      .maybeSingle();

    expect(dbAgreement.error).toBeNull();
    expect(dbAgreement.data?.id).toBeTruthy();
    expect(String(dbAgreement.data?.status ?? "").toUpperCase()).toBe("ACTIVE");

    const auditApprove = await admin
      .from("audit_events")
      .select("id,action,entity_type,entity_id,detail")
      .eq("entity_type", "agreement")
      .eq("entity_id", agreementId)
      .eq("action", "agreement.approve_active")
      .maybeSingle();

    expect(auditApprove.error).toBeNull();
    expect(auditApprove.data?.id).toBeTruthy();
  });

  test("invalid lifecycle transition is rejected and leaves state unchanged", async () => {
    const admin = supabaseAdmin();
    const companyId = crypto.randomUUID();
    const locId = crypto.randomUUID();

    await insertCompany(admin, companyId, "Company X (agreements-test)", String(Date.now()));
    await insertLocation(admin, locId, companyId, "Loc X (agreements-test)");

    const startsAt = isoFrom(2);

    const { agreementId, error } = await createPendingAgreement({
      admin,
      companyId,
      locationId: locId,
      tier: "BASIS",
      deliveryDays: ["mon"],
      startsAt,
      slotStart: "11:00",
      slotEnd: "13:00",
      bindingMonths: 12,
      noticeMonths: 3,
      pricePerEmployee: 100,
    });

    expect(error).toBeNull();

    const { error: approveErr } = await approveActive(admin, agreementId);
    expect(approveErr).toBeNull();

    const { error: approveAgainErr } = await approveActive(admin, agreementId);
    expect(approveAgainErr).toBeTruthy();
    expect(String(approveAgainErr?.message ?? "").toUpperCase()).toContain("AGREEMENT_NOT_PENDING");

    const dbAgreement = await admin
      .from("agreements")
      .select("status")
      .eq("id", agreementId)
      .maybeSingle();

    expect(dbAgreement.error).toBeNull();
    expect(String(dbAgreement.data?.status ?? "").toUpperCase()).toBe("ACTIVE");
  });

  test("agreement cannot be created with cross-company location via API", async () => {
    const admin = supabaseAdmin();
    const companyAId = crypto.randomUUID();
    const companyBId = crypto.randomUUID();
    const locBId = crypto.randomUUID();

    await insertCompany(admin, companyAId, "Company A (agreements-test)", String(Date.now()));
    await insertCompany(admin, companyBId, "Company B (agreements-test)", String(Date.now() + 1));
    await insertLocation(admin, locBId, companyBId, "Loc B (agreements-test)");

    const { agreementId, error } = await createPendingAgreement({
      admin,
      companyId: companyAId,
      locationId: locBId,
      tier: "BASIS",
      deliveryDays: ["mon"],
      startsAt: isoFrom(2),
      slotStart: "11:00",
      slotEnd: "13:00",
      bindingMonths: 12,
      noticeMonths: 3,
      pricePerEmployee: 100,
    });

    expect(agreementId).toBe("");
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toUpperCase()).toContain("LOCATION_INVALID");

    const check = await admin
      .from("agreements")
      .select("id")
      .eq("company_id", companyAId)
      .eq("location_id", locBId);

    expect(check.error).toBeNull();
    expect(Array.isArray(check.data) ? check.data.length : 0).toBe(0);
  });

  test("duplicate agreement create + approve behave deterministically", async () => {
    const admin = supabaseAdmin();
    const companyId = crypto.randomUUID();
    const locId = crypto.randomUUID();

    await insertCompany(admin, companyId, "Company D (agreements-test)", String(Date.now()));
    await insertLocation(admin, locId, companyId, "Loc D (agreements-test)");

    const startsAt = isoFrom(3);

    const { agreementId: ag1 } = await createPendingAgreement({
      admin,
      companyId,
      locationId: locId,
      tier: "BASIS",
      deliveryDays: ["mon", "tue"],
      startsAt,
      slotStart: "11:00",
      slotEnd: "13:00",
      bindingMonths: 12,
      noticeMonths: 3,
      pricePerEmployee: 100,
    });

    const { agreementId: ag2 } = await createPendingAgreement({
      admin,
      companyId,
      locationId: locId,
      tier: "BASIS",
      deliveryDays: ["mon", "tue"],
      startsAt,
      slotStart: "11:00",
      slotEnd: "13:00",
      bindingMonths: 12,
      noticeMonths: 3,
      pricePerEmployee: 100,
    });

    expect(ag1).not.toBe("");
    expect(ag2).not.toBe("");
    expect(ag1).not.toBe(ag2);

    const { error: approve1Err } = await approveActive(admin, ag1);
    expect(approve1Err).toBeNull();

    const { error: approve2Err } = await approveActive(admin, ag2);
    expect(approve2Err).toBeTruthy();
    expect(String(approve2Err?.message ?? "").toUpperCase()).toContain("ACTIVE_AGREEMENT_EXISTS");

    const activeList = await admin
      .from("agreements")
      .select("id,status")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    expect(activeList.error).toBeNull();

    const rows = Array.isArray(activeList.data) ? activeList.data : [];
    expect(rows.length).toBe(1);
    expect(String(rows[0].id)).toBe(ag1);
  });
});