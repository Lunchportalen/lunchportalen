/**
 * TPT-B-5b — Agreement lifecycle hook (DB trigger → outbox enqueue).
 */
import crypto from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { closeFixturePgPool, fixturePgQuery } from "@/tests/_helpers/fixturePg";
import {
  buildProviderTestFixtures,
  type ProviderTestFixtures,
} from "@/tests/_helpers/providerTestFixtures";
import { hasRemoteSupabaseIntegrationEnv } from "@/tests/_helpers/remoteSupabaseIntegration";

const hasDb = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

const CUSTOMER_KEY = (companyId: string, providerId: string) =>
  `tripletex.company_customer_create_provider:${companyId}:${providerId}`;

const PRODUCT_KEY = (providerId: string, tier: string) =>
  `tripletex.provider_product_sync:${providerId}:${tier}`;

function deliveryDaysJson(): string {
  return JSON.stringify(["mon", "tue", "wed", "thu", "fri"]);
}

async function insertAgreement(input: {
  status: string;
  tier?: string;
  companyId: string;
  locationId: string;
  providerId: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() - 7);
  await fixturePgQuery(
    `INSERT INTO public.agreements (
       id, company_id, location_id, provider_id, tier, status,
       delivery_days, slot_start, slot_end, starts_at
     ) VALUES (
       $1, $2, $3, $4::uuid, $5::public.agreement_tier, $6::public.agreement_status,
       $7::jsonb, '11:00', '13:00', $8::timestamptz
     )`,
    [
      id,
      input.companyId,
      input.locationId,
      input.providerId,
      input.tier ?? "BASIS",
      input.status,
      deliveryDaysJson(),
      startsAt.toISOString(),
    ],
  );
  return id;
}

async function updateAgreementStatus(agreementId: string, status: string): Promise<void> {
  await fixturePgQuery(
    `UPDATE public.agreements SET status = $2::public.agreement_status, updated_at = now() WHERE id = $1`,
    [agreementId, status],
  );
}

async function updateAgreementTier(agreementId: string, tier: string): Promise<void> {
  await fixturePgQuery(
    `UPDATE public.agreements SET tier = $2::public.agreement_tier, updated_at = now() WHERE id = $1`,
    [agreementId, tier],
  );
}

async function countOutbox(eventKey: string): Promise<number> {
  const res = await fixturePgQuery<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.outbox WHERE event_key = $1`,
    [eventKey],
  );
  return Number(res.rows[0]?.c ?? 0);
}

async function countPendingOutbox(eventKey: string): Promise<number> {
  const res = await fixturePgQuery<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.outbox WHERE event_key = $1 AND status = 'PENDING'`,
    [eventKey],
  );
  return Number(res.rows[0]?.c ?? 0);
}

async function countHookAudit(agreementId: string, hook?: string): Promise<number> {
  const res = hook
    ? await fixturePgQuery<{ c: string }>(
        `SELECT count(*)::text AS c
         FROM public.lifecycle_audit_log
         WHERE entity_id = $1
           AND action = 'agreement_lifecycle_hook_fired'
           AND metadata->>'hook' = $2`,
        [agreementId, hook],
      )
    : await fixturePgQuery<{ c: string }>(
        `SELECT count(*)::text AS c
         FROM public.lifecycle_audit_log
         WHERE entity_id = $1
           AND action = 'agreement_lifecycle_hook_fired'`,
        [agreementId],
      );
  return Number(res.rows[0]?.c ?? 0);
}

async function deleteAgreement(agreementId: string): Promise<void> {
  await fixturePgQuery(`DELETE FROM public.lifecycle_audit_log WHERE entity_id = $1`, [agreementId]);
  await fixturePgQuery(`DELETE FROM public.agreements WHERE id = $1`, [agreementId]);
}

async function deleteOutboxKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await fixturePgQuery(`DELETE FROM public.outbox WHERE event_key = ANY($1::text[])`, [keys]);
}

let pfx: ProviderTestFixtures;
const agreementIds: string[] = [];
const outboxKeys: string[] = [];

async function clearCompanyAgreements(companyId: string): Promise<void> {
  await fixturePgQuery(`DELETE FROM public.orders WHERE company_id = $1`, [companyId]);
  await fixturePgQuery(`DELETE FROM public.menu_service_days WHERE company_id = $1`, [companyId]);
  await fixturePgQuery(`DELETE FROM public.agreements WHERE company_id = $1`, [companyId]);
}

describe.skipIf(!hasDb)("lp_agreement_lifecycle_hook (TPT-B-5b)", () => {
  beforeAll(async () => {
    pfx = await buildProviderTestFixtures({ includeRegistrations: false });
    await clearCompanyAgreements(pfx.companyA);
    await clearCompanyAgreements(pfx.companyB);
  }, 180_000);

  afterAll(async () => {
    for (const id of agreementIds) {
      await deleteAgreement(id);
    }
    await deleteOutboxKeys([...new Set(outboxKeys)]);
    if (pfx?.cleanup) await pfx.cleanup();
    await closeFixturePgPool();
  }, 180_000);

  test("INSERT status ACTIVE → customer outbox event", async () => {
    await clearCompanyAgreements(pfx.companyA);
    const id = await insertAgreement({
      status: "ACTIVE",
      companyId: pfx.companyA,
      locationId: pfx.locA,
      providerId: pfx.providerA,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyA, pfx.providerA);
    outboxKeys.push(key);
    expect(await countOutbox(key)).toBeGreaterThanOrEqual(1);
    expect(await countHookAudit(id, "status_active")).toBeGreaterThanOrEqual(1);
  });

  test("INSERT status PENDING → no customer outbox event", async () => {
    await clearCompanyAgreements(pfx.companyB);
    const id = await insertAgreement({
      status: "PENDING",
      companyId: pfx.companyB,
      locationId: pfx.locB,
      providerId: pfx.providerB,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyB, pfx.providerB);
    expect(await countOutbox(key)).toBe(0);
  });

  test("UPDATE PENDING → ACTIVE → customer outbox event", async () => {
    await clearCompanyAgreements(pfx.companyA);
    const id = await insertAgreement({
      status: "PENDING",
      companyId: pfx.companyA,
      locationId: pfx.locA,
      providerId: pfx.providerA,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyA, pfx.providerA);
    outboxKeys.push(key);
    await updateAgreementStatus(id, "ACTIVE");
    expect(await countOutbox(key)).toBeGreaterThanOrEqual(1);
    expect(await countHookAudit(id, "status_active")).toBeGreaterThanOrEqual(1);
  });

  test("UPDATE ACTIVE → PAUSED → no new customer hook audit", async () => {
    await clearCompanyAgreements(pfx.companyB);
    const id = await insertAgreement({
      status: "ACTIVE",
      companyId: pfx.companyB,
      locationId: pfx.locB,
      providerId: pfx.providerB,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyB, pfx.providerB);
    outboxKeys.push(key);
    const auditsBefore = await countHookAudit(id, "status_active");
    await updateAgreementStatus(id, "PAUSED");
    expect(await countHookAudit(id, "status_active")).toBe(auditsBefore);
    expect(await countPendingOutbox(key)).toBeLessThanOrEqual(1);
  });

  test("UPDATE PAUSED → ACTIVE → customer hook re-fired (audit)", async () => {
    await clearCompanyAgreements(pfx.companyB);
    const id = await insertAgreement({
      status: "PAUSED",
      companyId: pfx.companyB,
      locationId: pfx.locB,
      providerId: pfx.providerB,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyB, pfx.providerB);
    outboxKeys.push(key);
    await updateAgreementStatus(id, "ACTIVE");
    expect(await countHookAudit(id, "status_active")).toBeGreaterThanOrEqual(1);
    expect(await countOutbox(key)).toBeGreaterThanOrEqual(1);
  });

  test("UPDATE tier → product-sync outbox event", async () => {
    await clearCompanyAgreements(pfx.companyA);
    const id = await insertAgreement({
      status: "ACTIVE",
      tier: "BASIS",
      companyId: pfx.companyA,
      locationId: pfx.locA,
      providerId: pfx.providerA,
    });
    agreementIds.push(id);
    const luxusKey = PRODUCT_KEY(pfx.providerA, "LUXUS");
    outboxKeys.push(luxusKey);
    await updateAgreementTier(id, "LUXUS");
    expect(await countOutbox(luxusKey)).toBe(1);
    expect(await countHookAudit(id, "tier_change")).toBeGreaterThanOrEqual(1);
  });

  test("UPDATE tier only → no additional customer event key", async () => {
    await clearCompanyAgreements(pfx.companyA);
    const id = await insertAgreement({
      status: "ACTIVE",
      tier: "BASIS",
      companyId: pfx.companyA,
      locationId: pfx.locA,
      providerId: pfx.providerA,
    });
    agreementIds.push(id);
    const customerKey = CUSTOMER_KEY(pfx.companyA, pfx.providerA);
    const customerBefore = await countOutbox(customerKey);
    await updateAgreementTier(id, "ENTERPRISE");
    const enterpriseKey = PRODUCT_KEY(pfx.providerA, "ENTERPRISE");
    outboxKeys.push(enterpriseKey);
    expect(await countOutbox(enterpriseKey)).toBe(1);
    expect(await countOutbox(customerKey)).toBe(customerBefore);
  });

  test("idempotency: repeated ACTIVE update → at most one PENDING customer event", async () => {
    await clearCompanyAgreements(pfx.companyA);
    const id = await insertAgreement({
      status: "PAUSED",
      companyId: pfx.companyA,
      locationId: pfx.locA,
      providerId: pfx.providerA,
    });
    agreementIds.push(id);
    const key = CUSTOMER_KEY(pfx.companyA, pfx.providerA);
    outboxKeys.push(key);
    await updateAgreementStatus(id, "ACTIVE");
    await updateAgreementStatus(id, "ACTIVE");
    expect(await countPendingOutbox(key)).toBeLessThanOrEqual(1);
    expect(await countOutbox(key)).toBeGreaterThanOrEqual(1);
  });

  test("tier to-and-fro → distinct product keys, no duplicate PENDING per tier", async () => {
    await clearCompanyAgreements(pfx.companyB);
    const id = await insertAgreement({
      status: "ACTIVE",
      tier: "BASIS",
      companyId: pfx.companyB,
      locationId: pfx.locB,
      providerId: pfx.providerB,
    });
    agreementIds.push(id);
    const basisKey = PRODUCT_KEY(pfx.providerB, "BASIS");
    const luxusKey = PRODUCT_KEY(pfx.providerB, "LUXUS");
    outboxKeys.push(basisKey, luxusKey);

    await updateAgreementTier(id, "LUXUS");
    expect(await countOutbox(luxusKey)).toBe(1);

    await updateAgreementTier(id, "BASIS");
    expect(await countOutbox(basisKey)).toBe(1);
    expect(await countPendingOutbox(luxusKey)).toBeLessThanOrEqual(1);
    expect(await countPendingOutbox(basisKey)).toBeLessThanOrEqual(1);
  });
});
