/**
 * TPT-A-4 — SaaS invoice RPC + outbox enqueue (integration, opt-in).
 */
import crypto from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";
import { authenticatedClient } from "@/tests/_helpers/supabaseTestClient";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

function periodStart(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function cleanupInvoice(providerId: string, invoicePeriod: string) {
  await fixturePgQuery(
    `DELETE FROM public.outbox WHERE event_key LIKE 'tripletex.saas_invoice_create_lp:%'
       AND payload->>'provider_id' = $1`,
    [providerId],
  );
  await fixturePgQuery(
    `DELETE FROM public.tripletex_exports WHERE unique_ref LIKE 'lp_saas:%'`,
  );
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log WHERE entity_type = 'provider_invoice' AND metadata->>'provider_id' = $1`,
    [providerId],
  );
  await fixturePgQuery(
    `DELETE FROM public.provider_invoices WHERE provider_id = $1 AND invoice_period = $2::date`,
    [providerId, invoicePeriod],
  );
}

async function setSubscription(
  providerId: string,
  status: "ACTIVE" | "PAUSED" | "CANCELLED",
  monthlyAmount = 1500,
) {
  const existing = await fixturePgQuery<{ id: string }>(
    `SELECT id FROM public.provider_subscriptions WHERE provider_id = $1 AND active_to IS NULL LIMIT 1`,
    [providerId],
  );

  if (existing.rows.length === 0) {
    await fixturePgQuery(
      `INSERT INTO public.provider_subscriptions (
         provider_id, plan, monthly_amount, billing_email, status
       ) VALUES ($1, 'SAAS_FIXED', $2, 'saas@test.lunchportalen.no', $3)`,
      [providerId, monthlyAmount, status],
    );
    return;
  }

  await fixturePgQuery(
    `UPDATE public.provider_subscriptions
        SET status = $2, monthly_amount = $3, active_to = NULL
      WHERE provider_id = $1 AND active_to IS NULL`,
    [providerId, status, monthlyAmount],
  );
}

describe.skipIf(!hasDb)("lp_saas_invoice_generation (TPT-A-4)", () => {
  let fx: ProviderTestFixtures;
  const invoicePeriod = periodStart();

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({
      includeEmployee: false,
      includeRegistrations: false,
      orderOwner: "employeeA",
      requireOrder: false,
    });
    await setSubscription(fx.providerA, "ACTIVE", 2000);
  }, 120_000);

  afterAll(async () => {
    await cleanupInvoice(fx?.providerA, invoicePeriod);
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 60_000);

  test("superadmin: generates DRAFT invoice, audit log, and outbox event", async () => {
    const sb = await authenticatedClient(fx.superadmin.accessToken);

    const { data, error } = await sb.rpc("lp_provider_generate_invoice_for_period", {
      p_provider_id: fx.providerA,
      p_invoice_period: invoicePeriod,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, idempotent: false });
    const invoiceId = String((data as Record<string, unknown>).invoice_id ?? "");
    expect(invoiceId).toBeTruthy();

    const inv = await fixturePgQuery<{ status: string; amount_net: string }>(
      `SELECT status, amount_net::text FROM public.provider_invoices WHERE id = $1`,
      [invoiceId],
    );
    expect(inv.rows[0]?.status).toBe("DRAFT");
    expect(Number(inv.rows[0]?.amount_net)).toBe(2000);

    const outbox = await fixturePgQuery<{ event_key: string }>(
      `SELECT event_key FROM public.outbox WHERE event_key = $1`,
      [`tripletex.saas_invoice_create_lp:${invoiceId}`],
    );
    expect(outbox.rows).toHaveLength(1);

    const audit = await fixturePgQuery<{ action: string }>(
      `SELECT action FROM public.lifecycle_audit_log
       WHERE entity_type = 'provider_invoice' AND entity_id = $1`,
      [invoiceId],
    );
    expect(audit.rows[0]?.action).toBe("provider_invoice_generated");
  });

  test("idempotency: re-run returns same invoice_id without duplicate rows", async () => {
    const sb = await authenticatedClient(fx.superadmin.accessToken);

    const first = await sb.rpc("lp_provider_generate_invoice_for_period", {
      p_provider_id: fx.providerA,
      p_invoice_period: invoicePeriod,
    });
    const invoiceId = String((first.data as Record<string, unknown>)?.invoice_id ?? "");

    const second = await sb.rpc("lp_provider_generate_invoice_for_period", {
      p_provider_id: fx.providerA,
      p_invoice_period: invoicePeriod,
    });

    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ ok: true, idempotent: true, invoice_id: invoiceId });

    const count = await fixturePgQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.provider_invoices
       WHERE provider_id = $1 AND invoice_period = $2::date`,
      [fx.providerA, invoicePeriod],
    );
    expect(count.rows[0]?.n).toBe("1");
  });

  test("edge: PAUSED subscription is not invoiced", async () => {
    const pausedProvider = crypto.randomUUID();
    const slug = `paused-${crypto.randomUUID().slice(0, 8)}`;
    const period = periodStart(new Date("2020-01-15"));

    await fixturePgQuery(
      `INSERT INTO public.providers (id, name, slug, contact_email, status, billing_model)
       VALUES ($1, $3, $2, 'p@test.lunchportalen.no', 'ACTIVE', 'SAAS_FIXED')`,
      [pausedProvider, slug, `Paused Prov ${slug}`],
    );
    await fixturePgQuery(
      `INSERT INTO public.provider_subscriptions (
         provider_id, plan, monthly_amount, billing_email, status
       ) VALUES ($1, 'SAAS_FIXED', 500, 'p@test.lunchportalen.no', 'PAUSED')`,
      [pausedProvider],
    );

    const sb = await authenticatedClient(fx.superadmin.accessToken);
    const { error } = await sb.rpc("lp_provider_generate_invoice_for_period", {
      p_provider_id: pausedProvider,
      p_invoice_period: period,
    });

    expect(error?.message).toContain("ACTIVE_SUBSCRIPTION_NOT_FOUND");

    await fixturePgQuery(`DELETE FROM public.provider_subscriptions WHERE provider_id = $1`, [pausedProvider]);
    await fixturePgQuery(`DELETE FROM public.providers WHERE id = $1`, [pausedProvider]);
  });

  test("outsider cannot generate invoice", async () => {
    const sb = await authenticatedClient(fx.outsider.accessToken);
    const { error } = await sb.rpc("lp_provider_generate_invoice_for_period", {
      p_provider_id: fx.providerA,
      p_invoice_period: invoicePeriod,
    });
    expect(error?.message).toMatch(/PERMISSION_DENIED|42501/i);
  });
});
