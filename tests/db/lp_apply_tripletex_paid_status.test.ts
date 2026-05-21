/**
 * TPT-B-6 — lp_apply_tripletex_paid_status (integration, opt-in).
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

async function getAgreementId(companyId: string): Promise<string> {
  const res = await fixturePgQuery<{ id: string }>(
    `SELECT id FROM public.agreements WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [companyId],
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error(`No ACTIVE agreement for company ${companyId}`);
  return id;
}

async function upsertAgreementInvoice(input: {
  agreementId: string;
  providerId: string;
  companyId: string;
  status: string;
  tripletexInvoiceId: string;
}): Promise<string> {
  const existing = await fixturePgQuery<{ id: string }>(
    `SELECT id FROM public.agreement_invoices
     WHERE agreement_id = $1 AND invoice_period_start = '2026-05-01'::date LIMIT 1`,
    [input.agreementId],
  );
  if (existing.rows[0]?.id) {
    await fixturePgQuery(
      `UPDATE public.agreement_invoices
          SET status = $2, tripletex_invoice_id = $3, paid_at = null, last_status_change = null
        WHERE id = $1`,
      [existing.rows[0].id, input.status, input.tripletexInvoiceId],
    );
    return existing.rows[0].id;
  }

  const id = crypto.randomUUID();
  await fixturePgQuery(
    `INSERT INTO public.agreement_invoices (
       id, agreement_id, provider_id, company_id,
       invoice_period_start, invoice_period_end, billing_cycle,
       amount_net, amount_tax, amount_total, status, tripletex_invoice_id
     ) VALUES (
       $1, $2, $3, $4,
       '2026-05-01'::date, '2026-05-31'::date, 'monthly',
       100, 15, 115, $5, $6
     )`,
    [id, input.agreementId, input.providerId, input.companyId, input.status, input.tripletexInvoiceId],
  );
  return id;
}

describe.skipIf(!hasDb)("lp_apply_tripletex_paid_status", () => {
  let fx: ProviderTestFixtures;
  let agreementId: string;
  let invoiceId: string;
  const ttId = `tt-${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures();
    agreementId = await getAgreementId(fx.companyA);
    invoiceId = await upsertAgreementInvoice({
      agreementId,
      providerId: fx.providerA,
      companyId: fx.companyA,
      status: "SENT",
      tripletexInvoiceId: ttId,
    });
  }, 180_000);

  afterAll(async () => {
    await fixturePgQuery(`DELETE FROM public.agreement_invoices WHERE id = $1`, [invoiceId]).catch(
      () => undefined,
    );
    await fx?.cleanup?.();
    await closeFixturePgPool();
  });

  test("SENT → PAID transition succeeds", async () => {
    await fixturePgQuery(
      `UPDATE public.agreement_invoices SET status = 'SENT', paid_at = null WHERE id = $1`,
      [invoiceId],
    );

    const sb = serviceRoleClient();
    const { data, error } = await sb.rpc("lp_apply_tripletex_paid_status", {
      p_provider_id: fx.providerA,
      p_tripletex_invoice_id: ttId,
    });
    expect(error).toBeNull();
    expect(data?.updated).toBe(true);
    expect(data?.previous_status).toBe("SENT");

    const row = await fixturePgQuery<{ status: string; paid_at: string | null }>(
      `SELECT status, paid_at FROM public.agreement_invoices WHERE id = $1`,
      [invoiceId],
    );
    expect(row.rows[0]?.status).toBe("PAID");
    expect(row.rows[0]?.paid_at).toBeTruthy();
  });

  test("DRAFT → PAID rejected", async () => {
    await fixturePgQuery(
      `UPDATE public.agreement_invoices SET status = 'DRAFT', paid_at = null WHERE id = $1`,
      [invoiceId],
    );

    const sb = serviceRoleClient();
    const { data, error } = await sb.rpc("lp_apply_tripletex_paid_status", {
      p_provider_id: fx.providerA,
      p_tripletex_invoice_id: ttId,
    });
    expect(error).toBeNull();
    expect(data?.updated).toBe(false);
    expect(data?.previous_status).toBe("DRAFT");
    expect(data?.reason).toBe("INVALID_TRANSITION");
  });

  test("PAID → PAID idempotent noop", async () => {
    await fixturePgQuery(
      `UPDATE public.agreement_invoices SET status = 'PAID', paid_at = now() WHERE id = $1`,
      [invoiceId],
    );

    const sb = serviceRoleClient();
    const { data, error } = await sb.rpc("lp_apply_tripletex_paid_status", {
      p_provider_id: fx.providerA,
      p_tripletex_invoice_id: ttId,
    });
    expect(error).toBeNull();
    expect(data?.updated).toBe(false);
    expect(data?.reason).toBe("ALREADY_PAID");
  });

  test("authorization: non-service_role → permission denied", async () => {
    const sb = authenticatedClient(fx.outsider.accessToken);
    const { error } = await sb.rpc("lp_apply_tripletex_paid_status", {
      p_provider_id: fx.providerA,
      p_tripletex_invoice_id: ttId,
    });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|42501|permission denied/i);
  });
});
