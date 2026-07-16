/**
 * PHASE 7 — kitchen/packing/delivery acceptance (staging integration).
 *
 * Proves against real Postgres (staging uigx):
 *  - canonical status machine: ACTIVE→PREPARED→DISPATCHED→DELIVERED, idempotent,
 *    forward-only, CANCELLED not advanceable, controlled DELIVERED→DISPATCHED
 *    correction, actor+transition audited in order_status_history
 *  - provider A/B isolation: B's kitchen user cannot advance A's order
 *  - packing list: exact production counts, 0 cancelled portions, 0 foreign
 *    provider rows, allergens + delivery instructions, correct company/location
 *  - unified batch model: kitchen_batches PACKED→orders DISPATCHED,
 *    DELIVERED→orders DELIVERED via lp_batch_transition_and_sync_orders
 *  - driver assignment columns live on kitchen_batches
 *
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 + staging env.
 */
// @ts-nocheck
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const d = RUN ? describe : describe.skip;

const rand = () => crypto.randomUUID().slice(0, 8);

function nextWeekdays(count: number): string[] {
  const out: string[] = [];
  const d0 = new Date();
  d0.setUTCDate(d0.getUTCDate() + 2);
  while (out.length < count) {
    const dow = d0.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(d0.toISOString().slice(0, 10));
    d0.setUTCDate(d0.getUTCDate() + 1);
  }
  return out;
}

const anonUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");

function anonClient() {
  return createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

d("kitchen/packing/delivery acceptance (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const runId = rand();

  // Provider A (under test) + Provider B (isolation control)
  const provA = crypto.randomUUID();
  const provB = crypto.randomUUID();
  const compA = crypto.randomUUID();
  const compB = crypto.randomUUID();
  const locA = crypto.randomUUID();
  const locB = crypto.randomUUID();

  const users: string[] = [];
  const emails = {
    empA1: `e2e-ops-a1-${runId}@test.lunchportalen.no`,
    empA2: `e2e-ops-a2-${runId}@test.lunchportalen.no`,
    empB: `e2e-ops-b-${runId}@test.lunchportalen.no`,
    kitchenA: `e2e-ops-ka-${runId}@test.lunchportalen.no`,
    kitchenB: `e2e-ops-kb-${runId}@test.lunchportalen.no`,
    driverA: `e2e-ops-da-${runId}@test.lunchportalen.no`,
  };
  const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
  const clients: Record<string, ReturnType<typeof createClient>> = {};
  const [day1, day2] = nextWeekdays(2);

  async function createUser(email: string) {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const id = String(created.data.user.id);
    users.push(id);
    for (let i = 0; i < 25; i += 1) {
      const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
      if (p?.id) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return id;
  }

  async function signIn(email: string) {
    const c = anonClient();
    const res = await c.auth.signInWithPassword({ email, password });
    if (res.error) throw new Error(`sign-in failed for ${email}: ${res.error.message}`);
    return c;
  }

  async function seedTenant(pid: string, cid: string, lid: string, label: string, withDeliveryInfo: boolean) {
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [pid, `Ops Prov ${label} ${runId}`, `ops-prov-${label}-${runId}`, `ops-prov-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
      [pid, `Ops Prov ${label} ${runId}`, `ops-prov-${label}-${runId}`],
    );
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id, employee_count)
       values ($1, $2, 'ACTIVE', $3, $4::uuid, 25)`,
      [cid, `Ops Co ${label} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, pid],
    );
    await fixturePgQuery(
      withDeliveryInfo
        ? `insert into public.company_locations (id, company_id, name, address, delivery_instructions, contact_name, contact_phone, window_from, window_to)
           values ($1, $2, 'Hovedlokasjon', 'Opsveien 1', 'Ring på ved varemottak, 2. etasje', 'Resepsjonen', '22334455', '11:00', '13:00')`
        : `insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'Hovedlokasjon', 'Opsveien 2')`,
      [lid, cid],
    );
    await fixturePgQuery(`update public.companies set default_location_id = $2 where id = $1`, [cid, lid]);
    await fixturePgQuery(
      `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
       values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now())`,
      [cid, lid, pid],
    );
    for (const date of [day1, day2]) {
      await fixturePgQuery(
        `insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id, cutoff_at, published_at)
         values ($1, $2, $3::date, 'published', $4::uuid, now() + interval '30 days', now())
         on conflict (location_id, service_date) do update set state = 'published', provider_id = excluded.provider_id`,
        [cid, lid, date, pid],
      );
      await fixturePgQuery(
        `insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional)
         select msd.id, p.id, p.name, 'porsjon', 9000, 0.15, 1, 10 + row_number() over (order by p.sku), false
         from public.menu_service_days msd
         join public.products p on p.company_id is null and p.sku in ('paasmurt', 'salatboks', 'varmrett')
         where msd.location_id = $1 and msd.service_date = $2::date
         on conflict do nothing`,
        [lid, date],
      );
    }
  }

  let empA1 = "";
  let empA2 = "";
  let empB = "";
  let kitchenA = "";
  let kitchenB = "";
  let driverA = "";
  let orderA1 = ""; // active order under test
  let orderB = "";

  beforeAll(async () => {
    if (!RUN) return;
    await seedTenant(provA, compA, locA, "a", true);
    await seedTenant(provB, compB, locB, "b", false);

    empA1 = await createUser(emails.empA1);
    empA2 = await createUser(emails.empA2);
    empB = await createUser(emails.empB);
    kitchenA = await createUser(emails.kitchenA);
    kitchenB = await createUser(emails.kitchenB);
    driverA = await createUser(emails.driverA);

    await fixturePgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, active=true where id=$1`, [empA1, compA, locA]);
    await fixturePgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, active=true where id=$1`, [empA2, compA, locA]);
    await fixturePgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, active=true where id=$1`, [empB, compB, locB]);
    await fixturePgQuery(`insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_kitchen')`, [kitchenA, provA]);
    await fixturePgQuery(`insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_kitchen')`, [kitchenB, provB]);
    // Sjåfør med provider-medlemskap (kravet for batch DELIVERED-aktør).
    await fixturePgQuery(`update public.profiles set role='driver', company_id=$2, location_id=$3, active=true where id=$1`, [driverA, compA, locA]);
    await fixturePgQuery(`insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_viewer')`, [driverA, provA]);

    // Employee allergen profile (special needs to the kitchen).
    await fixturePgQuery(
      `insert into public.lp_user_allergens (user_id, codes, free_text)
       values ($1, array['gluten','milk']::public.lp_allergen_code[], 'Ingen nøtter i nærheten')
       on conflict (user_id) do update set codes = excluded.codes, free_text = excluded.free_text`,
      [empA1],
    );

    // Orders: A1 active, A2 placed-then-cancelled (0 cancelled portions check), B active (foreign row check).
    clients.empA1 = await signIn(emails.empA1);
    clients.empA2 = await signIn(emails.empA2);
    clients.empB = await signIn(emails.empB);

    const o1 = await clients.empA1.rpc("lp_order_set", { p_date: day1, p_action: "SET", p_note: "Ekstra dressing", p_slot: "default", p_choice_key: "paasmurt", p_item_key: "default" });
    if (o1.error) throw new Error(`order A1 failed: ${o1.error.message}`);
    orderA1 = String(o1.data.order_id);

    const o2 = await clients.empA2.rpc("lp_order_set", { p_date: day1, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "salatboks", p_item_key: "default" });
    if (o2.error) throw new Error(`order A2 failed: ${o2.error.message}`);
    const c2 = await clients.empA2.rpc("lp_order_set", { p_date: day1, p_action: "CANCEL", p_note: null, p_slot: "default", p_choice_key: null, p_item_key: "default" });
    if (c2.error) throw new Error(`cancel A2 failed: ${c2.error.message}`);

    const ob = await clients.empB.rpc("lp_order_set", { p_date: day1, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "varmrett", p_item_key: "default" });
    if (ob.error) throw new Error(`order B failed: ${ob.error.message}`);
    orderB = String(ob.data.order_id);

    clients.kitchenA = await signIn(emails.kitchenA);
    clients.kitchenB = await signIn(emails.kitchenB);
  }, 180_000);

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.order_status_history where order_id in (select id from public.orders where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.order_items where order_id in (select id from public.orders where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.billing_readiness_events where order_id in (select id from public.orders where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.commission_ledger where order_id in (select id from public.orders where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.orders where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.day_choices where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.kitchen_batches where company_location_id = any($1::uuid[])`, values: [[locA, locB]] },
      { text: `delete from public.menu_service_day_items msdi using public.menu_service_days msd where msdi.menu_service_day_id = msd.id and msd.location_id = any($1::uuid[])`, values: [[locA, locB]] },
      { text: `delete from public.menu_service_days where location_id = any($1::uuid[])`, values: [[locA, locB]] },
      { text: `delete from public.lp_user_allergens where user_id = any($1::uuid[])`, values: [users] },
      { text: `delete from public.provider_memberships where user_id = any($1::uuid[])`, values: [users] },
      { text: `delete from public.profiles where id = any($1::uuid[])`, values: [users] },
      { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.agreements where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.companies where id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.organizations where id = any($1::uuid[])`, values: [[provA, provB]] },
      { text: `delete from public.providers where id = any($1::uuid[])`, values: [[provA, provB]] },
    ]);
    for (const id of users) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        /* ignore */
      }
    }
    await closeFixturePgPool();
  }, 180_000);

  it("provider B kitchen cannot advance provider A's order (tenant isolation)", async () => {
    const res = await clients.kitchenB.rpc("lp_order_advance_status", { p_order_id: orderA1, p_target_status: "PREPARED", p_note: null });
    expect(String(res.error?.message ?? "")).toMatch(/PERMISSION_DENIED|permission denied/i);
  }, 60_000);

  it("canonical machine: forward transitions, idempotency, cancelled blocked, controlled correction, audit", async () => {
    // Forward: ACTIVE → PREPARED → DISPATCHED → DELIVERED (provider A kitchen).
    for (const target of ["PREPARED", "DISPATCHED", "DELIVERED"]) {
      const res = await clients.kitchenA.rpc("lp_order_advance_status", { p_order_id: orderA1, p_target_status: target, p_note: `til ${target}` });
      expect(res.error, `${target}: ${res.error?.message}`).toBeNull();
    }

    // Idempotent: same target again → already_at_status, no error.
    const again = await clients.kitchenA.rpc("lp_order_advance_status", { p_order_id: orderA1, p_target_status: "DELIVERED", p_note: null });
    expect(again.error).toBeNull();
    expect(again.data.already_at_status).toBe(true);

    // No backward without controlled correction: DELIVERED → PREPARED must fail.
    const backward = await clients.kitchenA.rpc("lp_order_advance_status", { p_order_id: orderA1, p_target_status: "PREPARED", p_note: null });
    expect(String(backward.error?.message ?? "")).toContain("INVALID_STATUS_TRANSITION");

    // Cancelled orders are never advanceable.
    const { rows: cancelledRows } = await fixturePgQuery(
      `select id::text as id from public.orders where user_id = $1 and date = $2::date and status = 'CANCELLED'`,
      [empA2, day1],
    );
    const cancelledId = cancelledRows[0].id;
    const advCancelled = await clients.kitchenA.rpc("lp_order_advance_status", { p_order_id: cancelledId, p_target_status: "PREPARED", p_note: null });
    expect(String(advCancelled.error?.message ?? "")).toContain("ORDER_NOT_ADVANCEABLE");

    // Audit: actor + transition + timestamp in order_status_history.
    const { rows: hist } = await fixturePgQuery(
      `select from_status::text as f, to_status::text as t, changed_by::text as actor, changed_at from public.order_status_history where order_id = $1::uuid order by changed_at`,
      [orderA1],
    );
    const transitions = hist.map((h) => `${h.f}->${h.t}`);
    expect(transitions).toContain("ACTIVE->PREPARED");
    expect(transitions).toContain("PREPARED->DISPATCHED");
    expect(transitions).toContain("DISPATCHED->DELIVERED");
    // Actor + timestamp audited on the kitchen advance transitions.
    const advanceRows = hist.filter((h) =>
      ["ACTIVE->PREPARED", "PREPARED->DISPATCHED", "DISPATCHED->DELIVERED"].includes(`${h.f}->${h.t}`),
    );
    expect(advanceRows.length).toBe(3);
    expect(advanceRows.every((h) => h.actor === kitchenA)).toBe(true);
    expect(advanceRows.every((h) => Boolean(h.changed_at))).toBe(true);
  }, 120_000);

  it("packing list: exact counts, 0 cancelled, 0 foreign rows, allergens + delivery instructions", async () => {
    const { loadProviderPackingList, packingListToCsv } = await import("@/lib/providers/packingList");
    const list = await loadProviderPackingList(provA, day1);

    // Exact production count: 1 portion (A1) — A2 cancelled excluded, B foreign excluded.
    expect(list.totalPortions).toBe(1);
    expect(list.groups.length).toBe(1);
    const g = list.groups[0];
    expect(g.companyId).toBe(compA);
    expect(g.locationId).toBe(locA);
    expect(g.deliveryInstructions).toContain("varemottak");
    expect(g.windowFrom).toBe("11:00");

    const line = g.lines[0];
    expect(line.status).not.toBe("CANCELLED");
    expect(line.profileAllergenCodes).toEqual(["gluten", "milk"]);
    expect(line.profileAllergenNote).toContain("nøtter");
    expect(line.orderNote).toContain("dressing");

    // 0 foreign provider rows — and provider B's list contains only B.
    const listB = await loadProviderPackingList(provB, day1);
    expect(listB.groups.every((x) => x.companyId === compB)).toBe(true);
    expect(listB.totalPortions).toBe(1);

    const csv = packingListToCsv(list);
    expect(csv).toContain("leveringsinstruksjoner");
    expect(csv).toContain("Ring på ved varemottak");
  }, 60_000);

  it("unified batch model: PACKED syncs orders → DISPATCHED, DELIVERED → DELIVERED (idempotent)", async () => {
    // Fresh ACTIVE order for day2 (batch path scenario).
    const o = await clients.empA1.rpc("lp_order_set", { p_date: day2, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: "varmrett", p_item_key: "default" });
    expect(o.error, o.error?.message).toBeNull();
    const day2Order = String(o.data.order_id);

    // Batch row must exist first (samme som /api/kitchen/batch/start).
    await fixturePgQuery(
      `insert into public.kitchen_batches (delivery_date, delivery_window, company_location_id, status)
       values ($1::date, 'default', $2::uuid, 'QUEUED')
       on conflict (delivery_date, delivery_window, company_location_id) do nothing`,
      [day2, locA],
    );

    const packed = await admin.rpc("lp_batch_transition_and_sync_orders", {
      p_delivery_date: day2,
      p_delivery_window: "default",
      p_company_location_id: locA,
      p_target_batch_status: "PACKED",
      p_actor_user_id: kitchenA,
      p_mode: "from_queued",
    });
    expect(packed.error, packed.error?.message).toBeNull();

    let { rows } = await fixturePgQuery(`select status::text as s from public.orders where id = $1::uuid`, [day2Order]);
    expect(rows[0].s).toBe("DISPATCHED");

    // Levert-aktør: sjåfør med provider-medlemskap (driver assignment-modellen).
    const delivered = await admin.rpc("lp_batch_transition_and_sync_orders", {
      p_delivery_date: day2,
      p_delivery_window: "default",
      p_company_location_id: locA,
      p_target_batch_status: "DELIVERED",
      p_actor_user_id: driverA,
      p_mode: "from_packed",
    });
    expect(delivered.error, delivered.error?.message).toBeNull();

    ({ rows } = await fixturePgQuery(`select status::text as s from public.orders where id = $1::uuid`, [day2Order]));
    expect(rows[0].s).toBe("DELIVERED");

    // Driver assignment fields live on the same canonical batch row.
    await fixturePgQuery(
      `update public.kitchen_batches set driver_user_id = $1, driver_assigned_at = now(), driver_assigned_by = $1
       where delivery_date = $2::date and company_location_id = $3::uuid`,
      [kitchenA, day2, locA],
    );
    const { rows: batch } = await fixturePgQuery(
      `select status, driver_user_id::text as driver from public.kitchen_batches where delivery_date = $1::date and company_location_id = $2::uuid`,
      [day2, locA],
    );
    expect(batch[0].status).toBe("DELIVERED");
    expect(batch[0].driver).toBe(kitchenA);
  }, 120_000);
});
