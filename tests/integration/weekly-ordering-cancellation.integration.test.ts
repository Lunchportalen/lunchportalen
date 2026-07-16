/**
 * PHASE 6 — employee ordering + cancellation acceptance (staging integration).
 *
 * Proves against real Postgres (staging uigx), via the canonical engine only:
 *  - daily SET → ACTIVE order with server-resolved provider/company/location
 *  - update (re-SET with new choice) keeps exactly ONE ACTIVE order
 *  - CANCEL before cutoff → CANCELLED history row, items+day_choices removed
 *  - production basis corrected (ACTIVE count = 0 for the cancelled day)
 *  - commission correction RPC is idempotent (0 rows + LEDGER_SKIPPED when no
 *    completed commission exists — normal pre-delivery cancel)
 *  - cutoff fail-closed for past dates (CUTOFF_PASSED)
 *  - re-SET after CANCEL → new ACTIVE + immutable CANCELLED history
 *  - order_status_history is populated
 *  - 0 wrong-provider orders
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

/** Neste N ukedager (man–fre) i Oslo, minst 2 dager frem (aldri cutoff-følsomt). */
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

function lastWeekday(): string {
  const d0 = new Date();
  d0.setUTCDate(d0.getUTCDate() - 1);
  while (d0.getUTCDay() === 0 || d0.getUTCDay() === 6) d0.setUTCDate(d0.getUTCDate() - 1);
  return d0.toISOString().slice(0, 10);
}

d("weekly ordering + cancellation acceptance (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const runId = rand();

  const providerId = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  const locationId = crypto.randomUUID();
  const email = `e2e-order-${runId}@test.lunchportalen.no`;
  const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
  let userId = "";
  let employee: ReturnType<typeof createClient>;

  const [day1, day2] = nextWeekdays(2);
  const pastDay = lastWeekday();

  beforeAll(async () => {
    if (!RUN) return;
    // Provider + company + location + ACTIVE agreement (same shape as rlsFixtures).
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [providerId, `E2E Order Prov ${runId}`, `e2e-order-prov-${runId}`, `prov-${runId}@test.lunchportalen.no`],
    );
    // Billing engine FKs (billing_readiness_events.provider_id) reference the
    // organizations mirror — same shape Phase 4 bootstrap creates in prod.
    await fixturePgQuery(
      `insert into public.organizations (id, type, name, slug, status, legacy_source, legacy_provider_id, created_at, updated_at)
       values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', null, now(), now())
       on conflict (id) do nothing`,
      [providerId, `E2E Order Prov ${runId}`, `e2e-order-prov-${runId}`],
    );
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id, employee_count)
       values ($1, $2, 'ACTIVE', $3, $4::uuid, 25)`,
      [companyId, `E2E Order Co ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, providerId],
    );
    await fixturePgQuery(
      `insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'Hovedlokasjon', 'Testveien 1')`,
      [locationId, companyId],
    );
    await fixturePgQuery(`update public.companies set default_location_id = $2 where id = $1`, [companyId, locationId]);
    await fixturePgQuery(
      `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
       values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now())`,
      [companyId, locationId, providerId],
    );

    // Published menu (MSDI) for both future days + the past day (cutoff test),
    // priced at BASIS 9000 cents with the global catalog products.
    for (const date of [day1, day2, pastDay]) {
      await fixturePgQuery(
        `insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id, cutoff_at, published_at)
         values ($1, $2, $3::date, 'published', $4::uuid, now() + interval '30 days', now())
         on conflict (location_id, service_date) do update set state = 'published', provider_id = excluded.provider_id`,
        [companyId, locationId, date, providerId],
      );
      await fixturePgQuery(
        `insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional)
         select msd.id, p.id, p.name, 'porsjon', 9000, 0.15, 1, 10 + row_number() over (order by p.sku), false
         from public.menu_service_days msd
         join public.products p on p.company_id is null and p.sku in ('paasmurt', 'salatboks', 'varmrett')
         where msd.location_id = $1 and msd.service_date = $2::date
         on conflict do nothing`,
        [locationId, date],
      );
    }

    // Employee auth user + bound profile (canonical acceptance is covered by
    // Phase 3 tests; here we bind directly to focus on the order engine).
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    userId = String(created.data.user.id);
    for (let i = 0; i < 25; i += 1) {
      const { data: p } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (p?.id) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await fixturePgQuery(
      `update public.profiles set role = 'employee', company_id = $2, location_id = $3, active = true, updated_at = now() where id = $1`,
      [userId, companyId, locationId],
    );

    const anonUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    employee = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signIn = await employee.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`employee sign-in failed: ${signIn.error.message}`);
  }, 120_000);

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.order_status_history where order_id in (select id from public.orders where company_id = $1)`, values: [companyId] },
      { text: `delete from public.order_items where order_id in (select id from public.orders where company_id = $1)`, values: [companyId] },
      { text: `delete from public.billing_readiness_events where order_id in (select id from public.orders where company_id = $1)`, values: [companyId] },
      { text: `delete from public.orders where company_id = $1`, values: [companyId] },
      { text: `delete from public.day_choices where company_id = $1`, values: [companyId] },
      { text: `delete from public.menu_service_day_items msdi using public.menu_service_days msd where msdi.menu_service_day_id = msd.id and msd.location_id = $1`, values: [locationId] },
      { text: `delete from public.menu_service_days where location_id = $1`, values: [locationId] },
      { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where company_id = $1)`, values: [companyId] },
      { text: `delete from public.agreements where company_id = $1`, values: [companyId] },
      { text: `delete from public.profiles where id = $1::uuid`, values: [userId || crypto.randomUUID()] },
      { text: `update public.companies set default_location_id = null where id = $1`, values: [companyId] },
      { text: `delete from public.company_locations where company_id = $1`, values: [companyId] },
      { text: `delete from public.companies where id = $1`, values: [companyId] },
      { text: `delete from public.organizations where id = $1`, values: [providerId] },
      { text: `delete from public.providers where id = $1`, values: [providerId] },
    ]);
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* ignore */
      }
    }
    await closeFixturePgPool();
  }, 120_000);

  it("daily SET resolves provider/company/location server-side (0 wrong-provider)", async () => {
    const { data, error } = await employee.rpc("lp_order_set", {
      p_date: day1,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "paasmurt",
      p_item_key: "default",
    });
    expect(error, error?.message).toBeNull();
    expect(String(data.status ?? "").toUpperCase()).toMatch(/ACTIVE|ORDERED/);

    const { rows } = await fixturePgQuery(
      `select provider_id::text as p, company_id::text as c, location_id::text as l, status::text as s from public.orders where user_id = $1 and date = $2::date`,
      [userId, day1],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].p).toBe(providerId);
    expect(rows[0].c).toBe(companyId);
    expect(rows[0].l).toBe(locationId);
    expect(rows[0].s).toBe("ACTIVE");
  }, 60_000);

  it("update (re-SET with new choice) keeps exactly one ACTIVE order", async () => {
    const { error } = await employee.rpc("lp_order_set", {
      p_date: day1,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "salatboks",
      p_item_key: "default",
    });
    expect(error, error?.message).toBeNull();

    const { rows } = await fixturePgQuery(
      `select count(*) filter (where status = 'ACTIVE')::int as active, count(*)::int as total from public.orders where user_id = $1 and date = $2::date`,
      [userId, day1],
    );
    expect(rows[0].active).toBe(1);

    const { rows: dc } = await fixturePgQuery(
      `select choice_key from public.day_choices where user_id = $1 and date = $2::date`,
      [userId, day1],
    );
    expect(String(dc[0]?.choice_key ?? "")).toBe("salatboks");
  }, 60_000);

  it("second weekday SET works (weekly coverage) and both carry the right provider", async () => {
    const { error } = await employee.rpc("lp_order_set", {
      p_date: day2,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "varmrett",
      p_item_key: "default",
    });
    expect(error, error?.message).toBeNull();

    const { rows } = await fixturePgQuery(
      `select count(*)::int as wrong from public.orders where company_id = $1 and provider_id <> $2::uuid`,
      [companyId, providerId],
    );
    expect(rows[0].wrong).toBe(0);
  }, 60_000);

  it("CANCEL before cutoff: CANCELLED history row, items+day_choices removed, production count corrected", async () => {
    const { data, error } = await employee.rpc("lp_order_set", {
      p_date: day2,
      p_action: "CANCEL",
      p_note: null,
      p_slot: "default",
      p_choice_key: null,
      p_item_key: "default",
    });
    expect(error, error?.message).toBeNull();
    expect(String(data.status ?? "").toUpperCase()).toContain("CANCEL");
    const cancelledOrderId = String(data.order_id ?? "");
    expect(cancelledOrderId).toBeTruthy();

    const { rows } = await fixturePgQuery(
      `select
         (select count(*)::int from public.orders where user_id = $1 and date = $2::date and status = 'ACTIVE') as production_active,
         (select count(*)::int from public.orders where user_id = $1 and date = $2::date and status = 'CANCELLED') as history_cancelled,
         (select count(*)::int from public.order_items oi join public.orders o on o.id = oi.order_id where o.user_id = $1 and o.date = $2::date) as items,
         (select count(*)::int from public.day_choices where user_id = $1 and date = $2::date) as choices,
         (select count(*)::int from public.order_status_history where order_id = $3::uuid) as history_rows`,
      [userId, day2, cancelledOrderId],
    );
    // Production/invoice basis: the cancelled day contributes ZERO active orders.
    expect(rows[0].production_active).toBe(0);
    expect(rows[0].history_cancelled).toBe(1);
    expect(rows[0].items).toBe(0);
    expect(rows[0].choices).toBe(0);
    expect(rows[0].history_rows).toBeGreaterThanOrEqual(1);

    // Commission-basis correction (økonomisk reversering): idempotent RPC.
    // Pre-delivery cancel has no ORDER_COMPLETED ledger → 0 negative rows +
    // LEDGER_SKIPPED diagnostic recorded. Second call stays 0 (idempotent).
    const corr1 = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: cancelledOrderId,
      p_event_type: "ORDER_CANCELLED",
      p_reason: "Integration acceptance: employee cancel before cutoff",
      p_reference_id: null,
    });
    expect(corr1.error, corr1.error?.message).toBeNull();
    expect(Number(corr1.data)).toBe(0);
    const corr2 = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: cancelledOrderId,
      p_event_type: "ORDER_CANCELLED",
      p_reason: "Integration acceptance: retry (idempotent)",
      p_reference_id: null,
    });
    expect(Number(corr2.data)).toBe(0);

    const { rows: diag } = await fixturePgQuery(
      `select count(*)::int as n from public.billing_readiness_events where order_id = $1::uuid and event_type = 'LEDGER_SKIPPED'`,
      [cancelledOrderId],
    );
    expect(diag[0].n).toBe(1); // idempotency key deduped the retry
  }, 60_000);

  it("re-SET after CANCEL creates a NEW ACTIVE order and keeps immutable history", async () => {
    const { error } = await employee.rpc("lp_order_set", {
      p_date: day2,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "paasmurt",
      p_item_key: "default",
    });
    expect(error, error?.message).toBeNull();

    const { rows } = await fixturePgQuery(
      `select count(*) filter (where status = 'ACTIVE')::int as active, count(*) filter (where status = 'CANCELLED')::int as cancelled from public.orders where user_id = $1 and date = $2::date`,
      [userId, day2],
    );
    expect(rows[0].active).toBe(1);
    expect(rows[0].cancelled).toBe(1);
  }, 60_000);

  it("cutoff is fail-closed: SET and CANCEL for a past date raise CUTOFF_PASSED", async () => {
    const set = await employee.rpc("lp_order_set", {
      p_date: pastDay,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "paasmurt",
      p_item_key: "default",
    });
    expect(String(set.error?.message ?? "")).toContain("CUTOFF_PASSED");

    const cancel = await employee.rpc("lp_order_set", {
      p_date: pastDay,
      p_action: "CANCEL",
      p_note: null,
      p_slot: "default",
      p_choice_key: null,
      p_item_key: "default",
    });
    expect(String(cancel.error?.message ?? "")).toContain("CUTOFF_PASSED");
  }, 60_000);
});
