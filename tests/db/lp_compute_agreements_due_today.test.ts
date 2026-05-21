/**
 * TPT-B-5 — lp_compute_agreements_due_today (integration, opt-in).
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

type DueRow = {
  agreement_id: string;
  provider_id: string;
  company_id: string;
  billing_cycle: string;
  period_start: string;
  period_end: string;
};

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
    status?: string;
  },
) {
  const sets: string[] = [];
  const params: unknown[] = [agreementId];
  let idx = 2;

  if (input.billing_cycle !== undefined) {
    sets.push(`billing_cycle = $${idx}`);
    params.push(input.billing_cycle);
    idx++;
  }
  if (input.billing_anchor_date !== undefined) {
    sets.push(`billing_anchor_date = $${idx}::date`);
    params.push(input.billing_anchor_date);
    idx++;
  }
  if (input.last_invoiced_at !== undefined) {
    if (input.last_invoiced_at === null) {
      sets.push(`last_invoiced_at = null`);
    } else {
      sets.push(`last_invoiced_at = $${idx}::timestamptz`);
      params.push(input.last_invoiced_at);
      idx++;
    }
  }
  if (input.status !== undefined) {
    sets.push(`status = $${idx}::public.agreement_status`);
    params.push(input.status);
    idx++;
  }

  if (sets.length === 0) return;

  await fixturePgQuery(
    `UPDATE public.agreements SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
    params,
  );
}

async function computeDue(today: string): Promise<DueRow[]> {
  const sb = serviceRoleClient();
  const { data, error } = await sb.rpc("lp_compute_agreements_due_today", { p_today: today });
  if (error) throw new Error(error.message);
  return (data ?? []) as DueRow[];
}

describe.skipIf(!hasDb)("lp_compute_agreements_due_today", () => {
  let fx: ProviderTestFixtures;
  let agreementId: string;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures();
    agreementId = await getAgreementId(fx.companyA);
    await setAgreementBilling(agreementId, {
      billing_cycle: "monthly",
      billing_anchor_date: "2020-01-15",
      last_invoiced_at: null,
      status: "ACTIVE",
    });
  }, 120_000);

  afterAll(async () => {
    await fx?.cleanup?.();
    await closeFixturePgPool();
  });

  test("monthly anchor=15, today=15 → previous month period", async () => {
    const rows = await computeDue("2026-03-15");
    const hit = rows.find((r) => r.agreement_id === agreementId);
    expect(hit).toBeTruthy();
    expect(hit!.period_start).toBe("2026-02-01");
    expect(hit!.period_end).toBe("2026-02-28");
    expect(hit!.billing_cycle).toBe("monthly");
  });

  test("monthly anchor=15, today=16 with last_invoiced_at today → skipped", async () => {
    await setAgreementBilling(agreementId, {
      last_invoiced_at: "2026-03-16T08:00:00+01:00",
    });
    const rows = await computeDue("2026-03-16");
    expect(rows.find((r) => r.agreement_id === agreementId)).toBeUndefined();
    await setAgreementBilling(agreementId, { last_invoiced_at: null });
  });

  test("monthly anchor=31, today=28 feb → due on last day of month", async () => {
    await setAgreementBilling(agreementId, {
      billing_cycle: "monthly",
      billing_anchor_date: "2020-01-31",
      last_invoiced_at: null,
    });
    const rows = await computeDue("2026-02-28");
    const hit = rows.find((r) => r.agreement_id === agreementId);
    expect(hit).toBeTruthy();
    expect(hit!.period_start).toBe("2026-01-01");
    expect(hit!.period_end).toBe("2026-01-31");
  });

  test("biweekly anchor=2026-01-01, today=2026-01-15 → period [01-01, 01-14]", async () => {
    await setAgreementBilling(agreementId, {
      billing_cycle: "biweekly",
      billing_anchor_date: "2026-01-01",
      last_invoiced_at: null,
    });
    const rows = await computeDue("2026-01-15");
    const hit = rows.find((r) => r.agreement_id === agreementId);
    expect(hit).toBeTruthy();
    expect(hit!.period_start).toBe("2026-01-01");
    expect(hit!.period_end).toBe("2026-01-14");
  });

  test("biweekly anchor=2026-01-01, today=2026-01-16 → not due", async () => {
    const rows = await computeDue("2026-01-16");
    expect(rows.find((r) => r.agreement_id === agreementId)).toBeUndefined();
  });

  test("paused agreement → skipped", async () => {
    await setAgreementBilling(agreementId, {
      billing_cycle: "monthly",
      billing_anchor_date: "2020-03-15",
      status: "PAUSED",
      last_invoiced_at: null,
    });
    const rows = await computeDue("2026-03-15");
    expect(rows.find((r) => r.agreement_id === agreementId)).toBeUndefined();
    await setAgreementBilling(agreementId, { status: "ACTIVE" });
  });

  test("suspended provider → agreements skipped", async () => {
    await setAgreementBilling(agreementId, {
      billing_cycle: "monthly",
      billing_anchor_date: "2020-04-15",
      last_invoiced_at: null,
      status: "ACTIVE",
    });
    await fixturePgQuery(
      `UPDATE public.providers SET suspended_at = now() WHERE id = $1`,
      [fx.providerA],
    );
    const rows = await computeDue("2026-04-15");
    expect(rows.find((r) => r.agreement_id === agreementId)).toBeUndefined();
    await fixturePgQuery(
      `UPDATE public.providers SET suspended_at = null WHERE id = $1`,
      [fx.providerA],
    );
  });

  test("non-service_role → permission denied", async () => {
    const token = fx.outsider.accessToken;
    const sb = authenticatedClient(token);
    const { error } = await sb.rpc("lp_compute_agreements_due_today", { p_today: "2026-03-15" });
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED|42501|permission denied/i);
  });
});
