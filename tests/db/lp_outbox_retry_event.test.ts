/**
 * TPT-A-7 — lp_outbox_retry_event RPC (integration, opt-in).
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

async function cleanupOutbox(id: string) {
  await fixturePgQuery(
    `DELETE FROM public.lifecycle_audit_log WHERE entity_id = $1::uuid AND action = 'outbox_manual_retry'`,
    [id],
  );
  await fixturePgQuery(`DELETE FROM public.outbox WHERE id = $1`, [id]);
}

describe.skipIf(!hasDb)("lp_outbox_retry_event (TPT-A-7)", () => {
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

  test("superadmin can retry FAILED tripletex outbox event", async () => {
    const id = crypto.randomUUID();
    const eventKey = `tripletex.test_retry:${id}`;
    await fixturePgQuery(
      `INSERT INTO public.outbox (id, event_key, payload, status, attempts, last_error)
       VALUES ($1, $2, '{}'::jsonb, 'FAILED', 1, 'test error')`,
      [id, eventKey],
    );

    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { data, error } = await (sb as any).rpc("lp_outbox_retry_event", { p_event_id: id });

    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.previous_status).toBe("FAILED");

    const row = await fixturePgQuery<{ status: string; attempts: number; last_error: string | null }>(
      `SELECT status, attempts, last_error FROM public.outbox WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]?.status).toBe("PENDING");
    expect(Number(row.rows[0]?.attempts)).toBe(2);
    expect(row.rows[0]?.last_error).toBeNull();

    const audit = await fixturePgQuery<{ action: string }>(
      `SELECT action FROM public.lifecycle_audit_log
       WHERE entity_id = $1 AND action = 'outbox_manual_retry' ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    expect(audit.rows.length).toBe(1);

    await cleanupOutbox(id);
  });

  test("non-superadmin → permission denied", async () => {
    const id = crypto.randomUUID();
    await fixturePgQuery(
      `INSERT INTO public.outbox (id, event_key, payload, status)
       VALUES ($1, $2, '{}'::jsonb, 'FAILED')`,
      [id, `tripletex.test_denied:${id}`],
    );

    const sb = authenticatedClient(fx.providerAdminA.accessToken);
    const { error } = await (sb as any).rpc("lp_outbox_retry_event", { p_event_id: id });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/PERMISSION_DENIED/i);

    await cleanupOutbox(id);
  });

  test("event not found → error", async () => {
    const sb = authenticatedClient(fx.superadmin.accessToken);
    const missing = crypto.randomUUID();
    const { error } = await (sb as any).rpc("lp_outbox_retry_event", { p_event_id: missing });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/OUTBOX_EVENT_NOT_FOUND|not found/i);
  });

  test("SENT event cannot be retried", async () => {
    const id = crypto.randomUUID();
    await fixturePgQuery(
      `INSERT INTO public.outbox (id, event_key, payload, status)
       VALUES ($1, $2, '{}'::jsonb, 'SENT')`,
      [id, `tripletex.test_sent:${id}`],
    );

    const sb = authenticatedClient(fx.superadmin.accessToken);
    const { error } = await (sb as any).rpc("lp_outbox_retry_event", { p_event_id: id });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? "")).toMatch(/OUTBOX_RETRY_STATUS_INVALID|invalid/i);

    await cleanupOutbox(id);
  });
});
