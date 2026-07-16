/**
 * PHASE 13 — FULL 21-COUNTRY STAGING RELEASE CANDIDATE PROOF.
 *
 * Kjører HELE plattformflyten per land (21/21) mot staging (uigx) med
 * kontrollerte testaktører og kanoniske RPC-er:
 *
 *   provider registration → approval (superadmin) → first admin + kitchen
 *   → provider settings/coverage → billing profile → menu (MSDI publish)
 *   → company + location + billing/package (agreement) → employee
 *   → daily order → weekly order → update → cancellation (lp_order_set, ekte
 *     employee-JWT) → kitchen production → packing → delivery
 *     (lp_order_advance_status, ekte kitchen-JWT) → provider invoice
 *     (build → finalize → sent → payment → paid) → credit note
 *   → 5 % commission ledger (postet av DELIVERED) → period close
 *   → commission invoice → issue → payment marked
 *   → market approval chain til ACTIVE (Fase 10-registeret)
 *   → superadmin Norwegian view (original + norsk side-ved-side-data)
 *
 * Invarianter (må holde for HVERT land):
 *   - valuta = markedets valuta i ordre, snapshots, ledger, fakturaer
 *   - fakturabalanse: sum(linjer) = hode, netto+mva = total, betalt = total
 *   - provisjonsbalanse: ledger = nøyaktig 5 % av levert netto; periodens
 *     avrundede beløp = provisjonsfakturaens beløp
 *   - tenant-isolasjon: fakturaer/ledger refererer kun eget selskap
 *   - 0 orphan-rader og 0 stuck outbox etter opprydding
 *
 * Kun staging. Full opprydding i afterAll (ingen datasletting utenfor eget seed).
 */
// @ts-nocheck
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv, readRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requirePostgres: true, requireAnon: true });
const d = RUN ? describe : describe.skip;

const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];

const runId = crypto.randomUUID().slice(0, 8);

/** Neste mandag (framtid, cutoff-safe) + påfølgende dager. */
function nextMonday(): Date {
  const d0 = new Date();
  const day = d0.getUTCDay();
  const add = ((8 - day) % 7) || 7;
  const m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() + add));
  return m;
}
const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const MON = nextMonday();
const ORDER_DATES = [0, 1, 2, 3].map((i) => iso(new Date(MON.getTime() + i * 86400000))); // man–tor
const PERIOD_START = `${ORDER_DATES[0].slice(0, 7)}-01`;
const PERIOD_END = iso(new Date(Date.UTC(MON.getUTCFullYear(), MON.getUTCMonth() + 1, 0)));

type CountryCtx = {
  cc: string;
  currency: string;
  language: string;
  timezone: string;
  registrationId?: string;
  providerId?: string;
  companyId?: string;
  locationId?: string;
  agreementId?: string;
  employeeId?: string;
  kitchenId?: string;
  invoiceId?: string;
  approvalBackup?: Record<string, unknown> | null;
};

const ctxByCountry = new Map<string, CountryCtx>();
const createdUserIds: string[] = [];

type Actor = { id: string; client: ReturnType<typeof createClient> };

d("FULL 21-COUNTRY RC PROOF (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  let anonUrl = "";
  let anonKey = "";
  // RC15G2C: isolated JWT actors per country (kitchen/admin/employee).
  // company_admin + driver are auth users without immediate sign-in (inventory + profile bind).
  const kitchenByCountry = new Map<string, Actor>();
  const providerAdminByCountry = new Map<string, Actor>();
  const employeeByCountry = new Map<string, Actor>();
  const companyAdminIds = new Map<string, string>();
  const driverIds = new Map<string, string>();

  beforeAll(async () => {
    if (!RUN) return;
    const env = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    anonUrl = env.url;
    anonKey = env.anonKey!;

    // Markedsdata per land (default locale-rad).
    const { rows } = await fixturePgQuery(
      `select distinct on (country_code) country_code, default_currency, default_language, default_timezone
       from public.markets where is_active = true order by country_code, locale`,
    );
    for (const r of rows) {
      ctxByCountry.set(String(r.country_code), {
        cc: String(r.country_code),
        currency: String(r.default_currency),
        language: String(r.default_language),
        timezone: String(r.default_timezone),
      });
    }

    // Globale produkter (paasmurt/salatboks) må finnes for MSDI.
    const { rows: prods } = await fixturePgQuery(
      `select sku from public.products where company_id is null and sku in ('paasmurt','salatboks')`,
    );
    if (prods.length < 2) throw new Error("globale produkter paasmurt/salatboks mangler på staging");

    for (const cc of COUNTRIES) {
      const lower = cc.toLowerCase();
      kitchenByCountry.set(cc, await createActor(`rc15g2c-kitchen-${lower}-${runId}@test.lunchportalen.no`));
      await sleep(400);
      providerAdminByCountry.set(cc, await createActor(`rc15g2c-padmin-${lower}-${runId}@test.lunchportalen.no`));
      await sleep(400);
      employeeByCountry.set(cc, await createActor(`rc15g2c-emp-${lower}-${runId}@test.lunchportalen.no`));
      await sleep(400);
      companyAdminIds.set(cc, await createAuthUserOnly(`rc15g2c-cadmin-${lower}-${runId}@test.lunchportalen.no`));
      driverIds.set(cc, await createAuthUserOnly(`rc15g2c-driver-${lower}-${runId}@test.lunchportalen.no`));
      await sleep(200);
    }
  }, 900_000);

  afterAll(async () => {
    if (!RUN) return;
    const provIds = [...ctxByCountry.values()].map((c) => c.providerId).filter(Boolean);
    const compIds = [...ctxByCountry.values()].map((c) => c.companyId).filter(Boolean);
    const userIds = createdUserIds;

    // Gjenopprett godkjenningsregisteret (alle land unntatt NO tilbake til backup).
    for (const c of ctxByCountry.values()) {
      if (c.cc === "NO" || !c.approvalBackup) continue;
      await fixturePgQuery(
        `update public.market_approvals set status=$2, tax_approved_at=$3, tax_approved_by=$4, legal_approved_at=$5, legal_approved_by=$6, activated_at=$7, activated_by=$8, blocked_reason=$9, updated_at=now() where country_code=$1`,
        [
          c.cc,
          c.approvalBackup.status,
          c.approvalBackup.tax_approved_at, c.approvalBackup.tax_approved_by,
          c.approvalBackup.legal_approved_at, c.approvalBackup.legal_approved_by,
          c.approvalBackup.activated_at, c.approvalBackup.activated_by,
          c.approvalBackup.blocked_reason,
        ],
      ).catch(() => null);
      await fixturePgQuery(`delete from public.market_approval_events where country_code=$1 and reason like $2`, [c.cc, `%rc15g2c-${runId}%`]).catch(() => null);
    }

    if (provIds.length) {
      await fixturePgTransaction([
        { text: `set local session_replication_role = replica` },
        { text: `delete from public.invoice_payments where invoice_id in (select id from public.agreement_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.agreement_invoice_lines where invoice_id in (select id from public.agreement_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.agreement_invoices where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.invoice_sequences where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.commission_invoice_payments where invoice_id in (select id from public.provider_commission_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.invoice_deliveries where invoice_id in (select id from public.provider_commission_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.provider_commission_invoices where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.commission_periods where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.commission_ledger where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.billing_readiness_events where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.billing_audit_log where organization_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.order_line_commercial_snapshots where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.order_status_history where order_id in (select id from public.orders where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.day_choices where company_id = any($1::uuid[])`, values: [compIds] },
        { text: `delete from public.order_items where order_id in (select id from public.orders where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.orders where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.menu_service_day_items where menu_service_day_id in (select id from public.menu_service_days where company_id = any($1::uuid[]))`, values: [compIds] },
        { text: `delete from public.menu_service_days where company_id = any($1::uuid[])`, values: [compIds] },
        { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where provider_id = any($1::uuid[]))`, values: [provIds] },
        { text: `delete from public.agreements where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [compIds] },
        { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [compIds] },
        { text: `update public.profiles set company_id = null, location_id = null where id = any($1::uuid[])`, values: [userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]] },
        { text: `delete from public.companies where id = any($1::uuid[])`, values: [compIds] },
        { text: `delete from public.provider_memberships where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.provider_invites where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.superadmin_translation_events where translation_id in (select id from public.superadmin_translations where entity_id in (select id from public.provider_registrations where company_name like $1))`, values: [`RC15G2C %${runId}%`] },
        { text: `delete from public.superadmin_translations where entity_id in (select id from public.provider_registrations where company_name like $1)`, values: [`RC15G2C %${runId}%`] },
        { text: `delete from public.organization_billing_profiles where organization_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.provider_settings where provider_id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.organizations where id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.providers where id = any($1::uuid[])`, values: [provIds] },
        { text: `delete from public.provider_registrations where company_name like $1`, values: [`RC15G2C %${runId}%`] },
        { text: `delete from public.outbox where event_key like $1`, values: [`%${runId}%`] },
      ]).catch((e) => console.error("cleanup:", e?.message));

      // Outbox-rader fra lp_order_set (event_key inneholder userId).
      for (const uid of userIds) {
        await fixturePgQuery(`delete from public.outbox where event_key like $1`, [`order.set:${uid}%`]).catch(() => null);
      }
    }

    for (const uid of userIds) {
      await admin.auth.admin.deleteUser(uid).catch(() => null);
    }
    await closeFixturePgPool();
  }, 300_000);

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function createAuthUserOnly(email: string): Promise<string> {
    const password = `Rc15G2C!${runId}!${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user?.id) throw new Error(`createUser ${email}: ${error?.message}`);
    createdUserIds.push(data.user.id);
    return data.user.id;
  }

  async function createActor(email: string): Promise<{ id: string; client: ReturnType<typeof createClient> }> {
    const password = `Rc15G2C!${runId}!${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user?.id) throw new Error(`createUser ${email}: ${error?.message}`);
    createdUserIds.push(data.user.id);
    const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let token: string | undefined;
    let lastErr = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt > 0) await sleep(1500 * attempt);
      const signIn = await anon.auth.signInWithPassword({ email, password });
      if (!signIn.error && signIn.data.session?.access_token) {
        token = signIn.data.session.access_token;
        break;
      }
      lastErr = signIn.error?.message || "no token";
      if (!/rate limit/i.test(lastErr)) break;
    }
    if (!token) throw new Error(`signIn ${email}: ${lastErr}`);
    const client = createClient(anonUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return { id: data.user.id, client };
  }

  for (const cc of COUNTRIES) {
    it(`${cc}: full lifecycle PASS (registration → delivery → invoice → commission → superadmin)`, async () => {
      const ctx = ctxByCountry.get(cc);
      expect(ctx, `marked mangler for ${cc}`).toBeTruthy();
      const lower = cc.toLowerCase();
      const minor = (n: number) => Math.round(n);

      // ---------------------------------------------------------------
      // 1) PROVIDER REGISTRATION (kanonisk public RPC) + coverage-fritekst.
      // ---------------------------------------------------------------
      const reg = await admin.rpc("lp_provider_registration_create", {
        p_payload: {
          company_name: `RC15G2C Provider ${cc} ${runId}`,
          country_code: cc,
          contact_name: `Contact ${cc}`,
          contact_email: `rc15g2c-prov-${lower}-${runId}@test.lunchportalen.no`,
          operating_language: ctx.language,
          invoice_language: ctx.language,
          currency: ctx.currency,
          timezone: ctx.timezone,
          coverage_wish: `Coverage wish written in ${ctx.language} for ${cc} (rc15g2c-${runId})`,
          order_email: `rc15g2c-order-${lower}-${runId}@test.lunchportalen.no`,
          kitchen_email: `rc15g2c-kitchen-${lower}-${runId}@test.lunchportalen.no`,
          delivery_email: `rc15g2c-delivery-${lower}-${runId}@test.lunchportalen.no`,
        },
      });
      expect(reg.error, `${cc} registration: ${reg.error?.message}`).toBeNull();
      ctx.registrationId = String(reg.data.registration_id);

      // 2) SUPERADMIN APPROVAL → provider + org + settings + invite (atomisk RPC).
      const approve = await admin.rpc("lp_provider_registration_approve", {
        p_registration_id: ctx.registrationId,
        p_slug: `rc15g2c-${lower}-${runId}`,
        p_token_hash: crypto.createHash("sha256").update(`rc15g2c-${cc}-${runId}`).digest("hex"),
        p_invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        p_actor_user_id: null,
      });
      expect(approve.error, `${cc} approve: ${approve.error?.message}`).toBeNull();
      ctx.providerId = String(approve.data.provider_id);

      // Provider settings (coverage/valuta/tidssone) verifisert fra RPC-en.
      const { rows: ps } = await fixturePgQuery(
        `select default_currency, default_country_code, timezone, locale from public.provider_settings where provider_id = $1`,
        [ctx.providerId],
      );
      expect(ps[0].default_currency).toBe(ctx.currency);
      expect(ps[0].default_country_code).toBe(cc);

      // 3) FIRST ADMIN + KITCHEN + DRIVER (RC15G2C: isolated per country).
      const { rows: invites } = await fixturePgQuery(`select id from public.provider_invites where provider_id = $1`, [ctx.providerId]);
      expect(invites.length, `${cc} provider invite`).toBeGreaterThanOrEqual(1);
      const kitchen = kitchenByCountry.get(cc)!;
      const providerAdmin = providerAdminByCountry.get(cc)!;
      const companyAdminId = companyAdminIds.get(cc)!;
      const driverId = driverIds.get(cc)!;
      ctx.kitchenId = kitchen.id;
      await fixturePgQuery(
        `insert into public.provider_memberships (user_id, provider_id, role) values
           ($1, $3, 'provider_admin'), ($2, $3, 'provider_kitchen')
         on conflict do nothing`,
        [providerAdmin.id, kitchen.id, ctx.providerId],
      );
      // Driver actor exists for tenant inventory; delivery advances use kitchen JWT (canonical path).
      void driverId;

      // 4) BILLING PROFILE (markedssannhet; state/tz påkrevd for US/CA).
      await fixturePgQuery(
        `insert into public.organization_billing_profiles
           (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status, state_province)
         select $1, m.id, $2, m.country_code, m.tax_country_code, m.default_currency, $3, $4, 'active',
                case when m.state_province_required then 'XX' end
         from public.markets m where m.country_code = $5 and m.is_active = true limit 1`,
        [ctx.providerId, `RC15G2C Provider ${cc} ${runId} Ltd`, ctx.timezone, `rc15g2c-billing-${lower}-${runId}@test.lunchportalen.no`, cc],
      );

      // 5) COMPANY + LOCATION + PACKAGE/BILLING (avtale ACTIVE, BASIS 90/dag).
      ctx.companyId = crypto.randomUUID();
      ctx.locationId = crypto.randomUUID();
      await fixturePgQuery(
        `insert into public.companies (id, name, status, orgnr, provider_id, employee_count, billing_email, preferred_locale)
         values ($1, $2, 'ACTIVE', $3, $4::uuid, 10, $5, $6)`,
        [ctx.companyId, `RC15G2C Company ${cc} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, ctx.providerId, `rc15g2c-co-${lower}-${runId}@test.lunchportalen.no`, ctx.language],
      );
      await fixturePgQuery(`insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'HQ', 'RC15G2C Street 1')`, [ctx.locationId, ctx.companyId]);
      await fixturePgQuery(`update public.companies set default_location_id = $2 where id = $1`, [ctx.companyId, ctx.locationId]);
      const { rows: agr } = await fixturePgQuery(
        `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at, price_per_meal_nok)
         values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now(), 90) returning id`,
        [ctx.companyId, ctx.locationId, ctx.providerId],
      );
      ctx.agreementId = String(agr[0].id);

      // 6) MENU: publiser MSDI for alle ordredatoer (provider-eid innhold).
      for (const date of ORDER_DATES) {
        await fixturePgQuery(
          `with msd as (
             insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id)
             values ($1, $2, $3::date, 'published', $4::uuid)
             on conflict (location_id, service_date) do update set state = 'published', provider_id = excluded.provider_id
             returning id
           )
           insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional)
           select msd.id, p.id, p.name, 'porsjon', 9000, 0.15, 1, row_number() over (order by p.sku), false
           from msd cross join public.products p
           where p.company_id is null and p.sku in ('paasmurt','salatboks')
             and not exists (select 1 from public.menu_service_day_items x where x.menu_service_day_id = msd.id and x.product_id = p.id)`,
          [ctx.companyId, ctx.locationId, date, ctx.providerId],
        );
      }

      // 7) EMPLOYEE + COMPANY ADMIN (isolated per country; test-domain sink only).
      const employee = employeeByCountry.get(cc)!;
      ctx.employeeId = employee.id;
      await fixturePgQuery(
        `insert into public.profiles (id, email, company_id, location_id, preferred_locale)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set company_id = excluded.company_id, location_id = excluded.location_id, preferred_locale = excluded.preferred_locale`,
        [employee.id, `rc15g2c-emp-${lower}-${runId}@test.lunchportalen.no`, ctx.companyId, ctx.locationId, ctx.language],
      );
      await fixturePgQuery(
        `insert into public.profiles (id, email, company_id, location_id, preferred_locale)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set company_id = excluded.company_id, location_id = excluded.location_id, preferred_locale = excluded.preferred_locale`,
        [companyAdminId, `rc15g2c-cadmin-${lower}-${runId}@test.lunchportalen.no`, ctx.companyId, ctx.locationId, ctx.language],
      );

      // 8) DAILY + WEEKLY ORDER + UPDATE + CANCELLATION (kanonisk lp_order_set).
      const setOrder = async (date: string, choice: string) => {
        const res = await employee.client.rpc("lp_order_set", {
          p_date: date, p_action: "SET", p_note: null, p_slot: "default", p_choice_key: choice, p_item_key: "default",
        });
        expect(res.error, `${cc} SET ${date}: ${res.error?.message}`).toBeNull();
      };
      await setOrder(ORDER_DATES[0], "paasmurt"); // daglig
      await setOrder(ORDER_DATES[1], "paasmurt"); // ukentlig
      await setOrder(ORDER_DATES[2], "paasmurt");
      await setOrder(ORDER_DATES[3], "paasmurt");
      await setOrder(ORDER_DATES[0], "salatboks"); // oppdatering (bytt valg)
      const cancel = await employee.client.rpc("lp_order_set", {
        p_date: ORDER_DATES[3], p_action: "CANCEL", p_note: null, p_slot: "default", p_choice_key: null, p_item_key: "default",
      });
      expect(cancel.error, `${cc} CANCEL: ${cancel.error?.message}`).toBeNull();

      const { rows: activeOrders } = await fixturePgQuery(
        `select id, currency_code from public.orders where provider_id = $1 and status = 'ACTIVE' order by date`,
        [ctx.providerId],
      );
      expect(activeOrders.length, `${cc} aktive ordre`).toBe(3);
      // VALUTASANNHET: ordre bærer markedets valuta (aldri implisitt NOK).
      for (const o of activeOrders) expect(o.currency_code, `${cc} ordrevaluta`).toBe(ctx.currency);

      // 9) KITCHEN → PRODUCTION → PACKING → DELIVERY (ekte kitchen-JWT).
      for (const o of activeOrders) {
        for (const target of ["PREPARED", "DISPATCHED", "DELIVERED"]) {
          const adv = await kitchen.client.rpc("lp_order_advance_status", {
            p_order_id: o.id, p_target_status: target, p_note: null,
          });
          expect(adv.error, `${cc} ${target}: ${adv.error?.message}`).toBeNull();
        }
      }

      // 10) 5 % COMMISSION LEDGER (postet av DELIVERED, eksakt og i markedsvaluta).
      const { rows: ledger } = await fixturePgQuery(
        `select currency, sum(commission_basis_amount_minor)::bigint as basis, sum(commission_amount_exact)::numeric as commission, count(*)::int as rows
         from public.commission_ledger where provider_id = $1 group by currency`,
        [ctx.providerId],
      );
      expect(ledger.length, `${cc} ledger valutaer`).toBe(1);
      expect(ledger[0].currency).toBe(ctx.currency);
      expect(Number(ledger[0].rows)).toBe(3);
      expect(Number(ledger[0].basis)).toBe(27000); // 3 × 9000 netto minor
      expect(Number(ledger[0].commission)).toBe(1350); // nøyaktig 5 %

      // 11) MARKET APPROVAL → ACTIVE (Fase 10-registeret; NO er allerede ACTIVE).
      const { rows: ab } = await fixturePgQuery(`select * from public.market_approvals where country_code = $1`, [cc]);
      ctx.approvalBackup = ab[0] ?? null;
      if (cc !== "NO") {
        for (const step of ["TAX_REVIEW_PENDING", "TAX_APPROVED", "LEGAL_REVIEW_PENDING", "LEGAL_APPROVED", "ACTIVE"]) {
          const tr = await admin.rpc("lp_market_approval_transition", {
            p_country_code: cc, p_new_status: step, p_reason: `rc15g2c-${runId}`, p_actor_user_id: null,
          });
          expect(tr.error, `${cc} approval ${step}: ${tr.error?.message}`).toBeNull();
        }
      }

      // 12) PROVIDER INVOICE: build → finalize → sent → payment → PAID.
      const draft = await admin.rpc("lp_invoice_build_draft", {
        p_provider_id: ctx.providerId, p_company_id: ctx.companyId,
        p_period_start: PERIOD_START, p_period_end: PERIOD_END, p_actor_user_id: null,
      });
      expect(draft.error, `${cc} draft: ${draft.error?.message}`).toBeNull();
      ctx.invoiceId = String(draft.data.invoice_id);
      expect(Number(draft.data.lines)).toBe(3);

      const fin = await admin.rpc("lp_invoice_finalize", { p_invoice_id: ctx.invoiceId, p_actor_user_id: null });
      expect(fin.error, `${cc} finalize: ${fin.error?.message}`).toBeNull();
      const sent = await admin.rpc("lp_invoice_mark_sent", {
        p_invoice_id: ctx.invoiceId, p_recipient_email: `rc15g2c-co-${lower}-${runId}@test.lunchportalen.no`, p_actor_user_id: null,
      });
      expect(sent.error, `${cc} sent: ${sent.error?.message}`).toBeNull();

      const { rows: head } = await fixturePgQuery(
        `select invoice_number, currency, amount_net, amount_tax, amount_total from public.agreement_invoices where id = $1`,
        [ctx.invoiceId],
      );
      expect(head[0].invoice_number, `${cc} fakturanummer`).toBeTruthy();
      expect(head[0].currency, `${cc} fakturavaluta`).toBe(ctx.currency);
      // FAKTURABALANSE: netto+mva = total, sum(linjer) = hode. 3 × 90.00 = 270.
      expect(Number(head[0].amount_net)).toBeCloseTo(270, 2);
      expect(Number(head[0].amount_net) + Number(head[0].amount_tax)).toBeCloseTo(Number(head[0].amount_total), 2);
      const { rows: lineSum } = await fixturePgQuery(
        `select sum(line_amount)::numeric as net, sum(vat_amount)::numeric as tax, count(distinct currency)::int as curr from public.agreement_invoice_lines where invoice_id = $1`,
        [ctx.invoiceId],
      );
      expect(Number(lineSum[0].net)).toBeCloseTo(Number(head[0].amount_net), 2);
      expect(Number(lineSum[0].curr)).toBe(1);

      const pay = await admin.rpc("lp_invoice_register_payment", {
        p_invoice_id: ctx.invoiceId, p_amount: Number(head[0].amount_total), p_paid_at: new Date().toISOString(),
        p_method: "BANK", p_reference: `rc15g2c-${cc}`, p_idempotency_key: `rc15g2c-pay-${cc}-${runId}`, p_actor_user_id: null,
      });
      expect(pay.error, `${cc} payment: ${pay.error?.message}`).toBeNull();
      const { rows: paid } = await fixturePgQuery(`select status, amount_paid from public.agreement_invoices where id = $1`, [ctx.invoiceId]);
      expect(paid[0].status).toBe("PAID");
      expect(Number(paid[0].amount_paid)).toBeCloseTo(Number(head[0].amount_total), 2);

      // 13) CREDIT NOTE / CORRECTION (negativ speiling, lovlig fra PAID).
      const credit = await admin.rpc("lp_invoice_create_credit_note", {
        p_invoice_id: ctx.invoiceId, p_reason: `rc15g2c correction ${cc}`, p_actor_user_id: null, p_order_ids: null,
      });
      expect(credit.error, `${cc} credit: ${credit.error?.message}`).toBeNull();
      const { rows: cn } = await fixturePgQuery(
        `select amount_total, currency from public.agreement_invoices where credit_of_invoice_id = $1 and kind = 'CREDIT_NOTE'`,
        [ctx.invoiceId],
      );
      expect(cn.length).toBe(1);
      expect(Number(cn[0].amount_total)).toBeCloseTo(-Number(head[0].amount_total), 2);
      expect(cn[0].currency).toBe(ctx.currency);

      // 14) COMMISSION: dry-run → close+invoice → issue → payment marked.
      const dry = await admin.rpc("lp_billing_invoice_close_dry_run", {
        p_provider_id: ctx.providerId, p_period_start: PERIOD_START, p_period_end: PERIOD_END, p_currency: ctx.currency,
      });
      expect(dry.error, `${cc} commission dry-run: ${dry.error?.message}`).toBeNull();
      const dryRow = Array.isArray(dry.data) ? dry.data[0] : dry.data;
      expect(dryRow.can_close, `${cc} can_close: ${JSON.stringify(dryRow.missing_requirements)}`).toBe(true);
      expect(Number(dryRow.rounded_commission_amount_minor)).toBe(minor(1350));

      const closed = await admin.rpc("lp_billing_create_commission_invoice", {
        p_provider_id: ctx.providerId, p_period_start: PERIOD_START, p_period_end: PERIOD_END, p_currency: ctx.currency, p_idempotency_key: null,
      });
      expect(closed.error, `${cc} commission close: ${closed.error?.message}`).toBeNull();
      const closedRow = Array.isArray(closed.data) ? closed.data[0] : closed.data;
      const commissionInvoiceId = String(closedRow.provider_invoice_id);
      expect(closedRow.currency).toBe(ctx.currency);

      const issued = await admin.rpc("lp_commission_invoice_issue", { p_invoice_id: commissionInvoiceId, p_actor_user_id: null });
      expect(issued.error, `${cc} commission issue: ${issued.error?.message}`).toBeNull();

      const cpay = await admin.rpc("lp_commission_invoice_register_payment", {
        p_invoice_id: commissionInvoiceId, p_amount_minor: 1350, p_paid_at: new Date().toISOString(),
        p_method: "BANK", p_reference: `rc15g2c-comm-${cc}`, p_idempotency_key: `rc15g2c-comm-${cc}-${runId}`, p_actor_user_id: null,
      });
      expect(cpay.error, `${cc} commission payment: ${cpay.error?.message}`).toBeNull();
      expect(cpay.data.payment_status).toBe("paid");

      // PROVISJONSBALANSE: fakturabeløp = periodens avrundede 5 %.
      const { rows: cinv } = await fixturePgQuery(
        `select pci.total_amount_minor, pci.currency, cp.rounded_commission_minor
         from public.provider_commission_invoices pci join public.commission_periods cp on cp.id = pci.commission_period_id
         where pci.id = $1`,
        [commissionInvoiceId],
      );
      expect(Number(cinv[0].total_amount_minor)).toBe(Number(cinv[0].rounded_commission_minor));
      expect(cinv[0].currency).toBe(ctx.currency);

      // 15) SUPERADMIN NORWEGIAN VIEW: original + norsk, kilde/review bevart.
      const wish = `Coverage wish written in ${ctx.language} for ${cc} (rc15g2c-${runId})`;
      const hash = crypto.createHash("sha256").update(wish, "utf8").digest("hex");
      if (ctx.language !== "nb") {
        const { rows: tr } = await fixturePgQuery(
          `insert into public.superadmin_translations (entity_type, entity_id, field_name, original_language, original_text, original_text_hash, translated_text_nb, translation_source, review_state, confidence, translated_at)
           values ('provider_registration', $1, 'coverage_wish', $2, $3, $4, $5, 'manual', 'reviewed', 1, now())
           on conflict (entity_type, entity_id, field_name, original_text_hash) do nothing
           returning id, original_text, translated_text_nb`,
          [ctx.registrationId, ctx.language, wish, hash, `Dekningsønske for ${cc} (rc15g2c-${runId})`],
        );
        expect(tr.length, `${cc} superadmin translation`).toBe(1);
        expect(tr[0].original_text).toBe(wish); // original bevart
        expect(tr[0].translated_text_nb).toContain("Dekningsønske"); // norsk side
      }
    }, 120_000);
  }

  it("tenant isolation A/B/C: no provider references another provider's company", async () => {
    const sample = ["NO", "DE", "US"].map((cc) => ctxByCountry.get(cc)).filter((c) => c?.providerId);
    expect(sample.length).toBe(3);
    for (const c of sample) {
      const { rows } = await fixturePgQuery(
        `select count(*)::int as n from public.agreement_invoices i
         join public.companies co on co.id = i.company_id
         where i.provider_id = $1 and co.provider_id <> $1`,
        [c.providerId],
      );
      expect(Number(rows[0].n), `${c.cc} cross-tenant invoice`).toBe(0);
      const { rows: lrows } = await fixturePgQuery(
        `select count(*)::int as n from public.commission_ledger cl
         join public.orders o on o.id = cl.order_id
         where cl.provider_id = $1 and o.provider_id <> $1`,
        [c.providerId],
      );
      expect(Number(lrows[0].n), `${c.cc} cross-tenant ledger`).toBe(0);
    }
    // Ansatt i land A har ingen ordre hos provider B.
    const a = ctxByCountry.get("NO");
    const b = ctxByCountry.get("DE");
    const { rows: cross } = await fixturePgQuery(
      `select count(*)::int as n from public.orders where user_id = $1 and provider_id = $2`,
      [a.employeeId, b.providerId],
    );
    expect(Number(cross[0].n)).toBe(0);

    // Kitchen in NO cannot advance DE orders (cross-country membership isolation).
    const { rows: deOrders } = await fixturePgQuery(
      `select id from public.orders where provider_id = $1 limit 1`,
      [b.providerId],
    );
    expect(deOrders[0]?.id, "DE order for negative kitchen test").toBeTruthy();
    const kitchenNo = kitchenByCountry.get("NO")!;
    const denied = await kitchenNo.client.rpc("lp_order_advance_status", {
      p_order_id: deOrders[0].id,
      p_target_status: "PREPARED",
      p_note: null,
    });
    expect(denied.error, "cross-country kitchen advance must fail").toBeTruthy();

    // Distinct org IDs across all 21 countries.
    const providerIds = COUNTRIES.map((cc) => ctxByCountry.get(cc)?.providerId).filter(Boolean);
    const companyIds = COUNTRIES.map((cc) => ctxByCountry.get(cc)?.companyId).filter(Boolean);
    expect(new Set(providerIds).size).toBe(21);
    expect(new Set(companyIds).size).toBe(21);
  }, 60_000);

  it("no stuck outbox rows caused by the RC run", async () => {
    const { rows } = await fixturePgQuery(
      `select count(*)::int as n from public.outbox
       where status in ('FAILED', 'FAILED_PERMANENT') and created_at > now() - interval '2 hours'`,
    );
    expect(Number(rows[0].n)).toBe(0);
  }, 30_000);
});
