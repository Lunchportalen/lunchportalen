/**
 * TPT-B-5 — lp_run_daily_agreement_billing (integration, opt-in).
 */
import crypto from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { osloTodayISODate } from "@/lib/date/oslo";
import { closeFixturePgPool, fixturePgQuery, getFixturePgPool } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient, serviceRoleClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function previousMonthPeriod(today: string): { start: string; end: string; orderDate: string } {
  const [y, m] = today.split("-").map(Number);
  let prevY = y;
  let prevM = m - 1;
  if (prevM <= 0) {
    prevM = 12;
    prevY -= 1;
  }
  const start = `${String(prevY).padStart(4, "0")}-${String(prevM).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const end = `${String(prevY).padStart(4, "0")}-${String(prevM).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  const orderDay = Math.min(15, endDay);
  const orderDate = `${String(prevY).padStart(4, "0")}-${String(prevM).padStart(2, "0")}-${String(orderDay).padStart(2, "0")}`;
  return { start, end, orderDate };
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

async function setAgreementBilling(
  agreementId: string,
  input: {
    billing_cycle?: string;
    billing_anchor_date?: string;
    last_invoiced_at?: string | null;
  },
) {
  await fixturePgQuery(
    `UPDATE public.agreements
        SET billing_cycle = coalesce($2, billing_cycle),
            billing_anchor_date = coalesce($3::date, billing_anchor_date),
            last_invoiced_at = $4,
            updated_at = now()
      WHERE id = $1`,
    [agreementId, input.billing_cycle ?? null, input.billing_anchor_date ?? null, input.last_invoiced_at ?? null],
  );
}

async function insertBillableOrder(input: {
  userId: string;
  companyId: string;
  locationId: string;
  providerId: string;
  agreementId: string;
  serviceDate: string;
}): Promise<string> {
  const orderId = crypto.randomUUID();
  const client = await getFixturePgPool().connect();
  try {
    await client.query(`SET session_replication_role = replica`);
    await client.query(
      `INSERT INTO public.orders (
         id, user_id, date, company_id, location_id, provider_id, agreement_id,
         tier, unit_price_nok, status, slot,
         subtotal_cents_ex_vat, vat_cents, gross_cents_inc_vat
       ) VALUES (
         $1, $2, $3::date, $4, $5, $6, $7,
         'BASIS'::public.agreement_tier, 90, 'ACTIVE', 'default',
         9000, 1350, 10350
       )`,
      [
        orderId,
        input.userId,
        input.serviceDate,
        input.companyId,
        input.locationId,
        input.providerId,
        input.agreementId,
      ],
    );
    await client.query(`SET session_replication_role = DEFAULT`);
  } finally {
    client.release();
  }
  return orderId;
}

async function cleanupRun(agreementId: string, today: string) {
  await fixturePgQuery(
    `DELETE FROM public.outbox
     WHERE event_key LIKE 'tripletex.agreement_invoice_create_provider:%'
       AND payload->>'agreement_id' = $1`,
    [agreementId],
  );
  await fixturePgQuery(
    `DELETE FROM public.agreement_invoice_lines
     WHERE invoice_id IN (SELECT id FROM public.agreement_invoices WHERE agreement_id = $1)`,
    [agreementId],
  );
  await fixturePgQuery(`DELETE FROM public.agreement_invoices WHERE agreement_id = $1`, [agreementId]);
  await fixturePgQuery(
    `UPDATE public.agreements SET last_invoiced_at = null WHERE id = $1`,
    [agreementId],
  );
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log
     WHERE entity_type = 'agreement_billing_cron' AND metadata->>'today' = $1`,
    [today],
  );
}

async function runDaily(today: string, rid?: string) {
  const sb = serviceRoleClient();
  return sb.rpc("lp_run_daily_agreement_billing", {
    p_today: today,
    p_request_rid: rid ?? `test-run:${today}:${crypto.randomUUID().slice(0, 8)}`,
  });
}

describe.skipIf(!hasDb)("lp_run_daily_agreement_billing", () => {
  let fx: ProviderTestFixtures;
  let agreementId: string;
  let billableOrderId: string | null = null;
  let runToday: string;
  let periodStart: string;
  let orderDate: string;

  beforeAll(async () => {
    runToday = osloTodayISODate();
    const period = previousMonthPeriod(runToday);
    periodStart = period.start;
    orderDate = period.orderDate;

    fx = await buildProviderTestFixtures({ includeEmployee: true });
    agreementId = await getAgreementId(fx.companyA);

    const anchorDay = runToday.slice(8, 10);
    await setAgreementBilling(agreementId, {
      billing_cycle: "monthly",
      billing_anchor_date: `2020-01-${anchorDay}`,
      last_invoiced_at: null,
    });
    await fixturePgQuery(
      `UPDATE public.agreements SET starts_at = '2020-01-01'::timestamptz WHERE id = $1`,
      [agreementId],
    );

    await cleanupRun(agreementId, runToday);

    billableOrderId = await insertBillableOrder({
      userId: fx.employeeA!.user_id,
      companyId: fx.companyA,
      locationId: fx.locA,
      providerId: fx.providerA,
      agreementId,
      serviceDate: orderDate,
    });
  }, 180_000);

  afterAll(async () => {
    if (billableOrderId) {
      await fixturePgQuery(`DELETE FROM public.orders WHERE id = $1`, [billableOrderId]).catch(() => undefined);
    }
    if (agreementId) {
      await cleanupRun(agreementId, runToday);
    }
    await fx?.cleanup?.();
    await closeFixturePgPool();
  });

  test("happy path: due agreement generates invoice + audit", async () => {
    await cleanupRun(agreementId, runToday);

    const { data, error } = await runDaily(runToday);
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(Number(data?.generated_count)).toBeGreaterThanOrEqual(1);

    const inv = await fixturePgQuery(
      `SELECT id FROM public.agreement_invoices WHERE agreement_id = $1 AND invoice_period_start = $2::date`,
      [agreementId, periodStart],
    );
    expect(inv.rows.length).toBe(1);

    const audit = await fixturePgQuery(
      `SELECT 1 FROM public.lifecycle_audit_log
       WHERE entity_type = 'agreement_billing_cron' AND metadata->>'today' = $1 LIMIT 1`,
      [runToday],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });

  test("idempotency: second run same day → no duplicate invoice", async () => {
    await cleanupRun(agreementId, runToday);

    const first = await runDaily(runToday);
    expect(first.error).toBeNull();
    expect(Number(first.data?.generated_count)).toBeGreaterThanOrEqual(1);

    const second = await runDaily(runToday);
    expect(second.error).toBeNull();
    expect(Number(second.data?.generated_count)).toBe(0);

    const inv = await fixturePgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.agreement_invoices
       WHERE agreement_id = $1 AND invoice_period_start = $2::date`,
      [agreementId, periodStart],
    );
    expect(Number(inv.rows[0]?.n)).toBe(1);
  });

  test("zero orders in period → skipped without blocking run", async () => {
    await cleanupRun(agreementId, runToday);
    await fixturePgQuery(`DELETE FROM public.orders WHERE agreement_id = $1`, [agreementId]);

    const { data, error } = await runDaily(runToday);
    expect(error).toBeNull();
    expect(Number(data?.generated_count)).toBe(0);
    expect(Number(data?.skipped_count)).toBeGreaterThanOrEqual(1);

    billableOrderId = await insertBillableOrder({
      userId: fx.employeeA!.user_id,
      companyId: fx.companyA,
      locationId: fx.locA,
      providerId: fx.providerA,
      agreementId,
      serviceDate: orderDate,
    });
  });

  test("authorization: non-service_role → permission denied", async () => {
    const sb = authenticatedClient(fx.outsider.accessToken);
    const { error } = await sb.rpc("lp_run_daily_agreement_billing", { p_today: runToday });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|42501|permission denied/i);
  });
});
