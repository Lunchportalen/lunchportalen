/**
 * lp_user_allergens RLS — uigx only (RUN_SUPABASE_INTEGRATION_TESTS=1).
 * Requires migration 20260615120000_lp_user_allergens_foundation.sql applied on staging.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/types/database";
import { closeFixturePgPool, fixturePgQuery } from "../_helpers/fixturePg";
import {
  hasRemoteSupabaseIntegrationEnv,
  readPostgresFixtureEnv,
  readRemoteSupabaseIntegrationEnv,
  STAGING_SUPABASE_REF,
} from "../_helpers/remoteSupabaseIntegration";
import { authenticatedClient, anonClient } from "../_helpers/supabaseTestClient";
import {
  SMOKE_COMPANY_ID,
  SMOKE_EMAIL,
  SMOKE_LOCATION_ID,
  SMOKE_USER_ID,
} from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });

const MIG = path.join(process.cwd(), "supabase/migrations/20260615120000_lp_user_allergens_foundation.sql");

function assertStagingOnly() {
  const { url } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  const { connectionString } = readPostgresFixtureEnv();
  if (url.includes("hkpoky") || connectionString.includes("hkpoky")) {
    throw new Error("ABORT: prod hkpoky — integration must use uigx only");
  }
  if (!url.includes(STAGING_SUPABASE_REF) || !connectionString.includes(STAGING_SUPABASE_REF)) {
    throw new Error(`ABORT: expected staging ref ${STAGING_SUPABASE_REF}`);
  }
}

describe.skipIf(!enabled)("lp_user_allergens RLS (uigx)", () => {
  let admin: ReturnType<typeof createClient<Database>>;
  let employeeClient: ReturnType<typeof createClient<Database>>;
  let testUserId = SMOKE_USER_ID;

  beforeAll(async () => {
    assertStagingOnly();
    if (!fs.existsSync(MIG)) {
      throw new Error(`ABORT: missing migration file ${MIG}`);
    }

    const { url, serviceKey, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    admin = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { rows } = await fixturePgQuery<{ exists: boolean }>(
      `select to_regclass('public.lp_user_allergens') is not null as exists`,
    );
    if (!rows[0]?.exists) {
      throw new Error(`ABORT: apply ${path.basename(MIG)} on uigx (${STAGING_SUPABASE_REF}) before running`);
    }

    const email = String(process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL ?? process.env.PLAYWRIGHT_TEST_EMAIL ?? "").trim();
    const password = String(process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.SMOKE_TEST_PASSWORD ?? "").trim();
    if (!email || !password) {
      throw new Error("SKIP_AUTH: set PLAYWRIGHT_TEST_PASSWORD for employee RLS tests");
    }

    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      throw new Error(`signIn failed: ${error?.message ?? "no token"}`);
    }
    testUserId = data.user?.id ?? SMOKE_USER_ID;
    employeeClient = authenticatedClient(data.session.access_token);
  }, 120_000);

  afterAll(async () => {
    await closeFixturePgPool();
  });

  test("self: upsert and read own row", async () => {
    const { error: upErr } = await (employeeClient as any)
      .from("lp_user_allergens")
      .upsert(
        {
          user_id: testUserId,
          codes: ["gluten", "milk"],
          free_text: "Test ekstra info",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    expect(upErr).toBeNull();

    const { data, error } = await (employeeClient as any)
      .from("lp_user_allergens")
      .select("user_id, codes, free_text")
      .eq("user_id", testUserId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(testUserId);
    expect(data?.codes).toEqual(expect.arrayContaining(["gluten", "milk"]));
    expect(String(data?.free_text ?? "")).toContain("Test ekstra");
  }, 60_000);

  test("self: cannot read other users via RLS filter", async () => {
    const { data, error } = await (employeeClient as any).from("lp_user_allergens").select("user_id");
    expect(error).toBeNull();
    const rows = Array.isArray(data) ? data : [];
    expect(rows.every((r: { user_id: string }) => r.user_id === testUserId)).toBe(true);
  }, 30_000);

  test("anon: permission denied (fail-closed — no SELECT grant to anon)", async () => {
    const anon = anonClient();
    const { data, error } = await (anon as any).from("lp_user_allergens").select("user_id").limit(5);
    expect(error?.code).toBe("42501");
    expect((data ?? []).length).toBe(0);
  }, 30_000);

  test("kitchen_can_read_lp_user_allergen: false without kitchen JWT in postgres fixture (policy OK, not seed bug)", async () => {
    const { rows } = await fixturePgQuery<{ ok: boolean }>(
      `select public.kitchen_can_read_lp_user_allergen($1::uuid) as ok`,
      [testUserId],
    );
    // can_kitchen_location() uses auth.uid() — postgres fixture has no JWT context.
    expect(rows[0]?.ok).toBe(false);
  }, 30_000);

  test("tenant: profile location matches smoke fixture", async () => {
    const { rows } = await fixturePgQuery<{ company_id: string; location_id: string }>(
      `select company_id::text, location_id::text from public.profiles where id = $1`,
      [testUserId],
    );
    expect(rows[0]?.company_id).toBe(SMOKE_COMPANY_ID);
    expect(rows[0]?.location_id).toBe(SMOKE_LOCATION_ID);
  }, 30_000);
});
