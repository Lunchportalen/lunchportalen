/**
 * TPT-A-2 — lp_provider_create RPC + outbox enqueue (integration, opt-in).
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

function randSlug(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupProvider(providerId: string) {
  await fixturePgQuery(`DELETE FROM public.outbox WHERE event_key = $1`, [
    `tripletex.provider_customer_create_lp:${providerId}`,
  ]);
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log WHERE entity_type = 'provider' AND entity_id = $1`,
    [providerId],
  );
  await fixturePgQuery(`DELETE FROM public.tripletex_customers WHERE provider_id = $1`, [providerId]);
  await fixturePgQuery(`DELETE FROM public.provider_memberships WHERE provider_id = $1`, [providerId]);
  await fixturePgQuery(`DELETE FROM public.provider_service_areas WHERE provider_id = $1`, [providerId]);
  await fixturePgQuery(`DELETE FROM public.providers WHERE id = $1`, [providerId]);
}

describe.skipIf(!hasDb)("lp_provider_create (TPT-A-2)", () => {
  let fx: ProviderTestFixtures;

  beforeAll(async () => {
    fx = await buildProviderTestFixtures({
      includeEmployee: true,
      includeRegistrations: false,
      orderOwner: "employeeA",
      requireOrder: false,
    });
  }, 120_000);

  afterAll(async () => {
    if (fx?.cleanup) await fx.cleanup();
    await closeFixturePgPool();
  }, 120_000);

  test("superadmin: creates provider, audit log, and outbox event", async () => {
    const slug = randSlug("tpt-a2");
    const rid = `test_rid_${crypto.randomUUID().slice(0, 8)}`;
    const sb = authenticatedClient(fx.superadmin.accessToken);

    const { data, error } = await (sb as any).rpc("lp_provider_create", {
      p_slug: slug,
      p_name: `TPT-A2 Provider ${slug}`,
      p_contact_email: `${slug}@test.lunchportalen.no`,
      p_billing_org_no: "999888777",
      p_billing_address: "Testveien 1, 7030 Trondheim",
      p_default_tier_pricing: "SAAS_FIXED",
      p_request_rid: rid,
    });

    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    const providerId = String(data?.provider_id ?? "");
    expect(providerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const prov = await fixturePgQuery<{ slug: string; contact_email: string }>(
      `SELECT slug, contact_email FROM public.providers WHERE id = $1`,
      [providerId],
    );
    expect(prov.rows[0]?.slug).toBe(slug);

    const audit = await fixturePgQuery<{ action: string; metadata: Record<string, unknown> }>(
      `SELECT action, metadata FROM public.lifecycle_audit_log
       WHERE entity_type = 'provider' AND entity_id = $1 AND action = 'provider_created'
       ORDER BY created_at DESC LIMIT 1`,
      [providerId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0]?.metadata?.slug).toBe(slug);

    const outbox = await fixturePgQuery<{ event_key: string; payload: Record<string, unknown> }>(
      `SELECT event_key, payload FROM public.outbox
       WHERE event_key = $1`,
      [`tripletex.provider_customer_create_lp:${providerId}`],
    );
    expect(outbox.rows.length).toBe(1);
    expect(outbox.rows[0]?.payload?.provider_id).toBe(providerId);
    expect(outbox.rows[0]?.payload?.target).toBe("lp");
    expect(outbox.rows[0]?.payload?.request_rid).toBe(rid);

    await cleanupProvider(providerId);
  });

  test("duplicate slug returns error", async () => {
    const slug = randSlug("tpt-a2-dup");
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const base = {
      p_slug: slug,
      p_name: `TPT-A2 Dup A ${slug}`,
      p_contact_email: `${slug}-a@test.lunchportalen.no`,
    };

    const first = await (sb as any).rpc("lp_provider_create", base);
    expect(first.error).toBeNull();
    const providerId = String(first.data?.provider_id ?? "");

    const second = await (sb as any).rpc("lp_provider_create", {
      ...base,
      p_name: `TPT-A2 Dup B ${slug}`,
      p_contact_email: `${slug}-b@test.lunchportalen.no`,
    });
    expect(second.error).not.toBeNull();
    expect(String(second.error?.message ?? "")).toMatch(/SLUG_ALREADY_EXISTS/i);

    await cleanupProvider(providerId);
  });

  test("missing name returns error", async () => {
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_create", {
      p_slug: randSlug("tpt-a2-noname"),
      p_name: "   ",
      p_contact_email: "noname@test.lunchportalen.no",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/NAME_REQUIRED/i);
  });

  test("employee cannot create provider", async () => {
    const sb = authenticatedClient(fx.employeeA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_create", {
      p_slug: randSlug("tpt-a2-emp"),
      p_name: "Employee Blocked Provider",
      p_contact_email: "emp-blocked@test.lunchportalen.no",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);
  });

  test("provider admin cannot create provider", async () => {
    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_provider_create", {
      p_slug: randSlug("tpt-a2-padm"),
      p_name: "Provider Admin Blocked",
      p_contact_email: "padm-blocked@test.lunchportalen.no",
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);
  });

  test("tripletex_customers scope: Flow B allows company_id + provider_id", async () => {
    const txCompany = `tx-flowb-${crypto.randomUUID().slice(0, 8)}`;
    await fixturePgQuery(
      `INSERT INTO public.tripletex_customers (
         company_id, provider_id, tripletex_customer_id, billing_country, legal_name, orgnr
       ) VALUES ($1, $2, $3, 'NO', $4, '999888777')`,
      [fx.companyA, fx.providerA, txCompany, "Flow B test"],
    );

    const row = await fixturePgQuery<{ company_id: string; provider_id: string }>(
      `SELECT company_id, provider_id FROM public.tripletex_customers
       WHERE company_id = $1 AND provider_id = $2`,
      [fx.companyA, fx.providerA],
    );
    expect(String(row.rows[0]?.company_id)).toBe(fx.companyA);
    expect(String(row.rows[0]?.provider_id)).toBe(fx.providerA);

    await fixturePgQuery(
      `DELETE FROM public.tripletex_customers WHERE company_id = $1 AND provider_id = $2`,
      [fx.companyA, fx.providerA],
    );
  });

  test("tripletex_customers scope: provider_id only insert succeeds", async () => {
    const slug = randSlug("tpt-a2-txmap");
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (sb as any).rpc("lp_provider_create", {
      p_slug: slug,
      p_name: `TPT-A2 TxMap ${slug}`,
      p_contact_email: `${slug}@test.lunchportalen.no`,
    });
    expect(error).toBeNull();
    const providerId = String(data?.provider_id ?? "");

    const txId = `tx-prov-only-${crypto.randomUUID().slice(0, 8)}`;
    await fixturePgQuery(
      `INSERT INTO public.tripletex_customers (
         company_id, provider_id, tripletex_customer_id, billing_country, legal_name
       ) VALUES (NULL, $1, $2, 'NO', $3)`,
      [providerId, txId, `TPT-A2 ${slug}`],
    );

    const row = await fixturePgQuery<{ provider_id: string; company_id: string | null }>(
      `SELECT provider_id, company_id FROM public.tripletex_customers WHERE provider_id = $1`,
      [providerId],
    );
    expect(row.rows[0]?.company_id).toBeNull();
    expect(String(row.rows[0]?.provider_id)).toBe(providerId);

    await cleanupProvider(providerId);
  });
});
