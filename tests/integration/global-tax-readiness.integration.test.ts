/**
 * PHASE 10 — global tax and accounting readiness (staging integration).
 *
 * Proves against real Postgres (staging uigx):
 *  - 21/21 active market countries with complete tax configuration
 *  - market approval registry: 21 rows, NO ACTIVE with recorded approvals
 *  - full owner approval chain TECHNICALLY_READY → … → ACTIVE → blocked → reset
 *  - fail-closed: no jump to ACTIVE, no block without reason,
 *    no ACTIVE without recorded tax+legal approval
 *  - invoice gate: creating an invoice for a provider in a non-ACTIVE market
 *    is rejected (both provider→company and commission tracks)
 *  - US/CA profile guard: state/province required at provider level
 *  - approval RPC not executable by anon/authenticated
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requirePostgres: true });
const d = RUN ? describe : describe.skip;

const EXPECTED = ["NO","SE","DK","FI","GB","DE","FR","ES","IT","NL","BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA"];

d("global tax and accounting readiness (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const runId = crypto.randomUUID().slice(0, 8);
  // Provider i ikke-godkjent marked. FR brukes (ikke DE) fordi Fase 9-suiten
  // aktiverer DE midlertidig — parallellkjøring skal ikke kunne rase.
  const provDE = crypto.randomUUID();
  const provUS = crypto.randomUUID(); // provider i US (state/tz-krav)
  const compDE = crypto.randomUUID();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgQuery(`delete from public.market_approval_events where country_code = 'XX'`);
    await fixturePgQuery(`delete from public.market_approvals where country_code = 'XX'`);
    // GR-kjeden avsluttes tilbake i TECHNICALLY_READY, men nullstill spor eksplisitt.
    await fixturePgQuery(
      `update public.market_approvals
       set status = 'TECHNICALLY_READY', tax_approved_at = null, tax_approved_by = null,
           legal_approved_at = null, legal_approved_by = null, activated_at = null,
           activated_by = null, blocked_reason = null, updated_at = now()
       where country_code = 'GR'`,
    );
    await fixturePgQuery(`delete from public.market_approval_events where country_code = 'GR'`);
    await fixturePgQuery(`delete from public.agreement_invoices where provider_id = any($1::uuid[])`, [[provDE, provUS]]).catch(() => null);
    await fixturePgQuery(`delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where provider_id = any($1::uuid[]))`, [[provDE, provUS]]).catch(() => null);
    await fixturePgQuery(`delete from public.agreements where provider_id = any($1::uuid[])`, [[provDE, provUS]]).catch(() => null);
    await fixturePgQuery(`delete from public.company_locations where company_id = $1`, [compDE]).catch(() => null);
    await fixturePgQuery(`delete from public.companies where id = $1`, [compDE]).catch(() => null);
    await fixturePgQuery(`delete from public.organization_billing_profiles where organization_id = any($1::uuid[])`, [[provDE, provUS]]);
    await fixturePgQuery(`delete from public.organizations where id = any($1::uuid[])`, [[provDE, provUS]]);
    await fixturePgQuery(`delete from public.providers where id = any($1::uuid[])`, [[provDE, provUS]]);
    await closeFixturePgPool();
  }, 120_000);

  async function seedProviderOrg(pid: string, label: string) {
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [pid, `Tax Prov ${label} ${runId}`, `tax-prov-${label}-${runId}`, `tax-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
      [pid, `Tax Prov ${label} ${runId}`, `tax-prov-${label}-${runId}`],
    );
  }

  it("21/21 active market countries with complete tax configuration", async () => {
    const { rows } = await fixturePgQuery(
      `select country_code,
              bool_and(tax_strategy is not null) as has_strategy,
              bool_and(tax_id_validation is not null) as has_validation,
              bool_and(postal_code_pattern is not null) as has_postal,
              bool_and(address_format is not null) as has_address,
              bool_and(jsonb_array_length(invoice_legal_fields) > 0) as has_legal,
              bool_and(default_currency is not null) as has_currency,
              bool_and(invoice_language is not null) as has_lang
       from public.markets where is_active = true
       group by country_code order by country_code`,
    );
    expect(rows.map((r) => r.country_code).sort()).toEqual([...EXPECTED].sort());
    for (const r of rows) {
      expect(r.has_strategy, r.country_code).toBe(true);
      expect(r.has_validation, r.country_code).toBe(true);
      expect(r.has_postal, r.country_code).toBe(true);
      expect(r.has_address, r.country_code).toBe(true);
      expect(r.has_legal, r.country_code).toBe(true);
      expect(r.has_currency, r.country_code).toBe(true);
      expect(r.has_lang, r.country_code).toBe(true);
    }
  });

  it("US/CA are explicit: strategy, state/province and provider timezone required", async () => {
    const { rows } = await fixturePgQuery(
      `select country_code, tax_strategy, state_province_required, provider_timezone_required
       from public.markets where country_code in ('US','CA') and is_active = true`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.state_province_required, r.country_code).toBe(true);
      expect(r.provider_timezone_required, r.country_code).toBe(true);
    }
    expect(rows.find((r) => r.country_code === "US")?.tax_strategy).toBe("sales_tax");
    expect(rows.find((r) => r.country_code === "CA")?.tax_strategy).toBe("gst_hst");
  });

  it("approval registry: 21 rows; NO ACTIVE; every ACTIVE has recorded approvals", async () => {
    const { rows } = await fixturePgQuery(`select country_code, status, tax_approved_at, legal_approved_at from public.market_approvals order by country_code`);
    expect(rows.length).toBe(21);
    const no = rows.find((r) => r.country_code === "NO");
    expect(no.status).toBe("ACTIVE");
    // Fail-closed-invariant: INGEN rad kan være ACTIVE uten registrert
    // skatte- OG legal-godkjenning. (Andre suiter kan aktivere testmarkeder
    // midlertidig — invarianten gjelder alltid.)
    for (const r of rows.filter((x) => x.status === "ACTIVE")) {
      expect(r.tax_approved_at, r.country_code).toBeTruthy();
      expect(r.legal_approved_at, r.country_code).toBeTruthy();
    }
  });

  it("owner approval chain: GR walks TECHNICALLY_READY → … → ACTIVE, then block and reset", async () => {
    const steps = ["TAX_REVIEW_PENDING", "TAX_APPROVED", "LEGAL_REVIEW_PENDING", "LEGAL_APPROVED", "ACTIVE"];
    for (const step of steps) {
      const res = await admin.rpc("lp_market_approval_transition", {
        p_country_code: "GR",
        p_new_status: step,
        p_reason: `test ${runId}`,
        p_actor_user_id: null,
      });
      expect(res.error, `${step}: ${res.error?.message}`).toBeNull();
      expect(res.data.status).toBe(step);
    }

    const { rows } = await fixturePgQuery(`select status, tax_approved_at, legal_approved_at, activated_at from public.market_approvals where country_code = 'GR'`);
    expect(rows[0].status).toBe("ACTIVE");
    expect(rows[0].tax_approved_at).toBeTruthy();
    expect(rows[0].legal_approved_at).toBeTruthy();
    expect(rows[0].activated_at).toBeTruthy();

    // Nødblokkering krever begrunnelse.
    const noReason = await admin.rpc("lp_market_approval_transition", {
      p_country_code: "GR",
      p_new_status: "ACTIVATION_BLOCKED",
      p_reason: null,
      p_actor_user_id: null,
    });
    expect(String(noReason.error?.message ?? "")).toContain("BLOCK_REASON_REQUIRED");

    const blocked = await admin.rpc("lp_market_approval_transition", {
      p_country_code: "GR",
      p_new_status: "ACTIVATION_BLOCKED",
      p_reason: "testblokkering",
      p_actor_user_id: null,
    });
    expect(blocked.error).toBeNull();

    const reset = await admin.rpc("lp_market_approval_transition", {
      p_country_code: "GR",
      p_new_status: "TECHNICALLY_READY",
      p_reason: "test reset",
      p_actor_user_id: null,
    });
    expect(reset.error).toBeNull();

    const { rows: events } = await fixturePgQuery(`select count(*)::int as c from public.market_approval_events where country_code = 'GR'`);
    expect(events[0].c).toBeGreaterThanOrEqual(7); // full audit trail
  });

  it("fail-closed: no status jump, and no ACTIVE without recorded approvals", async () => {
    // Hopp rett til ACTIVE avvises.
    const jump = await admin.rpc("lp_market_approval_transition", {
      p_country_code: "SE",
      p_new_status: "ACTIVE",
      p_reason: null,
      p_actor_user_id: null,
    });
    expect(String(jump.error?.message ?? "")).toContain("MARKET_APPROVAL_TRANSITION_INVALID");

    // LEGAL_APPROVED uten registrerte godkjenningstidspunkter kan ikke aktiveres.
    await fixturePgQuery(`insert into public.market_approvals (country_code, status) values ('XX', 'LEGAL_APPROVED') on conflict (country_code) do update set status = 'LEGAL_APPROVED', tax_approved_at = null, legal_approved_at = null`);
    const xx = await admin.rpc("lp_market_approval_transition", {
      p_country_code: "XX",
      p_new_status: "ACTIVE",
      p_reason: null,
      p_actor_user_id: null,
    });
    expect(String(xx.error?.message ?? "")).toContain("MARKET_ACTIVATION_REQUIRES_APPROVALS");
  });

  it("invoice gate: provider in non-ACTIVE market cannot get invoices (both tracks)", async () => {
    await seedProviderOrg(provDE, "de");
    await fixturePgQuery(
      `insert into public.organization_billing_profiles
         (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status)
       select $1, m.id, $2, m.country_code, m.tax_country_code, m.default_currency, m.default_timezone, $3, 'active'
       from public.markets m where m.country_code = 'FR' and m.is_active = true limit 1`,
      [provDE, `Tax Prov fr ${runId} SARL`, `obp-fr-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id, employee_count)
       values ($1, $2, 'ACTIVE', $3, $4::uuid, 5)`,
      [compDE, `Tax Co de ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, provDE],
    );
    const { rows: loc } = await fixturePgQuery(
      `insert into public.company_locations (id, company_id, name, address) values (gen_random_uuid(), $1, 'Hauptstandort', 'Beispielstraße 1') returning id`,
      [compDE],
    );
    const { rows: agr } = await fixturePgQuery(
      `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
       values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon"]'::jsonb, '11:00', '13:00', now()) returning id`,
      [compDE, String(loc[0].id), provDE],
    );

    // Provider→company-faktura blokkeres (DE er ikke kommersielt ACTIVE).
    const head = await fixturePgQuery(
      `insert into public.agreement_invoices (agreement_id, provider_id, company_id, invoice_period_start, invoice_period_end, billing_cycle, amount_net, amount_tax, amount_total, status, kind, currency)
       values ($1, $2, $3, '2026-06-01', '2026-06-30', 'monthly', 0, 0, 0, 'DRAFT', 'INVOICE', 'EUR')`,
      [String(agr[0].id), provDE, compDE],
    ).catch((e) => e);
    expect(String(head?.message ?? head)).toContain("MARKET_NOT_COMMERCIALLY_APPROVED");

    // Provisjonsspor blokkeres også.
    const { rows: period } = await fixturePgQuery(
      `insert into public.commission_periods (provider_id, organization_id, period_start, period_end, billing_timezone, currency, status, total_basis_amount_minor, total_commission_exact, rounded_commission_minor, rounding_adjustment_minor, closed_at, idempotency_key)
       values ($1, $1, '2026-06-01', '2026-06-30', 'Europe/Paris', 'EUR', 'closed', 0, 0, 0, 0, now(), $2) returning id`,
      [provDE, `tax-readiness-${runId}`],
    );
    const commission = await fixturePgQuery(
      `insert into public.provider_commission_invoices (provider_id, organization_id, commission_period_id, amount_ex_tax_minor, tax_amount_minor, total_amount_minor, currency, sent_to_emails_snapshot, payment_status, issued_at, kind)
       values ($1, $1, $2, 100, 0, 100, 'EUR', '["x@test.lunchportalen.no"]'::jsonb, 'pending', now(), 'COMMISSION')`,
      [provDE, String(period[0].id)],
    ).catch((e) => e);
    expect(String(commission?.message ?? commission)).toContain("MARKET_NOT_COMMERCIALLY_APPROVED");

    await fixturePgQuery(`delete from public.commission_periods where provider_id = $1`, [provDE]);
  });

  it("US provider profile fails closed without state/province", async () => {
    await seedProviderOrg(provUS, "us");
    const missingState = await fixturePgQuery(
      `insert into public.organization_billing_profiles
         (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status)
       select $1, m.id, $2, m.country_code, m.tax_country_code, m.default_currency, 'America/Chicago', $3, 'active'
       from public.markets m where m.country_code = 'US' and m.is_active = true limit 1`,
      [provUS, `Tax Prov us ${runId} LLC`, `obp-us-${runId}@test.lunchportalen.no`],
    ).catch((e) => e);
    expect(String(missingState?.message ?? missingState)).toContain("STATE_PROVINCE_REQUIRED_FOR_MARKET");

    const withState = await fixturePgQuery(
      `insert into public.organization_billing_profiles
         (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status, state_province)
       select $1, m.id, $2, m.country_code, m.tax_country_code, m.default_currency, 'America/Chicago', $3, 'active', 'TX'
       from public.markets m where m.country_code = 'US' and m.is_active = true limit 1`,
      [provUS, `Tax Prov us ${runId} LLC`, `obp-us-${runId}@test.lunchportalen.no`],
    ).catch((e) => e);
    expect(withState?.message ?? null).toBeNull();
  });

  it("approval RPC is not executable by anon/authenticated (no exposure)", async () => {
    const { rows } = await fixturePgQuery(
      `select
         has_function_privilege('authenticated', 'public.lp_market_approval_transition(text, text, text, uuid)', 'EXECUTE') as a1,
         has_function_privilege('anon', 'public.lp_market_approval_transition(text, text, text, uuid)', 'EXECUTE') as a2`,
    );
    expect(rows[0].a1).toBe(false);
    expect(rows[0].a2).toBe(false);
  });
});
