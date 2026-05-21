/**
 * TPT-B-3 — Agreement invoice generation RPC (integration, opt-in).
 */
import crypto from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient, serviceRoleClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodAroundToday(): { start: string; end: string } {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 5);
  return { start: isoDate(start), end: isoDate(end) };
}

async function ensureMenuDay(
  companyId: string,
  locationId: string,
  providerId: string,
  serviceDate: string,
): Promise<string | null> {
  const existing = await fixturePgQuery<{ id: string }>(
    `SELECT id FROM public.menu_service_days WHERE location_id = $1 AND service_date = $2::date LIMIT 1`,
    [locationId, serviceDate],
  );
  if (existing.rows[0]?.id) return null;

  const menuDayId = crypto.randomUUID();
  const cutoff = new Date(serviceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  await fixturePgQuery(
    `INSERT INTO public.menu_service_days (
       id, company_id, location_id, service_date, state, cutoff_at, provider_id, published_at
     ) VALUES ($1, $2, $3, $4::date, 'published'::public.menu_state, $5::timestamptz, $6::uuid, now())`,
    [menuDayId, companyId, locationId, serviceDate, cutoff.toISOString(), providerId],
  );
  return menuDayId;
}

async function getAgreementId(companyId: string): Promise<string> {
  const res = await fixturePgQuery<{ id: string }>(
    `SELECT id FROM public.agreements WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [companyId],
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`No ACTIVE agreement for company ${companyId}`);
  return id;
}

async function insertBillableOrder(input: {
  userId: string;
  companyId: string;
  locationId: string;
  providerId: string;
  agreementId: string;
  serviceDate: string;
  tier?: string;
  unitPriceNok?: number;
}): Promise<string> {
  const orderId = crypto.randomUUID();
  await fixturePgQuery(
    `INSERT INTO public.orders (
       id, user_id, date, company_id, location_id, provider_id, agreement_id,
       tier, unit_price_nok, status, slot,
       subtotal_cents_ex_vat, vat_cents, gross_cents_inc_vat
     ) VALUES (
       $1, $2, $3::date, $4, $5, $6, $7,
       $8::public.agreement_tier, $9, 'ACTIVE', 'default',
       $9 * 100, round($9 * 100 * 0.15), round($9 * 100 * 1.15)
     )`,
    [
      orderId,
      input.userId,
      input.serviceDate,
      input.companyId,
      input.locationId,
      input.providerId,
      input.agreementId,
      input.tier ?? "BASIS",
      input.unitPriceNok ?? 90,
    ],
  );
  return orderId;
}

async function cleanupAgreementInvoices(agreementId: string) {
  await fixturePgQuery(
    `DELETE FROM public.outbox
     WHERE event_key LIKE 'tripletex.agreement_invoice_create_provider:%'
       AND payload->>'agreement_id' = $1`,
    [agreementId],
  );
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log
     WHERE entity_type = 'agreement_invoice'
       AND metadata->>'agreement_id' = $1`,
    [agreementId],
  );
  await fixturePgQuery(
    `DELETE FROM public.agreement_invoice_lines
     WHERE invoice_id IN (SELECT id FROM public.agreement_invoices WHERE agreement_id = $1)`,
    [agreementId],
  );
  await fixturePgQuery(`DELETE FROM public.agreement_invoices WHERE agreement_id = $1`, [agreementId]);
}

describe.skipIf(!hasDb)("lp_provider_generate_agreement_invoice_for_period (TPT-B-3)", () => {
  let fx: ProviderTestFixtures;
  let agreementId: string;
  let period: { start: string; end: string };
  const orderIds: string[] = [];
  const menuDayIds: string[] = [];

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({
      includeEmployee: true,
      includeRegistrations: false,
      requireOrder: false,
    });
    agreementId = await getAgreementId(fx.companyA);
    period = periodAroundToday();
  }, 180_000);

  afterAll(async () => {
    if (agreementId) await cleanupAgreementInvoices(agreementId);
    if (orderIds.length) {
      await fixturePgQuery(`DELETE FROM public.orders WHERE id = ANY($1::uuid[])`, [orderIds]);
    }
    if (menuDayIds.length) {
      await fixturePgQuery(`DELETE FROM public.menu_service_days WHERE id = ANY($1::uuid[])`, [menuDayIds]);
    }
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 60_000);

  test("positive: 5 deliveries → 1 invoice, aggregated line qty 5, outbox + audit", async () => {
    await cleanupAgreementInvoices(agreementId);

    for (let i = 0; i < 5; i += 1) {
      const d = new Date(period.start);
      d.setUTCDate(d.getUTCDate() + i);
      const serviceDate = isoDate(d);
      const menuDayId = await ensureMenuDay(fx.companyA, fx.locA, fx.providerA, serviceDate);
      if (menuDayId) menuDayIds.push(menuDayId);
      const id = await insertBillableOrder({
        userId: fx.employeeA.user_id,
        companyId: fx.companyA,
        locationId: fx.locA,
        providerId: fx.providerA,
        agreementId,
        serviceDate,
        tier: "BASIS",
        unitPriceNok: 90,
      });
      orderIds.push(id);
    }

    const sb = await authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, idempotent: false });
    const invoiceId = String((data as Record<string, unknown>).invoice_id ?? "");
    expect(invoiceId).toBeTruthy();

    const inv = await fixturePgQuery<{ amount_net: string; amount_tax: string; status: string }>(
      `SELECT amount_net::text, amount_tax::text, status FROM public.agreement_invoices WHERE id = $1`,
      [invoiceId],
    );
    expect(inv.rows[0]?.status).toBe("DRAFT");
    expect(Number(inv.rows[0]?.amount_net)).toBe(450);
    expect(Number(inv.rows[0]?.amount_tax)).toBeCloseTo(67.5, 1);

    const lines = await fixturePgQuery<{ quantity: number; product_key: string }>(
      `SELECT quantity, product_key FROM public.agreement_invoice_lines WHERE invoice_id = $1`,
      [invoiceId],
    );
    expect(lines.rows).toHaveLength(1);
    expect(lines.rows[0]?.quantity).toBe(5);
    expect(lines.rows[0]?.product_key).toBe("BASIS");

    const outbox = await fixturePgQuery<{ event_key: string }>(
      `SELECT event_key FROM public.outbox WHERE event_key = $1`,
      [`tripletex.agreement_invoice_create_provider:${invoiceId}`],
    );
    expect(outbox.rows).toHaveLength(1);

    const audit = await fixturePgQuery<{ action: string }>(
      `SELECT action FROM public.lifecycle_audit_log
       WHERE entity_type = 'agreement_invoice' AND entity_id = $1`,
      [invoiceId],
    );
    expect(audit.rows[0]?.action).toBe("agreement_invoice_generated");
  });

  test("idempotency: re-run returns same invoice_id, no duplicate rows", async () => {
    const sb = await authenticatedClient(fx.superadmin.accessToken);

    const first = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    const invoiceId = String((first.data as Record<string, unknown>)?.invoice_id ?? "");

    const second = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });

    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ ok: true, idempotent: true, invoice_id: invoiceId });

    const count = await fixturePgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.agreement_invoices WHERE agreement_id = $1 AND invoice_period_start = $2::date`,
      [agreementId, period.start],
    );
    expect(count.rows[0]?.n).toBe("1");
  });

  test("edge: PAUSED agreement is skipped", async () => {
    const pausedCompany = crypto.randomUUID();
    const pausedLoc = crypto.randomUUID();
    const pausedPeriod = { start: "2020-06-01", end: "2020-06-30" };

    await fixturePgQuery(
      `INSERT INTO public.companies (id, name, status, orgnr, provider_id)
       VALUES ($1, 'Paused Co', 'ACTIVE', $2, $3)`,
      [pausedCompany, String(900000000 + Math.floor(Math.random() * 99999)), fx.providerA],
    );
    await fixturePgQuery(
      `INSERT INTO public.company_locations (id, company_id, name) VALUES ($1, $2, 'Loc')`,
      [pausedLoc, pausedCompany],
    );
    await fixturePgQuery(
      `INSERT INTO public.agreements (
         company_id, location_id, provider_id, tier, status,
         delivery_days, slot_start, slot_end, starts_at
       ) VALUES ($1, $2, $3, 'BASIS', 'PAUSED', '["mon"]'::jsonb, '11:00', '13:00', '2020-01-01')`,
      [pausedCompany, pausedLoc, fx.providerA],
    );
    const pausedAgreementRes = await fixturePgQuery<{ id: string }>(
      `SELECT id FROM public.agreements WHERE company_id = $1 LIMIT 1`,
      [pausedCompany],
    );
    const pausedAgreement = pausedAgreementRes.rows[0]?.id ?? "";
    expect(pausedAgreement).toBeTruthy();

    const sb = await authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: pausedAgreement,
      p_period_start: pausedPeriod.start,
      p_period_end: pausedPeriod.end,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, skipped: true, reason: "AGREEMENT_NOT_ACTIVE" });

    await fixturePgQuery(`DELETE FROM public.agreements WHERE company_id = $1`, [pausedCompany]);
    await fixturePgQuery(`DELETE FROM public.company_locations WHERE id = $1`, [pausedLoc]);
    await fixturePgQuery(`DELETE FROM public.companies WHERE id = $1`, [pausedCompany]);
  });

  test("edge: zero orders in period → skipped ZERO_ORDERS", async () => {
    const emptyCompany = crypto.randomUUID();
    const emptyLoc = crypto.randomUUID();
    const emptyPeriod = { start: "2019-01-01", end: "2019-01-31" };

    await fixturePgQuery(
      `INSERT INTO public.companies (id, name, status, orgnr, provider_id)
       VALUES ($1, 'Empty Co', 'ACTIVE', $2, $3)`,
      [emptyCompany, String(910000000 + Math.floor(Math.random() * 99999)), fx.providerA],
    );
    await fixturePgQuery(
      `INSERT INTO public.company_locations (id, company_id, name) VALUES ($1, $2, 'Loc')`,
      [emptyLoc, emptyCompany],
    );
    await fixturePgQuery(
      `INSERT INTO public.agreements (
         company_id, location_id, provider_id, tier, status,
         delivery_days, slot_start, slot_end, starts_at
       ) VALUES ($1, $2, $3, 'BASIS', 'ACTIVE', '["mon"]'::jsonb, '11:00', '13:00', '2018-01-01')`,
      [emptyCompany, emptyLoc, fx.providerA],
    );
    const emptyAgreement = await getAgreementId(emptyCompany);

    const sb = await authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: emptyAgreement,
      p_period_start: emptyPeriod.start,
      p_period_end: emptyPeriod.end,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, skipped: true, reason: "ZERO_ORDERS" });

    await fixturePgQuery(`DELETE FROM public.agreements WHERE company_id = $1`, [emptyCompany]);
    await fixturePgQuery(`DELETE FROM public.company_locations WHERE id = $1`, [emptyLoc]);
    await fixturePgQuery(`DELETE FROM public.companies WHERE id = $1`, [emptyCompany]);
  });

  test("authorization: provider_admin same provider → success", async () => {
    const sb = await authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    expect(error).toBeNull();
  });

  test("authorization: provider_admin other provider → denied", async () => {
    const sb = await authenticatedClient(fx.providerAdminB.accessToken);
    const { error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    expect(error?.message).toMatch(/PERMISSION_DENIED|42501/i);
  });

  test("authorization: outsider → denied", async () => {
    const sb = await authenticatedClient(fx.outsider.accessToken);
    const { error } = await sb.rpc("lp_provider_generate_agreement_invoice_for_period", {
      p_agreement_id: agreementId,
      p_period_start: period.start,
      p_period_end: period.end,
    });
    expect(error?.message).toMatch(/PERMISSION_DENIED|42501/i);
  });

  test("bulk RPC: generates for active agreements, skips paused", async () => {
    const sb = serviceRoleClient();
    const bulkPeriod = periodAroundToday();

    const { data, error } = await sb.rpc("lp_generate_agreement_invoices_for_period", {
      p_period_start: bulkPeriod.start,
      p_period_end: bulkPeriod.end,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true });
    expect(Number((data as Record<string, unknown>).generated ?? 0)).toBeGreaterThanOrEqual(0);
    expect(Number((data as Record<string, unknown>).skipped ?? 0)).toBeGreaterThanOrEqual(0);

    const rerun = await sb.rpc("lp_generate_agreement_invoices_for_period", {
      p_period_start: bulkPeriod.start,
      p_period_end: bulkPeriod.end,
    });
    expect(rerun.error).toBeNull();
    expect(Number((rerun.data as Record<string, unknown>).generated ?? 0)).toBe(0);
  });
});
