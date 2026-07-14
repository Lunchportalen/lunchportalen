/**
 * PHASE 9 — platform commission invoice-only settlement (staging integration).
 *
 * Required proof, all against real Postgres (staging uigx), NO Stripe:
 *  - snapshot: delivered chargeable order → immutable commercial snapshot (integer minor units)
 *  - ledger: 5 % of net ex-tax posted as ORDER_COMPLETED (exact, never float drift)
 *  - correction: negative ORDER_CANCELLED mirror in open period
 *  - replay/idempotency: reposting completed + correction inserts 0 rows
 *  - close dry-run: read-only preview with can_close truth
 *  - close: explicit close → period invoiced, idempotent (same invoice on retry)
 *  - invoice: sequential platform number (LPK-YYYY-NNNN) + due date
 *  - delivery: outbox email to provider billing email + invoice_deliveries trail
 *  - closed period immutable / late correction → current (next) period
 *  - marked paid: manual bank payment — partial → partially_paid → paid, idempotent re-import
 *  - overdue + credit invoice (LPKN number, negative mirror, original credited)
 *  - multi-currency: EUR provider settles in EUR, NOK provider in NOK
 *  - no employee exposure: settlement RPCs not executable by authenticated/anon
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

d("platform commission invoice-only settlement (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const runId = rand();

  const provN = crypto.randomUUID(); // NOK provider
  const provE = crypto.randomUUID(); // EUR provider (multi-currency proof)
  const compN = crypto.randomUUID();
  const compE = crypto.randomUUID();
  const locN = crypto.randomUUID();
  const locE = crypto.randomUUID();
  const emp = crypto.randomUUID();

  const P_START = "2026-06-01";
  const P_END = "2026-06-30";

  const orders = {
    n1: crypto.randomUUID(), // delivered June, stays completed
    n2: crypto.randomUUID(), // delivered June, refunded AFTER close (late correction)
    n3: crypto.randomUUID(), // delivered June, cancelled BEFORE close (open-period correction)
    e1: crypto.randomUUID(), // EUR delivered June
  };

  let invoiceN = ""; // NOK commission invoice id
  let invoiceE = ""; // EUR commission invoice id

  async function seedProvider(pid: string, cid: string, lid: string, label: string, currency: string, countryCode: string) {
    await fixturePgQuery(
      `insert into public.providers (id, name, slug, contact_email, billing_model, status)
       values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
      [pid, `Komm Prov ${label} ${runId}`, `komm-prov-${label}-${runId}`, `komm-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
       values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
      [pid, `Komm Prov ${label} ${runId}`, `komm-prov-${label}-${runId}`],
    );
    await fixturePgQuery(
      `insert into public.organization_billing_profiles
         (organization_id, market_id, legal_name, legal_country_code, tax_country_code, billing_currency, billing_timezone, billing_email_current, billing_status)
       select $1, m.id, $2, $3, $3, $4, m.default_timezone, $5, 'active'
       from public.markets m where m.country_code = $3 and m.default_currency = $4 limit 1`,
      [pid, `Komm Prov ${label} ${runId} AS`, countryCode, currency, `faktura-komm-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id, employee_count, billing_email)
       values ($1, $2, 'ACTIVE', $3, $4::uuid, 10, $5)`,
      [cid, `Komm Co ${label} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, pid, `co-komm-${label}-${runId}@test.lunchportalen.no`],
    );
    await fixturePgQuery(
      `insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'Hovedlokasjon', 'Provisjonsveien 1')`,
      [lid, cid],
    );
    const agr = await fixturePgQuery(
      `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
       values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now()) returning id`,
      [cid, lid, pid],
    );
    return String(agr.rows[0].id);
  }

  async function seedDeliveredOrder(opts: {
    id: string;
    date: string;
    createdAt: string;
    pid: string;
    cid: string;
    lid: string;
    agreementId: string;
    priceCents: number;
    currency: string;
  }) {
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      {
        text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot, currency_code, created_at)
               values ($1, $2, $3::date, ('DELIVERED'::text)::public.order_status, $4, $5, $6::uuid, $7::uuid, 'BASIS', 90, 'default', $8, $9::timestamptz)`,
        values: [opts.id, emp, opts.date, opts.cid, opts.lid, opts.pid, opts.agreementId, opts.currency, opts.createdAt],
      },
      {
        text: `insert into public.order_items (order_id, product_id, quantity, product_name_snapshot, unit_name_snapshot,
                 unit_price_cents_ex_vat, vat_rate_snapshot, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat)
               select $1, p.id, 1, 'Påsmurt', 'porsjon', $2::int, 0.15, $2::int, round($2::int * 0.15)::int, round($2::int * 1.15)::int
               from public.products p where p.company_id is null and p.sku = 'paasmurt' limit 1`,
        values: [opts.id, opts.priceCents],
      },
    ]);
  }

  async function snapshotOrder(orderId: string) {
    const { rows } = await fixturePgQuery(`select id from public.order_items where order_id = $1`, [orderId]);
    for (const r of rows) {
      const res = await admin.rpc("lp_billing_create_order_line_snapshot", { p_order_line_id: r.id });
      expect(res.error).toBeNull();
    }
  }

  beforeAll(async () => {
    if (!RUN) return;
    const agrN = await seedProvider(provN, compN, locN, "n", "NOK", "NO");
    const agrE = await seedProvider(provE, compE, locE, "e", "EUR", "DE");
    await seedDeliveredOrder({ id: orders.n1, date: "2026-06-15", createdAt: "2026-06-15T10:00:00Z", pid: provN, cid: compN, lid: locN, agreementId: agrN, priceCents: 9000, currency: "NOK" });
    await seedDeliveredOrder({ id: orders.n2, date: "2026-06-16", createdAt: "2026-06-16T10:00:00Z", pid: provN, cid: compN, lid: locN, agreementId: agrN, priceCents: 9000, currency: "NOK" });
    await seedDeliveredOrder({ id: orders.n3, date: "2026-06-17", createdAt: "2026-06-17T10:00:00Z", pid: provN, cid: compN, lid: locN, agreementId: agrN, priceCents: 9000, currency: "NOK" });
    await seedDeliveredOrder({ id: orders.e1, date: "2026-06-15", createdAt: "2026-06-15T10:00:00Z", pid: provE, cid: compE, lid: locE, agreementId: agrE, priceCents: 8000, currency: "EUR" });
  }, 180_000);

  afterAll(async () => {
    if (!RUN) return;
    const provIds = [provN, provE];
    const orderIds = Object.values(orders);
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.commission_invoice_payments where invoice_id in (select id from public.provider_commission_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
      { text: `delete from public.invoice_deliveries where invoice_id in (select id from public.provider_commission_invoices where provider_id = any($1::uuid[]))`, values: [provIds] },
      { text: `delete from public.provider_commission_invoices where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.commission_periods where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.commission_ledger where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.order_line_commercial_snapshots where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.billing_readiness_events where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.billing_audit_log where organization_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.outbox where event_key like 'commission.invoice.email:%'`, values: [] },
      { text: `delete from public.order_items where order_id = any($1::uuid[])`, values: [orderIds] },
      { text: `delete from public.order_status_history where order_id = any($1::uuid[])`, values: [orderIds] },
      { text: `delete from public.orders where id = any($1::uuid[])`, values: [orderIds] },
      { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where provider_id = any($1::uuid[]))`, values: [provIds] },
      { text: `delete from public.agreements where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [[compN, compE]] },
      { text: `delete from public.companies where id = any($1::uuid[])`, values: [[compN, compE]] },
      { text: `delete from public.organization_billing_profiles where organization_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.provider_settings where provider_id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.organizations where id = any($1::uuid[])`, values: [provIds] },
      { text: `delete from public.providers where id = any($1::uuid[])`, values: [provIds] },
    ]);
    await closeFixturePgPool();
  }, 120_000);

  it("proof: snapshot — delivered order gets immutable integer minor-unit snapshot", async () => {
    await snapshotOrder(orders.n1);
    await snapshotOrder(orders.n2);
    await snapshotOrder(orders.n3);
    await snapshotOrder(orders.e1);

    const { rows } = await fixturePgQuery(
      `select currency, line_subtotal_ex_tax_minor, commission_rate_bps, tax_rate_snapshot
       from public.order_line_commercial_snapshots where order_id = $1`,
      [orders.n1],
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].line_subtotal_ex_tax_minor)).toBe(9000); // integer minor units, net ex tax
    expect(Number(rows[0].commission_rate_bps)).toBe(500); // 5 % canonical rule
    expect(rows[0].currency).toBe("NOK");

    // Immutability: snapshot mutation must be rejected.
    const mut = await fixturePgQuery(
      `update public.order_line_commercial_snapshots set line_subtotal_ex_tax_minor = 1 where order_id = $1`,
      [orders.n1],
    ).catch((e) => e);
    expect(String(mut?.message ?? mut)).toContain("append-only");
  });

  it("proof: ledger — 5 % of net ex tax posted exactly, in provider currency and period", async () => {
    for (const id of [orders.n1, orders.n2, orders.n3, orders.e1]) {
      const res = await admin.rpc("lp_billing_post_delivered_commission", { p_order_id: id });
      expect(res.error).toBeNull();
      expect(Number(res.data)).toBe(1);
    }

    const { rows } = await fixturePgQuery(
      `select event_type, currency, commission_basis_amount_minor, commission_amount_exact, billing_period
       from public.commission_ledger where order_id = $1`,
      [orders.n1],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].event_type).toBe("ORDER_COMPLETED");
    expect(Number(rows[0].commission_basis_amount_minor)).toBe(9000);
    expect(Number(rows[0].commission_amount_exact)).toBe(450); // 9000 * 500 / 10000 — exact, no float
    expect(rows[0].billing_period).toBe("2026-06");
    expect(rows[0].currency).toBe("NOK");

    const eur = await fixturePgQuery(`select currency, commission_amount_exact from public.commission_ledger where order_id = $1`, [orders.e1]);
    expect(eur.rows[0].currency).toBe("EUR"); // currency preserved per provider
    expect(Number(eur.rows[0].commission_amount_exact)).toBe(400); // 8000 * 5 %
  });

  it("proof: replay/idempotency — reposting delivered commission inserts 0 rows", async () => {
    const res = await admin.rpc("lp_billing_post_delivered_commission", { p_order_id: orders.n1 });
    expect(res.error).toBeNull();
    expect(Number(res.data)).toBe(0);
    const { rows } = await fixturePgQuery(`select count(*)::int as c from public.commission_ledger where order_id = $1`, [orders.n1]);
    expect(rows[0].c).toBe(1);
  });

  it("proof: correction — cancellation posts negative mirror in open period, idempotently", async () => {
    const res = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: orders.n3,
      p_event_type: "ORDER_CANCELLED",
      p_reason: "kansellert før periodeslutt",
      p_reference_id: null,
    });
    expect(res.error).toBeNull();
    expect(Number(res.data)).toBe(1);

    const replay = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: orders.n3,
      p_event_type: "ORDER_CANCELLED",
      p_reason: "kansellert før periodeslutt",
      p_reference_id: null,
    });
    expect(Number(replay.data)).toBe(0);

    const { rows } = await fixturePgQuery(
      `select commission_basis_amount_minor, commission_amount_exact, billing_period
       from public.commission_ledger where order_id = $1 and event_type = 'ORDER_CANCELLED'`,
      [orders.n3],
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].commission_basis_amount_minor)).toBe(-9000);
    expect(Number(rows[0].commission_amount_exact)).toBe(-450);
    expect(rows[0].billing_period).toBe("2026-06"); // original period still open
  });

  it("proof: close dry-run — read-only preview sums net ledger and reports can_close", async () => {
    const res = await admin.rpc("lp_billing_invoice_close_dry_run", {
      p_provider_id: provN,
      p_period_start: P_START,
      p_period_end: P_END,
      p_currency: "NOK",
    });
    expect(res.error).toBeNull();
    const dry = Array.isArray(res.data) ? res.data[0] : res.data;
    expect(Number(dry.ledger_rows_count)).toBe(4); // 3 completed + 1 cancellation
    expect(Number(dry.net_basis_amount_minor)).toBe(18000); // 9000*3 - 9000
    expect(Number(dry.rounded_commission_amount_minor)).toBe(900); // 5 % of 18000
    expect(dry.can_close).toBe(true);

    // Dry-run must not create anything.
    const { rows } = await fixturePgQuery(`select count(*)::int as c from public.commission_periods where provider_id = $1`, [provN]);
    expect(rows[0].c).toBe(0);
  });

  it("proof: close — explicit close creates invoiced period + invoice, idempotent on retry", async () => {
    const res = await admin.rpc("lp_billing_create_commission_invoice", {
      p_provider_id: provN,
      p_period_start: P_START,
      p_period_end: P_END,
      p_currency: "NOK",
      p_idempotency_key: null,
    });
    expect(res.error).toBeNull();
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    expect(row.invoice_status).toBe("invoiced");
    expect(Number(row.rounded_commission_amount_minor)).toBe(900);
    expect(row.created_new).toBe(true);
    invoiceN = String(row.provider_invoice_id);

    const retry = await admin.rpc("lp_billing_create_commission_invoice", {
      p_provider_id: provN,
      p_period_start: P_START,
      p_period_end: P_END,
      p_currency: "NOK",
      p_idempotency_key: null,
    });
    const retryRow = Array.isArray(retry.data) ? retry.data[0] : retry.data;
    expect(retryRow.created_new).toBe(false);
    expect(String(retryRow.provider_invoice_id)).toBe(invoiceN); // replay-safe
  });

  it("proof: invoice — issue assigns sequential platform number + due date, idempotently", async () => {
    const res = await admin.rpc("lp_commission_invoice_issue", { p_invoice_id: invoiceN, p_actor_user_id: null });
    expect(res.error).toBeNull();
    expect(res.data.ok).toBe(true);
    expect(String(res.data.invoice_number)).toMatch(/^LPK-\d{4}-\d{4}$/);

    const again = await admin.rpc("lp_commission_invoice_issue", { p_invoice_id: invoiceN, p_actor_user_id: null });
    expect(again.data.idempotent).toBe(true);

    const { rows } = await fixturePgQuery(
      `select invoice_number, due_date, payment_terms_days, payment_status from public.provider_commission_invoices where id = $1`,
      [invoiceN],
    );
    expect(rows[0].due_date).toBeTruthy();
    expect(Number(rows[0].payment_terms_days)).toBe(14);
    expect(rows[0].payment_status).toBe("pending");
  });

  it("proof: delivery — invoice email enqueued to provider billing email with delivery trail", async () => {
    const { deliverCommissionInvoice } = await import("@/lib/billing/commissionSettlement");
    const res = await deliverCommissionInvoice(invoiceN);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.recipients).toContain(`faktura-komm-n-${runId}@test.lunchportalen.no`);

    const { rows: outbox } = await fixturePgQuery(`select payload from public.outbox where event_key = $1`, [`commission.invoice.email:${invoiceN}`]);
    expect(outbox.length).toBe(1);
    expect(String(outbox[0].payload.to)).toContain(`faktura-komm-n-${runId}@test.lunchportalen.no`);

    const { rows: deliveries } = await fixturePgQuery(
      `select recipient_email, delivery_status from public.invoice_deliveries where invoice_id = $1`,
      [invoiceN],
    );
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.every((r) => r.delivery_status === "sent")).toBe(true);
  });

  it("proof: closed period immutable — late correction lands in current period, not the closed one", async () => {
    const res = await admin.rpc("lp_billing_post_negative_commission_for_order", {
      p_order_id: orders.n2,
      p_event_type: "ORDER_REFUNDED",
      p_reason: "refundert etter periodelukking",
      p_reference_id: `refund-${runId}`,
    });
    expect(res.error).toBeNull();
    expect(Number(res.data)).toBe(1);

    const { rows } = await fixturePgQuery(
      `select billing_period from public.commission_ledger where order_id = $1 and event_type = 'ORDER_REFUNDED'`,
      [orders.n2],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].billing_period).not.toBe("2026-06"); // NOT into the closed period
    const currentPeriod = new Date().toISOString().slice(0, 7);
    expect(rows[0].billing_period).toBe(currentPeriod); // goes to next/current period
  });

  it("proof: marked paid — manual bank payments: partial → partially_paid → paid, idempotent re-import", async () => {
    const partial = await admin.rpc("lp_commission_invoice_register_payment", {
      p_invoice_id: invoiceN,
      p_amount_minor: 400,
      p_paid_at: new Date().toISOString(),
      p_method: "BANK",
      p_reference: `KID-${runId}-1`,
      p_idempotency_key: `pay-${runId}-1`,
      p_actor_user_id: null,
    });
    expect(partial.error).toBeNull();
    expect(partial.data.payment_status).toBe("partially_paid");
    expect(Number(partial.data.amount_paid_minor)).toBe(400);

    // Idempotent re-import of the same bank line: no double counting.
    const replay = await admin.rpc("lp_commission_invoice_register_payment", {
      p_invoice_id: invoiceN,
      p_amount_minor: 400,
      p_paid_at: new Date().toISOString(),
      p_method: "BANK",
      p_reference: `KID-${runId}-1`,
      p_idempotency_key: `pay-${runId}-1`,
      p_actor_user_id: null,
    });
    expect(replay.data.idempotent).toBe(true);
    expect(Number(replay.data.amount_paid_minor)).toBe(400);

    const rest = await admin.rpc("lp_commission_invoice_register_payment", {
      p_invoice_id: invoiceN,
      p_amount_minor: 500,
      p_paid_at: new Date().toISOString(),
      p_method: "BANK",
      p_reference: `KID-${runId}-2`,
      p_idempotency_key: `pay-${runId}-2`,
      p_actor_user_id: null,
    });
    expect(rest.data.payment_status).toBe("paid");
    expect(Number(rest.data.amount_paid_minor)).toBe(900);

    const { rows } = await fixturePgQuery(`select payment_status, paid_at from public.provider_commission_invoices where id = $1`, [invoiceN]);
    expect(rows[0].payment_status).toBe("paid");
    expect(rows[0].paid_at).toBeTruthy();
  });

  it("proof: multi-currency — EUR provider closes and invoices in EUR", async () => {
    const res = await admin.rpc("lp_billing_create_commission_invoice", {
      p_provider_id: provE,
      p_period_start: P_START,
      p_period_end: P_END,
      p_currency: "EUR",
      p_idempotency_key: null,
    });
    expect(res.error).toBeNull();
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    expect(row.currency).toBe("EUR");
    expect(Number(row.rounded_commission_amount_minor)).toBe(400);
    invoiceE = String(row.provider_invoice_id);

    const issue = await admin.rpc("lp_commission_invoice_issue", { p_invoice_id: invoiceE, p_actor_user_id: null });
    expect(issue.error).toBeNull();
  });

  it("proof: overdue — pending invoice past due date is marked overdue by refresh", async () => {
    // Force past due (due_date is not an immutable invoice fact).
    await fixturePgQuery(`update public.provider_commission_invoices set due_date = current_date - 1 where id = $1`, [invoiceE]);
    const res = await admin.rpc("lp_commission_invoice_refresh_overdue", {});
    expect(res.error).toBeNull();
    expect(Number(res.data.marked_overdue)).toBeGreaterThanOrEqual(1);
    const { rows } = await fixturePgQuery(`select payment_status from public.provider_commission_invoices where id = $1`, [invoiceE]);
    expect(rows[0].payment_status).toBe("overdue");
  });

  it("proof: credit invoice — negative mirror with LPKN number; original marked credited", async () => {
    const res = await admin.rpc("lp_commission_invoice_create_credit", {
      p_invoice_id: invoiceE,
      p_reason: "feilfakturert testperiode",
      p_actor_user_id: null,
    });
    expect(res.error).toBeNull();
    expect(String(res.data.credit_number)).toMatch(/^LPKN-\d{4}-\d{4}$/);

    const { rows } = await fixturePgQuery(
      `select kind, payment_status, total_amount_minor, credit_of_invoice_id from public.provider_commission_invoices
       where id = $1 or credit_of_invoice_id = $1 order by kind`,
      [invoiceE],
    );
    const original = rows.find((r) => r.kind === "COMMISSION");
    const credit = rows.find((r) => r.kind === "CREDIT");
    expect(original.payment_status).toBe("credited");
    expect(Number(credit.total_amount_minor)).toBe(-400);
    expect(String(credit.credit_of_invoice_id)).toBe(invoiceE);
  });

  it("proof: no employee exposure — settlement RPCs are not executable by authenticated/anon", async () => {
    const { rows } = await fixturePgQuery(
      `select
         has_function_privilege('authenticated', 'public.lp_commission_invoice_issue(uuid, uuid)', 'EXECUTE') as a1,
         has_function_privilege('anon', 'public.lp_commission_invoice_issue(uuid, uuid)', 'EXECUTE') as a2,
         has_function_privilege('authenticated', 'public.lp_commission_invoice_register_payment(uuid, bigint, timestamptz, text, text, text, uuid)', 'EXECUTE') as a3,
         has_function_privilege('authenticated', 'public.lp_commission_invoice_create_credit(uuid, text, uuid)', 'EXECUTE') as a4,
         has_function_privilege('authenticated', 'public.lp_commission_invoice_refresh_overdue()', 'EXECUTE') as a5`,
    );
    expect(rows[0].a1).toBe(false);
    expect(rows[0].a2).toBe(false);
    expect(rows[0].a3).toBe(false);
    expect(rows[0].a4).toBe(false);
    expect(rows[0].a5).toBe(false);
  });

  it("audit — settlement actions leave billing_audit_log trail", async () => {
    const { rows } = await fixturePgQuery(
      `select action from public.billing_audit_log where organization_id = $1 order by created_at`,
      [provN],
    );
    const actions = rows.map((r) => String(r.action));
    expect(actions).toContain("provider_commission_invoice.final_created");
    expect(actions).toContain("provider_commission_invoice.issued");
    expect(actions).toContain("provider_commission_invoice.payment_registered");
    expect(actions).toContain("commission_ledger.negative_event_posted");
  });
});
