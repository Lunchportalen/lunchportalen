// tests/rls/domainHardening.agreementOrders.test.ts
// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildRlsFixtures, type Fixtures } from "../_helpers/rlsFixtures";

let fx: Fixtures;

function isoFrom(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function ensureActiveAgreementForCompany(
  admin: any,
  args: { companyId: string; locationId: string; deliveryDays: string[] }
) {
  const today = isoFrom(1); // ensure starts_at is in (near) future but after cutoff logic

  const { data, error } = await admin.rpc("lp_agreement_create_pending", {
    p_company_id: args.companyId,
    p_location_id: args.locationId,
    p_tier: "BASIS",
    p_delivery_days: args.deliveryDays,
    p_slot_start: "11:00",
    p_slot_end: "13:00",
    p_starts_at: today,
    p_binding_months: 12,
    p_notice_months: 3,
    p_price_per_employee: 100,
  });

  if (error) {
    throw new Error(`lp_agreement_create_pending failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const agreementId = String(row?.agreement_id ?? row?.id ?? "");
  if (!agreementId) {
    throw new Error("lp_agreement_create_pending returned no agreement_id");
  }

  const approve = await admin.rpc("lp_agreement_approve_active", {
    p_agreement_id: agreementId,
    p_actor_user_id: null,
  });
  if (approve.error) {
    throw new Error(`lp_agreement_approve_active failed: ${approve.error.message}`);
  }

  return agreementId;
}

beforeEach(async () => {
  fx = await buildRlsFixtures();
});

afterEach(async () => {
  if (fx?.cleanup) await fx.cleanup();
});

describe("domain hardening – agreements + orders", () => {
  test("invalid company/location relation is rejected by lp_agreement_create_pending", async () => {
    const { admin, companyA, companyB, locB } = fx;

    const { error } = await admin.rpc("lp_agreement_create_pending", {
      p_company_id: companyA.id,
      // location from another company should fail with LOCATION_INVALID
      p_location_id: locB.id,
      p_tier: "BASIS",
      p_delivery_days: ["mon"],
      p_slot_start: "11:00",
      p_slot_end: "13:00",
      p_starts_at: isoFrom(1),
      p_binding_months: 12,
      p_notice_months: 3,
      p_price_per_employee: 100,
    });

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toUpperCase()).toContain("LOCATION_INVALID");
  });

  test("agreements.delivery_days DB constraint rejects invalid values", async () => {
    const { admin, companyA, locA } = fx;

    const { error } = await admin.from("agreements").insert({
      id: crypto.randomUUID(),
      company_id: companyA.id,
      location_id: locA.id,
      tier: "BASIS",
      status: "PENDING",
      delivery_days: ["sun"], // invalid according to agreements_delivery_days_ck
      slot_start: "11:00",
      slot_end: "13:00",
    } as any);

    expect(error).toBeTruthy();
  });

  test("companies.orgnr DB constraint rejects invalid format", async () => {
    const { admin } = fx;

    const { error } = await admin.from("companies").insert({
      id: crypto.randomUUID(),
      name: "Invalid Orgnr Co",
      status: "ACTIVE",
      orgnr: "ABC123", // fails companies_orgnr_format_ck (must be 9 digits)
    } as any);

    expect(error).toBeTruthy();
  });

  test("order writes are blocked when no ACTIVE agreement exists", async () => {
    const { admin, companyA, locA, users, supabaseAs } = fx;
    const { employeeA } = users;

    const futureDate = isoFrom(3);
    const sb = supabaseAs(employeeA.accessToken);

    const { data, error } = await sb.rpc("lp_order_set", {
      p_date: futureDate,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
    });

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toUpperCase()).toContain("NO_ACTIVE_AGREEMENT");

    const check = await admin
      .from("orders")
      .select("id")
      .eq("user_id", employeeA.user_id)
      .eq("company_id", companyA.id)
      .eq("location_id", locA.id)
      .eq("date", futureDate);
    expect(check.error).toBeNull();
    expect(Array.isArray(check.data) ? check.data.length : 0).toBe(0);
  });

  test("cutoff enforcement blocks orders on past dates", async () => {
    const { users, supabaseAs } = fx;
    const { employeeA } = users;

    const sb = supabaseAs(employeeA.accessToken);
    const pastDate = isoFrom(-3);

    const { error } = await sb.rpc("lp_order_set", {
      p_date: pastDate,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
    });

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toUpperCase()).toContain("CUTOFF_PASSED");
  });

  test("delivery_days enforcement blocks orders on non-delivery days", async () => {
    const { admin, companyA, locA, users, supabaseAs } = fx;
    const { employeeA } = users;

    // Create ACTIVE agreement that only delivers on Monday
    await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon"],
    });

    // Find a future date that is not Monday (iso weekdow 2..7)
    let nonMonDate = isoFrom(3);
    for (let i = 0; i < 10; i++) {
      const d = new Date(`${nonMonDate}T12:00:00.000Z`);
      const js = d.getUTCDay(); // 0=Sun..6=Sat, Mon=1
      if (js !== 1) break;
      nonMonDate = isoFrom(4 + i);
    }

    const sb = supabaseAs(employeeA.accessToken);
    const { error } = await sb.rpc("lp_order_set", {
      p_date: nonMonDate,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
    });

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toUpperCase()).toContain("OUTSIDE_DELIVERY_DAYS");
  });

  test("lp_agreement_approve_active prevents multiple ACTIVE agreements per company", async () => {
    const { admin, companyA, locA, superadmin } = fx;

    // First agreement: ACTIVE
    const ag1 = await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon"],
    });
    expect(ag1).toBeTruthy();

    // Second agreement: PENDING for same company/location
    const { data: data2, error: err2 } = await admin.rpc("lp_agreement_create_pending", {
      p_company_id: companyA.id,
      p_location_id: locA.id,
      p_tier: "BASIS",
      p_delivery_days: ["tue"],
      p_slot_start: "11:00",
      p_slot_end: "13:00",
      p_starts_at: isoFrom(2),
      p_binding_months: 12,
      p_notice_months: 3,
      p_price_per_employee: 100,
    });
    expect(err2).toBeNull();
    const row2 = Array.isArray(data2) ? data2[0] : data2;
    const ag2 = String(row2?.agreement_id ?? row2?.id ?? "");
    expect(ag2).toBeTruthy();

    // Approving the second should fail with ACTIVE_AGREEMENT_EXISTS
    const approve2 = await admin.rpc("lp_agreement_approve_active", {
      p_agreement_id: ag2,
      p_actor_user_id: superadmin.user_id,
    });
    expect(approve2.error).toBeTruthy();
    expect(String(approve2.error?.message ?? "").toUpperCase()).toContain("ACTIVE_AGREEMENT_EXISTS");
  });

  test("duplicate orders for same user/date/slot collapse to a single row", async () => {
    const { admin, companyA, locA, users, supabaseAs } = fx;
    const { employeeA } = users;

    await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
    });

    const orderDate = isoFrom(2);
    const sb = supabaseAs(employeeA.accessToken);

    // Multiple writes for the same logical order
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default" });
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: "first", p_slot: "default" });
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: "second", p_slot: "default" });

    const check = await admin
      .from("orders")
      .select("id,status,note")
      .eq("user_id", employeeA.user_id)
      .eq("company_id", companyA.id)
      .eq("location_id", locA.id)
      .eq("date", orderDate)
      .eq("slot", "default");

    expect(check.error).toBeNull();
    const rows = Array.isArray(check.data) ? check.data : [];
    expect(rows.length).toBe(1);
    expect(String(rows[0].status ?? "").toUpperCase()).toBe("ACTIVE");
    expect(String(rows[0].note ?? "")).toBe("second");
  });

  test("cancel is idempotent for the same user/date/slot", async () => {
    const { admin, companyA, locA, users, supabaseAs } = fx;
    const { employeeA } = users;

    await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
    });

    const orderDate = isoFrom(2);
    const sb = supabaseAs(employeeA.accessToken);

    // Place order once
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default" });

    // Cancel twice
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default" });
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default" });

    const check = await admin
      .from("orders")
      .select("id,status")
      .eq("user_id", employeeA.user_id)
      .eq("company_id", companyA.id)
      .eq("location_id", locA.id)
      .eq("date", orderDate)
      .eq("slot", "default");

    expect(check.error).toBeNull();
    const rows = Array.isArray(check.data) ? check.data : [];
    expect(rows.length).toBe(1);
    const status = String(rows[0].status ?? "").toUpperCase();
    expect(status).toContain("CANCEL"); // covers CANCELLED/CANCELED variants
  });

  test("order toggle via consecutive lp_order_set calls is deterministic (last write wins)", async () => {
    const { admin, companyA, locA, users, supabaseAs } = fx;
    const { employeeA } = users;

    await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
    });

    const orderDate = isoFrom(2);
    const sb = supabaseAs(employeeA.accessToken);

    // Set -> Cancel -> Set again
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default" });
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default" });
    await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default" });

    const check = await admin
      .from("orders")
      .select("id,status")
      .eq("user_id", employeeA.user_id)
      .eq("company_id", companyA.id)
      .eq("location_id", locA.id)
      .eq("date", orderDate)
      .eq("slot", "default");

    expect(check.error).toBeNull();
    const rows = Array.isArray(check.data) ? check.data : [];
    expect(rows.length).toBe(1);
    expect(String(rows[0].status ?? "").toUpperCase()).toBe("ACTIVE");
  });
});

