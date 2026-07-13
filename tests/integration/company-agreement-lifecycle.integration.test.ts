/**
 * PHASE 5 — company onboarding + agreement lifecycle (staging integration).
 *
 * Proves against real Postgres (staging uigx):
 *  - provider matching on ACTUAL coverage (0 → fail-closed, 1 → auto, >1 → choice)
 *  - lp_company_register writes company + location + agreement + registration
 *    with correct provider_id from the start
 *  - lp_agreement_materialize_plan copies weekday tiers / window / terms
 *  - lp_agreement_approve_active → ACTIVE (company ACTIVE)
 *  - state machine: suspend → resume → terminate (+ invalid transitions fail)
 *
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 + staging env.
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const d = RUN ? describe : describe.skip;

const rand = () => crypto.randomUUID().slice(0, 8);
const randOrgnr = () => `9${Math.floor(Math.random() * 90000000 + 10000000)}`;

// Isolated postal codes unlikely to collide with real coverage data.
const PC_NONE = "0021";
const PC_SINGLE = "0022";
const PC_MULTI = "0023";

d("company onboarding + agreement lifecycle (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const providerIds: string[] = [];
  const areaIds: string[] = [];
  const companyIds: string[] = [];

  async function seedProvider(label: string, pcFrom: string, pcTo: string) {
    const id = crypto.randomUUID();
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [id, `E2E Prov ${label} ${rand()}`, `e2e-prov-${label}-${rand()}`, `prov-${label}.${rand()}@test.lunchportalen.no`],
    );
    providerIds.push(id);
    const areaId = crypto.randomUUID();
    await fixturePgQuery(
      `insert into public.provider_service_areas (id, provider_id, country, city, postal_code_from, postal_code_to, active)
       values ($1, $2, 'NO', 'Testby', $3, $4, true)`,
      [areaId, id, pcFrom, pcTo],
    );
    areaIds.push(areaId);
    return id;
  }

  async function registerCompany(postal: string, providerChoice: string | null = null) {
    const orgnr = randOrgnr();
    const { data, error } = await admin.rpc("lp_company_register", {
      p_company_name: `E2E Lunsj ${rand()}`,
      p_orgnr: orgnr,
      p_employee_count: 25,
      p_contact_name: "Ola Admin",
      p_contact_email: `admin.${rand()}@test.lunchportalen.no`,
      p_contact_phone: "99887766",
      p_address_line: "Testveien 1",
      p_postal_code: postal,
      p_postal_city: "Testby",
      p_provider_id: providerChoice,
    });
    const companyId = data?.company_id ? String(data.company_id) : null;
    if (companyId) companyIds.push(companyId);
    return { data, error, orgnr, companyId };
  }

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where company_id = any($1::uuid[]))`, values: [companyIds] },
      { text: `delete from public.company_registrations where company_id = any($1::uuid[]) or provider_id = any($2::uuid[])`, values: [companyIds, providerIds] },
      { text: `delete from public.agreements where company_id = any($1::uuid[])`, values: [companyIds] },
      { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [companyIds] },
      { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [companyIds] },
      { text: `delete from public.companies where id = any($1::uuid[])`, values: [companyIds] },
      { text: `delete from public.provider_service_areas where id = any($1::uuid[])`, values: [areaIds] },
      { text: `delete from public.providers where id = any($1::uuid[])`, values: [providerIds] },
    ]);
    await closeFixturePgPool();
  }, 120_000);

  it("no coverage → PROVIDER_NOT_FOUND and no rows written", async () => {
    const res = await registerCompany(PC_NONE);
    expect(String(res.error?.message ?? "")).toContain("PROVIDER_NOT_FOUND");
    const { rows } = await fixturePgQuery(`select count(*)::int as n from public.companies where orgnr = $1`, [res.orgnr]);
    expect(rows[0].n).toBe(0);
  }, 120_000);

  it("single provider covers → auto-assigned provider_id on company + agreement + registration", async () => {
    const provider = await seedProvider("single", PC_SINGLE, PC_SINGLE);
    const res = await registerCompany(PC_SINGLE);
    expect(res.error, res.error?.message).toBeNull();
    expect(res.companyId).toBeTruthy();

    const { rows } = await fixturePgQuery(
      `select c.provider_id::text as cp, a.provider_id::text as ap, r.provider_id::text as rp, a.status::text as astatus
       from public.companies c
       join public.agreements a on a.company_id = c.id
       join public.company_registrations r on r.company_id = c.id
       where c.id = $1`,
      [res.companyId],
    );
    expect(rows[0].cp).toBe(provider);
    expect(rows[0].ap).toBe(provider);
    expect(rows[0].rp).toBe(provider);
    expect(rows[0].astatus).toBe("PENDING");
  }, 120_000);

  it("multiple providers cover → choice required; invalid choice rejected; valid choice honored", async () => {
    const p1 = await seedProvider("multi1", PC_MULTI, PC_MULTI);
    const p2 = await seedProvider("multi2", PC_MULTI, PC_MULTI);

    // Match RPC returns both, deterministic order.
    const { data: matches } = await admin.rpc("lp_match_providers_by_postal_code", { p_postal_code: PC_MULTI });
    const ids = (matches ?? []).map((m: any) => String(m.provider_id));
    expect(ids).toContain(p1);
    expect(ids).toContain(p2);

    // No explicit choice → fail-closed.
    const noChoice = await registerCompany(PC_MULTI);
    expect(String(noChoice.error?.message ?? "")).toContain("PROVIDER_CHOICE_REQUIRED");

    // Choice outside matched set → fail-closed.
    const badChoice = await registerCompany(PC_MULTI, crypto.randomUUID());
    expect(String(badChoice.error?.message ?? "")).toContain("PROVIDER_NOT_ELIGIBLE");

    // Valid explicit choice → honored end-to-end.
    const ok = await registerCompany(PC_MULTI, p2);
    expect(ok.error, ok.error?.message).toBeNull();
    const { rows } = await fixturePgQuery(`select provider_id::text as p from public.companies where id = $1`, [ok.companyId]);
    expect(rows[0].p).toBe(p2);
  }, 120_000);

  it("approval materializes plan and full state machine works (approve → suspend → resume → terminate)", async () => {
    await seedProvider("life", "0024", "0024");
    const res = await registerCompany("0024");
    expect(res.error).toBeNull();
    const companyId = res.companyId!;

    const { rows: agrRows } = await fixturePgQuery(`select id::text as id from public.agreements where company_id = $1`, [companyId]);
    const agreementId = agrRows[0].id;

    // Simulate the plan payload the public API stores post-RPC.
    await fixturePgQuery(
      `update public.company_registrations
       set weekday_meal_tiers = '{"mon":"BASIS","tue":"LUXUS","wed":"BASIS","thu":"ENTERPRISE","fri":"BASIS"}'::jsonb,
           delivery_window_from = '11:00', delivery_window_to = '13:00',
           terms_binding_months = 12, terms_notice_months = 2
       where company_id = $1`,
      [companyId],
    );

    // Materialize (same call the superadmin approve route makes first).
    const mat = await admin.rpc("lp_agreement_materialize_plan", { p_agreement_id: agreementId });
    expect(mat.error, mat.error?.message).toBeNull();
    expect(mat.data.materialized).toBe(true);

    const { rows: agr } = await fixturePgQuery(
      `select tier::text as tier, delivery_days, slot_start::text as ss, slot_end::text as se, binding_months, notice_months
       from public.agreements where id = $1`,
      [agreementId],
    );
    expect(agr[0].tier).toBe("ENTERPRISE"); // highest tier wins
    expect(agr[0].delivery_days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(agr[0].ss).toBe("11:00:00");
    expect(agr[0].se).toBe("13:00:00");
    expect(agr[0].binding_months).toBe(12);
    expect(agr[0].notice_months).toBe(2);

    const { rows: dayRows } = await fixturePgQuery(
      `select weekday, tier::text as tier from public.agreement_delivery_days where agreement_id = $1 order by weekday`,
      [agreementId],
    );
    const tiersByDay = Object.fromEntries(dayRows.map((r: any) => [r.weekday, r.tier]));
    expect(tiersByDay.tue).toBe("LUXUS");
    expect(tiersByDay.thu).toBe("ENTERPRISE");

    // Suspend before ACTIVE → fail-closed.
    const early = await admin.rpc("lp_agreement_suspend", { p_agreement_id: agreementId, p_actor_user_id: null, p_reason: "test" });
    expect(String(early.error?.message ?? "")).toContain("AGREEMENT_NOT_ACTIVE");

    // Approve → ACTIVE.
    const approve = await admin.rpc("lp_agreement_approve_active", { p_agreement_id: agreementId, p_actor_user_id: null });
    expect(approve.error, approve.error?.message).toBeNull();
    let { rows: st } = await fixturePgQuery(`select a.status::text as a, c.status::text as c from public.agreements a join public.companies c on c.id = a.company_id where a.id = $1`, [agreementId]);
    expect(st[0].a).toBe("ACTIVE");
    expect(st[0].c).toBe("ACTIVE");

    // Suspend → SUSPENDED (company PAUSED).
    const susp = await admin.rpc("lp_agreement_suspend", { p_agreement_id: agreementId, p_actor_user_id: null, p_reason: "Manglende betaling" });
    expect(susp.error).toBeNull();
    ({ rows: st } = await fixturePgQuery(`select a.status::text as a, c.status::text as c from public.agreements a join public.companies c on c.id = a.company_id where a.id = $1`, [agreementId]));
    expect(st[0].a).toBe("SUSPENDED");
    expect(st[0].c).toBe("PAUSED");

    // Resume → ACTIVE.
    const resume = await admin.rpc("lp_agreement_resume", { p_agreement_id: agreementId, p_actor_user_id: null });
    expect(resume.error).toBeNull();
    ({ rows: st } = await fixturePgQuery(`select a.status::text as a, c.status::text as c from public.agreements a join public.companies c on c.id = a.company_id where a.id = $1`, [agreementId]));
    expect(st[0].a).toBe("ACTIVE");
    expect(st[0].c).toBe("ACTIVE");

    // Terminate → TERMINATED (terminal; further transitions fail).
    const term = await admin.rpc("lp_agreement_terminate", { p_agreement_id: agreementId, p_actor_user_id: null, p_reason: "Avsluttet avtale" });
    expect(term.error).toBeNull();
    ({ rows: st } = await fixturePgQuery(`select a.status::text as a, c.status::text as c from public.agreements a join public.companies c on c.id = a.company_id where a.id = $1`, [agreementId]));
    expect(st[0].a).toBe("TERMINATED");
    expect(st[0].c).toBe("TERMINATED");

    const afterTerm = await admin.rpc("lp_agreement_resume", { p_agreement_id: agreementId, p_actor_user_id: null });
    expect(String(afterTerm.error?.message ?? "")).toContain("AGREEMENT_NOT_SUSPENDED");

    // Terminate is idempotent.
    const termAgain = await admin.rpc("lp_agreement_terminate", { p_agreement_id: agreementId, p_actor_user_id: null, p_reason: null });
    expect(termAgain.error).toBeNull();
    expect(termAgain.data.idempotent).toBe(true);
  }, 180_000);

  it("locations carry delivery instruction columns; companies carry billing profile columns", async () => {
    const { rows } = await fixturePgQuery(
      `select
         (select count(*)::int from information_schema.columns where table_schema='public' and table_name='company_locations' and column_name in ('contact_name','contact_phone','window_from','window_to','delivery_instructions')) as loc_cols,
         (select count(*)::int from information_schema.columns where table_schema='public' and table_name='companies' and column_name in ('cost_center','invoice_reference')) as comp_cols`,
      [],
    );
    expect(rows[0].loc_cols).toBe(5);
    expect(rows[0].comp_cols).toBe(2);
  }, 60_000);
});
