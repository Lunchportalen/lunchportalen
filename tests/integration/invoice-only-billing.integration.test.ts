/**
 * PHASE 8 — provider→company invoice-only billing (staging integration).
 *
 * Required proof, all against real Postgres (staging uigx):
 *  - one invoice DRAFT→ISSUED→SENT→PAID (sequential numbering, due date)
 *  - one partial payment (PARTIALLY_PAID) + idempotent re-import (no double)
 *  - one credit note (full → original CREDITED, negative mirrored lines)
 *  - one cancellation correction (partial credit for a specific order)
 *  - one cross-period correction (correction line referencing another period's order)
 *  - correct tax/currency from immutable snapshots (never live prices)
 *  - only DELIVERED lines are chargeable (ACTIVE excluded)
 *  - provider sees only own invoices; company sees only own (and no drafts)
 *  - reissue after correction (VOID frees orders → new draft → new number)
 *
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 + staging env. NO Stripe anywhere.
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requirePostgres: true });
const d = RUN ? describe : describe.skip;

const rand = () => crypto.randomUUID().slice(0, 8);

d("provider→company invoice-only billing (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const runId = rand();

  const provA = crypto.randomUUID();
  const provB = crypto.randomUUID();
  const compA = crypto.randomUUID();
  const compB = crypto.randomUUID();
  const locA = crypto.randomUUID();
  const locB = crypto.randomUUID();
  const empA = crypto.randomUUID(); // profiles skipped — orders seeded in replica mode
  const P1_START = "2026-06-01";
  const P1_END = "2026-06-30";
  const P2_START = "2026-07-01";
  const P2_END = "2026-07-31";

  const orders = {
    a1: crypto.randomUUID(), // delivered P1
    a2: crypto.randomUUID(), // delivered P1
    a3: crypto.randomUUID(), // ACTIVE P1 (must never be invoiced)
    a4: crypto.randomUUID(), // delivered P2 (cross-period correction target)
    b1: crypto.randomUUID(), // provider B delivered P1
  };

  async function seedTenant(pid: string, cid: string, lid: string, label: string) {
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [pid, `Bill Prov ${label} ${runId}`, `bill-prov-${label}-${runId}`, `bill-${label}-${runId}@test.lunchportalen.no`],
    );
    // billing_audit_log.organization_id FK → organizations (provider-speil).
    await fixturePgQuery(
      `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
      [pid, `Bill Prov ${label} ${runId}`, `bill-prov-${label}-${runId}`],
    );
    // FASE 10: fakturagate krever billingprofil (markeds-/valutasannhet) og
    // kommersielt ACTIVE marked (NO er produksjonsmarked). Currency hentes fra
    // markedet — aldri hardkodet.
    await fixturePgQuery(
      `insert into public.organization_billing_profiles
         (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status)
       select $1, m.id, $2, m.country_code, m.tax_country_code, m.default_currency, m.default_timezone, $3, 'active'
       from public.markets m where m.country_code = 'NO' and m.is_active = true limit 1
       on conflict (organization_id) do nothing`,
      [pid, `Bill Prov ${label} ${runId} AS`, `obp-bill-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id, employee_count, billing_email)
       values ($1, $2, 'ACTIVE', $3, $4::uuid, 25, $5)`,
      [cid, `Bill Co ${label} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, pid, `faktura-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(`insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'Hovedlokasjon', 'Fakturaveien 1')`, [lid, cid]);
    await fixturePgQuery(`update public.companies set default_location_id = $2 where id = $1`, [cid, lid]);
    const agr = await fixturePgQuery(
      `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
       values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now()) returning id`,
      [cid, lid, pid],
    );
    return String(agr.rows[0].id);
  }

  async function seedOrder(opts: {
    id: string;
    userId: string;
    date: string;
    status: string;
    pid: string;
    cid: string;
    lid: string;
    agreementId: string;
    priceCents: number;
    productName: string;
  }) {
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      {
        text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot, currency_code, cancelled_at)
               values ($1, $2, $3::date, ($4::text)::public.order_status, $5, $6, $7::uuid, $8::uuid, 'BASIS', 90, 'default', 'NOK',
                       case when $4::text = 'CANCELLED' then now() else null end)`,
        values: [opts.id, opts.userId, opts.date, opts.status, opts.cid, opts.lid, opts.pid, opts.agreementId],
      },
      {
        text: `insert into public.order_items (order_id, product_id, quantity, product_name_snapshot, unit_name_snapshot,
                 unit_price_cents_ex_vat, vat_rate_snapshot, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat)
               select $1, p.id, 1, $2, 'porsjon', $3::int, 0.15, $3::int, round($3::int * 0.15)::int, round($3::int * 1.15)::int
               from public.products p where p.company_id is null and p.sku = 'paasmurt' limit 1`,
        values: [opts.id, opts.productName, opts.priceCents],
      },
    ]);
  }

  let agreementA = "";
  let agreementB = "";
  let invoiceId = "";
  let invoiceNumber = "";

  beforeAll(async () => {
    if (!RUN) return;
    agreementA = await seedTenant(provA, compA, locA, "a");
    agreementB = await seedTenant(provB, compB, locB, "b");
    await seedOrder({ id: orders.a1, userId: empA, date: "2026-06-15", status: "DELIVERED", pid: provA, cid: compA, lid: locA, agreementId: agreementA, priceCents: 9000, productName: "Påsmurt" });
    await seedOrder({ id: orders.a2, userId: empA, date: "2026-06-16", status: "DELIVERED", pid: provA, cid: compA, lid: locA, agreementId: agreementA, priceCents: 9000, productName: "Salatboks" });
    await seedOrder({ id: orders.a3, userId: empA, date: "2026-06-17", status: "ACTIVE", pid: provA, cid: compA, lid: locA, agreementId: agreementA, priceCents: 9000, productName: "Varmrett" });
    await seedOrder({ id: orders.a4, userId: empA, date: "2026-07-02", status: "DELIVERED", pid: provA, cid: compA, lid: locA, agreementId: agreementA, priceCents: 9000, productName: "Påsmurt" });
    await seedOrder({ id: orders.b1, userId: empA, date: "2026-06-15", status: "DELIVERED", pid: provB, cid: compB, lid: locB, agreementId: agreementB, priceCents: 9000, productName: "Påsmurt" });
  }, 180_000);

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.invoice_payments where invoice_id in (select id from public.agreement_invoices where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.agreement_invoice_lines where invoice_id in (select id from public.agreement_invoices where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
      { text: `delete from public.agreement_invoices where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.invoice_sequences where provider_id = any($1::uuid[])`, values: [[provA, provB]] },
      { text: `delete from public.billing_audit_log where organization_id = any($1::uuid[])`, values: [[provA, provB]] },
      { text: `delete from public.order_items where order_id = any($1::uuid[])`, values: [Object.values(orders)] },
      { text: `delete from public.order_status_history where order_id = any($1::uuid[])`, values: [Object.values(orders)] },
      { text: `delete from public.orders where id = any($1::uuid[])`, values: [Object.values(orders)] },
      { text: `delete from public.outbox where event_key like 'invoice.email:%'`, values: [] },
      { text: `delete from public.agreement_delivery_days where agreement_id = any($1::uuid[])`, values: [[agreementA, agreementB]] },
      { text: `delete from public.agreements where id = any($1::uuid[])`, values: [[agreementA, agreementB]] },
      { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.companies where id = any($1::uuid[])`, values: [[compA, compB]] },
      { text: `delete from public.organization_billing_profiles where organization_id = any($1::uuid[])`, values: [[provA, provB]] },
      { text: `delete from public.organizations where id = any($1::uuid[])`, values: [[provA, provB]] },
      { text: `delete from public.providers where id = any($1::uuid[])`, values: [[provA, provB]] },
    ]);
    await closeFixturePgPool();
  }, 180_000);

  it("builds DRAFT from DELIVERED lines only, with immutable tax/currency snapshots", async () => {
    const res = await admin.rpc("lp_invoice_build_draft", {
      p_provider_id: provA,
      p_company_id: compA,
      p_period_start: P1_START,
      p_period_end: P1_END,
      p_actor_user_id: null,
    });
    expect(res.error, res.error?.message).toBeNull();
    invoiceId = String(res.data.invoice_id);
    expect(Number(res.data.lines)).toBe(2); // a1 + a2; ACTIVE a3 excluded; P2 a4 excluded; B excluded

    const { rows: head } = await fixturePgQuery(
      `select status, kind, currency, amount_net::numeric as net, amount_tax::numeric as tax, amount_total::numeric as total
       from public.agreement_invoices where id = $1::uuid`,
      [invoiceId],
    );
    expect(head[0].status).toBe("DRAFT");
    expect(head[0].currency).toBe("NOK");
    // 2 × 90.00 net, 15% mva → 27.00 tax, 207.00 gross (immutable snapshot math).
    expect(Number(head[0].net)).toBeCloseTo(180.0, 2);
    expect(Number(head[0].tax)).toBeCloseTo(27.0, 2);
    expect(Number(head[0].total)).toBeCloseTo(207.0, 2);

    const { rows: lines } = await fixturePgQuery(
      `select source, order_id::text as oid, quantity, unit_price::numeric as up, vat_rate::numeric as vr, location_id::text as loc
       from public.agreement_invoice_lines where invoice_id = $1::uuid order by service_date`,
      [invoiceId],
    );
    expect(lines.every((l) => l.source === "ORDER")).toBe(true);
    expect(lines.map((l) => l.oid).sort()).toEqual([orders.a1, orders.a2].sort());
    expect(lines.every((l) => Number(l.up) === 90)).toBe(true);
    expect(lines.every((l) => Number(l.vr) === 0.15)).toBe(true);
    expect(lines.every((l) => l.loc === locA)).toBe(true);
  }, 120_000);

  it("supports additions and discounts on the draft", async () => {
    const add = await admin.rpc("lp_invoice_add_line", {
      p_invoice_id: invoiceId,
      p_source: "ADDITION",
      p_description: "Leveringstillegg juni",
      p_quantity: 1,
      p_unit_price: 50,
      p_vat_rate: 0.25,
      p_actor_user_id: null,
      p_order_id: null,
      p_service_date: null,
    });
    expect(add.error, add.error?.message).toBeNull();

    const disc = await admin.rpc("lp_invoice_add_line", {
      p_invoice_id: invoiceId,
      p_source: "DISCOUNT",
      p_description: "Lojalitetsrabatt",
      p_quantity: 1,
      p_unit_price: 30,
      p_vat_rate: 0.25,
      p_actor_user_id: null,
      p_order_id: null,
      p_service_date: null,
    });
    expect(disc.error, disc.error?.message).toBeNull();

    const { rows } = await fixturePgQuery(
      `select amount_net::numeric as net, amount_total::numeric as total from public.agreement_invoices where id = $1::uuid`,
      [invoiceId],
    );
    // 180 + 50 - 30 = 200 net; tax 27 + 12.50 - 7.50 = 32; total 232.
    expect(Number(rows[0].net)).toBeCloseTo(200.0, 2);
    expect(Number(rows[0].total)).toBeCloseTo(232.0, 2);
  }, 60_000);

  it("DRAFT→ISSUED→SENT→PAID with sequential numbering, due date and idempotent payments", async () => {
    const fin = await admin.rpc("lp_invoice_finalize", { p_invoice_id: invoiceId, p_actor_user_id: null });
    expect(fin.error, fin.error?.message).toBeNull();
    invoiceNumber = String(fin.data.invoice_number);
    expect(invoiceNumber).toMatch(/^F-BILLPROVA/); // per-provider legal entity prefix
    expect(invoiceNumber).toMatch(/-\d{4}-0001$/); // sequential start

    const { rows: issued } = await fixturePgQuery(
      `select status, due_date, issued_at, payment_terms_days from public.agreement_invoices where id = $1::uuid`,
      [invoiceId],
    );
    expect(issued[0].status).toBe("ISSUED");
    expect(issued[0].due_date).toBeTruthy(); // +14 dager betalingsbetingelser
    expect(issued[0].payment_terms_days).toBe(14);

    // Draft is frozen after issue.
    const lateLine = await admin.rpc("lp_invoice_add_line", {
      p_invoice_id: invoiceId, p_source: "ADDITION", p_description: "x", p_quantity: 1, p_unit_price: 1, p_vat_rate: 0, p_actor_user_id: null, p_order_id: null, p_service_date: null,
    });
    expect(String(lateLine.error?.message ?? "")).toContain("INVOICE_NOT_DRAFT");

    const sent = await admin.rpc("lp_invoice_mark_sent", { p_invoice_id: invoiceId, p_recipient_email: `faktura-a-${runId}@test.lunchportalen.no`, p_actor_user_id: null });
    expect(sent.error).toBeNull();

    // Partial payment → PARTIALLY_PAID.
    const pay1 = await admin.rpc("lp_invoice_register_payment", {
      p_invoice_id: invoiceId, p_amount: 100, p_paid_at: new Date().toISOString(), p_method: "BANK",
      p_reference: "KID-1", p_idempotency_key: `bank:${runId}:1`, p_actor_user_id: null,
    });
    expect(pay1.error, pay1.error?.message).toBeNull();
    expect(pay1.data.status).toBe("PARTIALLY_PAID");
    expect(Number(pay1.data.amount_paid)).toBeCloseTo(100, 2);

    // Idempotent reconciliation import: same key replayed → no double booking.
    const payDup = await admin.rpc("lp_invoice_register_payment", {
      p_invoice_id: invoiceId, p_amount: 100, p_paid_at: new Date().toISOString(), p_method: "BANK",
      p_reference: "KID-1", p_idempotency_key: `bank:${runId}:1`, p_actor_user_id: null,
    });
    expect(payDup.error).toBeNull();
    expect(payDup.data.idempotent).toBe(true);
    expect(Number(payDup.data.amount_paid)).toBeCloseTo(100, 2);

    // Rest → PAID.
    const pay2 = await admin.rpc("lp_invoice_register_payment", {
      p_invoice_id: invoiceId, p_amount: 132, p_paid_at: new Date().toISOString(), p_method: "BANK",
      p_reference: "KID-2", p_idempotency_key: `bank:${runId}:2`, p_actor_user_id: null,
    });
    expect(pay2.error).toBeNull();
    expect(pay2.data.status).toBe("PAID");
    expect(Number(pay2.data.amount_paid)).toBeCloseTo(232, 2);
  }, 120_000);

  it("cancellation correction: partial credit note for one order", async () => {
    const credit = await admin.rpc("lp_invoice_create_credit_note", {
      p_invoice_id: invoiceId,
      p_reason: "Kansellert leveranse 16.06 (korrigering)",
      p_actor_user_id: null,
      p_order_ids: [orders.a2],
    });
    expect(credit.error, credit.error?.message).toBeNull();
    const creditId = String(credit.data.credit_note_id);
    expect(credit.data.full_credit).toBe(false);

    // Cross-period correction on the same credit note draft: correction line
    // referencing the JULY order (a4) — kryssperiode-korrigering.
    const cross = await admin.rpc("lp_invoice_add_line", {
      p_invoice_id: creditId,
      p_source: "CORRECTION",
      p_description: "Korrigering: feilpriset leveranse 02.07 (annen periode)",
      p_quantity: 1,
      p_unit_price: -20,
      p_vat_rate: 0.15,
      p_actor_user_id: null,
      p_order_id: orders.a4,
      p_service_date: "2026-07-02",
    });
    expect(cross.error, cross.error?.message).toBeNull();

    const fin = await admin.rpc("lp_invoice_finalize", { p_invoice_id: creditId, p_actor_user_id: null });
    expect(fin.error, fin.error?.message).toBeNull();
    expect(String(fin.data.invoice_number)).toMatch(/^KN-BILLPROVA/); // egen kreditnota-serie

    const { rows } = await fixturePgQuery(
      `select kind, status, amount_net::numeric as net, credit_of_invoice_id::text as orig
       from public.agreement_invoices where id = $1::uuid`,
      [creditId],
    );
    expect(rows[0].kind).toBe("CREDIT_NOTE");
    expect(rows[0].status).toBe("ISSUED");
    expect(rows[0].orig).toBe(invoiceId);
    // -90 (kreditert ordre a2) + -20 (kryssperiode-korrigering) = -110 netto.
    expect(Number(rows[0].net)).toBeCloseTo(-110.0, 2);

    // Partiell kreditt endrer IKKE originalens status til CREDITED.
    const { rows: orig } = await fixturePgQuery(`select status from public.agreement_invoices where id = $1::uuid`, [invoiceId]);
    expect(orig[0].status).toBe("PAID");
  }, 120_000);

  it("full credit note marks the original CREDITED", async () => {
    // Ny faktura for P2 (a4) → utsted → full kreditnota → original CREDITED.
    const draft = await admin.rpc("lp_invoice_build_draft", {
      p_provider_id: provA, p_company_id: compA, p_period_start: P2_START, p_period_end: P2_END, p_actor_user_id: null,
    });
    expect(draft.error, draft.error?.message).toBeNull();
    const p2Invoice = String(draft.data.invoice_id);
    const fin = await admin.rpc("lp_invoice_finalize", { p_invoice_id: p2Invoice, p_actor_user_id: null });
    expect(fin.error).toBeNull();
    // Én sekvens per provider (juridisk enhet) delt av faktura + kreditnota:
    // nummeret fortsetter strengt stigende etter 0001 (kreditnotaen tok 0002).
    const seq = Number(String(fin.data.invoice_number).match(/-(\d{4})$/)?.[1] ?? "0");
    expect(seq).toBeGreaterThan(1);

    const credit = await admin.rpc("lp_invoice_create_credit_note", {
      p_invoice_id: p2Invoice, p_reason: "Full kreditering av juli", p_actor_user_id: null, p_order_ids: null,
    });
    expect(credit.error).toBeNull();
    const creditId = String(credit.data.credit_note_id);
    expect(credit.data.full_credit).toBe(true);
    const cfin = await admin.rpc("lp_invoice_finalize", { p_invoice_id: creditId, p_actor_user_id: null });
    expect(cfin.error).toBeNull();

    const { rows } = await fixturePgQuery(
      `select status, credited_by_invoice_id::text as by from public.agreement_invoices where id = $1::uuid`,
      [p2Invoice],
    );
    expect(rows[0].status).toBe("CREDITED");
    expect(rows[0].by).toBe(creditId);
  }, 120_000);

  it("reissue after correction: VOID frees orders, rebuild gets a NEW sequential number", async () => {
    // Provider B: bygg + utsted, VOID, bygg på nytt → nytt nummer, samme ordre.
    const d1 = await admin.rpc("lp_invoice_build_draft", {
      p_provider_id: provB, p_company_id: compB, p_period_start: P1_START, p_period_end: P1_END, p_actor_user_id: null,
    });
    expect(d1.error, d1.error?.message).toBeNull();
    const inv1 = String(d1.data.invoice_id);
    const f1 = await admin.rpc("lp_invoice_finalize", { p_invoice_id: inv1, p_actor_user_id: null });
    expect(f1.error).toBeNull();
    const n1 = String(f1.data.invoice_number);

    const v = await admin.rpc("lp_invoice_void", { p_invoice_id: inv1, p_reason: "Feil grunnlag — reissue", p_actor_user_id: null });
    expect(v.error).toBeNull();

    const d2 = await admin.rpc("lp_invoice_build_draft", {
      p_provider_id: provB, p_company_id: compB, p_period_start: P1_START, p_period_end: P1_END, p_actor_user_id: null,
    });
    expect(d2.error, d2.error?.message).toBeNull();
    const inv2 = String(d2.data.invoice_id);
    expect(inv2).not.toBe(inv1);
    const f2 = await admin.rpc("lp_invoice_finalize", { p_invoice_id: inv2, p_actor_user_id: null });
    expect(f2.error).toBeNull();
    expect(String(f2.data.invoice_number)).not.toBe(n1);
    expect(String(f2.data.invoice_number)).toMatch(/^F-BILLPROVB/);
  }, 120_000);

  it("tenant isolation: provider sees only own; company sees only own (and never drafts)", async () => {
    const { listProviderInvoices, listCompanyInvoices } = await import("@/lib/billing/invoiceLifecycle");

    const aInvoices = await listProviderInvoices(provA);
    expect(aInvoices.length).toBeGreaterThan(0);
    expect(aInvoices.every((i) => i.provider_id === provA)).toBe(true);
    expect(aInvoices.some((i) => i.provider_id === provB)).toBe(false);

    const bInvoices = await listProviderInvoices(provB);
    expect(bInvoices.every((i) => i.provider_id === provB)).toBe(true);

    const companyAView = await listCompanyInvoices(compA);
    expect(companyAView.length).toBeGreaterThan(0);
    expect(companyAView.every((i) => i.company_id === compA)).toBe(true);
    expect(companyAView.every((i) => i.status !== "DRAFT" && i.status !== "VOID")).toBe(true);

    // Cross-tenant draft build is fail-closed.
    const cross = await admin.rpc("lp_invoice_build_draft", {
      p_provider_id: provA, p_company_id: compB, p_period_start: P1_START, p_period_end: P1_END, p_actor_user_id: null,
    });
    expect(String(cross.error?.message ?? "")).toContain("COMPANY_NOT_OWNED_BY_PROVIDER");
  }, 120_000);
});
