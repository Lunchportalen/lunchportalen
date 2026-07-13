// tests/rls/domainHardening.agreementOrders.test.ts
// @ts-nocheck

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildRlsFixtures, type Fixtures } from "../_helpers/rlsFixtures";
import { fixturePgQuery } from "../_helpers/fixturePg";

let fx: Fixtures;

/** Global tri-category product ids used by smoke/integration fixtures (company_id null). */
const GLOBAL_PAASMURT_PRODUCT_ID = "c1111111-1111-4111-8111-000000000201";

/**
 * Dedicated RLS fixture provider WITHOUT organization_billing_profiles row.
 * The billing snapshot trigger must skip fixture orders — Melhus (the default
 * provider) has a staging billing profile, and snapshots are append-only with
 * ON DELETE RESTRICT, which would permanently block order re-SET/CANCEL and
 * fixture cleanup (see release-train security phase report).
 */
const RLS_FIXTURE_PROVIDER_ID = "33333333-3333-4333-8333-333333333333";

async function ensureBillingFreeFixtureProvider() {
  await fixturePgQuery(
    `insert into public.providers (id, name, slug, status, contact_email, created_at, updated_at)
     values ($1::uuid, 'RLS Fixture Provider', 'rls-fixture-provider', 'ACTIVE', 'rls-fixture@test.lunchportalen.no', now(), now())
     on conflict (id) do nothing`,
    [RLS_FIXTURE_PROVIDER_ID],
  );
  // Fail-closed: the whole point is that this provider has NO billing profile.
  await fixturePgQuery(
    `do $$ begin
       if exists (select 1 from public.organization_billing_profiles where organization_id = '${RLS_FIXTURE_PROVIDER_ID}') then
         raise exception 'RLS fixture provider must not have a billing profile';
       end if;
     end $$`,
    [],
  );
}

/**
 * lp_order_set (current contract) resolves p_choice_key against the published
 * menu (MSD + MSDI). Seed a published menu day with the global 'paasmurt'
 * product for the fixture company/location/date.
 */
async function seedMenuForOrderDate(companyId: string, locationId: string, date: string) {
  await ensureBillingFreeFixtureProvider();
  await fixturePgQuery(
    `insert into public.products (id, company_id, sku, name, base_price_cents_ex_vat, created_at, updated_at)
     values ($1::uuid, null, 'paasmurt', 'Påsmurt', 9000, now(), now())
     on conflict (id) do update set sku = excluded.sku, updated_at = now()`,
    [GLOBAL_PAASMURT_PRODUCT_ID],
  );
  const msdId = crypto.randomUUID();
  await fixturePgQuery(
    `insert into public.menu_service_days (id, company_id, location_id, service_date, state, provider_id, published_at, created_at, updated_at)
     values ($1::uuid, $2::uuid, $3::uuid, $4::date, 'published', $5::uuid, now(), now(), now())
     on conflict (location_id, service_date) do nothing`,
    [msdId, companyId, locationId, date, RLS_FIXTURE_PROVIDER_ID],
  );
  await fixturePgQuery(
    `insert into public.menu_service_day_items (
       menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot,
       offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional, created_at, updated_at
     )
     select msd.id, $1::uuid, 'Påsmurt', 'porsjon', 9000, 0.15, 1, 10, false, now(), now()
     from public.menu_service_days msd
     where msd.location_id = $2::uuid and msd.service_date = $3::date
       and not exists (
         select 1 from public.menu_service_day_items x
         where x.menu_service_day_id = msd.id and x.product_id = $1::uuid
       )`,
    [GLOBAL_PAASMURT_PRODUCT_ID, locationId, date],
  );
}

function isoFrom(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * lp_agreement_create_pending was deprecated with the manual-draft flow (API
 * returns 410; the RPC is removed from staging AND prod). Agreement invariants
 * now live in DB constraints:
 *   - agreements_company_location_fk  (location must belong to company)
 *   - agreements_no_open_overlap      (one open agreement per location)
 * Fixture agreements are therefore created directly (service role), matching
 * the runtime write-path used by lp_company_register / approval RPCs.
 */
async function ensureActiveAgreementForCompany(
  admin: any,
  args: { companyId: string; locationId: string; deliveryDays: string[]; status?: string; startsAt?: string }
) {
  await ensureBillingFreeFixtureProvider();
  const id = crypto.randomUUID();
  const { error } = await admin.from("agreements").insert({
    id,
    company_id: args.companyId,
    location_id: args.locationId,
    provider_id: RLS_FIXTURE_PROVIDER_ID,
    tier: "BASIS",
    status: args.status ?? "ACTIVE",
    delivery_days: args.deliveryDays,
    slot_start: "11:00",
    slot_end: "13:00",
    starts_at: args.startsAt ?? isoFrom(1),
  } as any);

  if (error) {
    throw new Error(`agreements fixture insert failed: ${error.message}`);
  }

  return id;
}

beforeEach(async () => {
  fx = await buildRlsFixtures();
});

afterEach(async () => {
  if (fx?.cleanup) await fx.cleanup();
});

describe("domain hardening – agreements + orders", () => {
  test("invalid company/location relation is rejected (cross-tenant location)", async () => {
    const { admin, companyA, locB } = fx;

    // location from another company must fail on agreements_company_location_fk
    const { error } = await admin.from("agreements").insert({
      id: crypto.randomUUID(),
      company_id: companyA.id,
      location_id: locB.id,
      provider_id: "11111111-1111-1111-1111-111111111111",
      tier: "BASIS",
      status: "PENDING",
      delivery_days: ["mon"],
      slot_start: "11:00",
      slot_end: "13:00",
      starts_at: isoFrom(1),
    } as any);

    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/agreements_company_location_fk|foreign key/i);
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

  test("DB exclusion constraint prevents multiple open agreements per location", async () => {
    const { admin, companyA, locA } = fx;

    // First agreement: ACTIVE
    const ag1 = await ensureActiveAgreementForCompany(admin, {
      companyId: companyA.id,
      locationId: locA.id,
      deliveryDays: ["mon"],
    });
    expect(ag1).toBeTruthy();

    // Second open agreement for the same location/date window must be rejected
    // by agreements_no_open_overlap (the DB-level replacement for the retired
    // ACTIVE_AGREEMENT_EXISTS RPC check).
    let secondError: unknown = null;
    try {
      await ensureActiveAgreementForCompany(admin, {
        companyId: companyA.id,
        locationId: locA.id,
        deliveryDays: ["tue"],
        status: "PENDING",
        startsAt: isoFrom(2),
      });
    } catch (e) {
      secondError = e;
    }
    expect(secondError).toBeTruthy();
    expect(String((secondError as Error)?.message ?? "")).toMatch(
      /agreements_no_(open|active)_overlap|exclusion constraint/i,
    );
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
    await seedMenuForOrderDate(companyA.id, locA.id, orderDate);
    const sb = supabaseAs(employeeA.accessToken);

    // Multiple writes for the same logical order (current lp_order_set contract)
    const s1 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s1.error, `first SET failed: ${s1.error?.message}`).toBeNull();
    const s2 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: "first", p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s2.error, `second SET failed: ${s2.error?.message}`).toBeNull();
    const s3 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: "second", p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s3.error, `third SET failed: ${s3.error?.message}`).toBeNull();

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
    await seedMenuForOrderDate(companyA.id, locA.id, orderDate);
    const sb = supabaseAs(employeeA.accessToken);

    // Place order once
    const s1 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s1.error, `SET failed: ${s1.error?.message}`).toBeNull();

    // Cancel twice
    const c1 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default", p_choice_key: null, p_item_key: "default" });
    expect(c1.error, `first CANCEL failed: ${c1.error?.message}`).toBeNull();
    const c2 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default", p_choice_key: null, p_item_key: "default" });
    expect(c2.error, `second CANCEL failed: ${c2.error?.message}`).toBeNull();

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
    await seedMenuForOrderDate(companyA.id, locA.id, orderDate);
    const sb = supabaseAs(employeeA.accessToken);

    // Set -> Cancel -> Set again
    const s1 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s1.error, `first SET failed: ${s1.error?.message}`).toBeNull();
    const c1 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "CANCEL", p_note: null, p_slot: "default", p_choice_key: null, p_item_key: "default" });
    expect(c1.error, `CANCEL failed: ${c1.error?.message}`).toBeNull();
    const s2 = await sb.rpc("lp_order_set", { p_date: orderDate, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    expect(s2.error, `second SET failed: ${s2.error?.message}`).toBeNull();

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
    // Canonical lp_order_set contract (proven in production): CANCEL keeps the
    // CANCELLED row as immutable history; re-SET creates a NEW order. Exactly
    // ONE ACTIVE order may exist per user/date/slot — that is the determinism law.
    const active = rows.filter((r) => String(r.status ?? "").toUpperCase() === "ACTIVE");
    const cancelled = rows.filter((r) => String(r.status ?? "").toUpperCase().includes("CANCEL"));
    expect(active.length).toBe(1);
    expect(cancelled.length).toBe(1);
    expect(rows.length).toBe(active.length + cancelled.length);
  });
});

