/**
 * lp_order_set variant item_key (CMS slug) — uigx only (RUN_SUPABASE_INTEGRATION_TESTS=1).
 * Requires 20260611120000_lp_order_set_variant_itemkey on staging.
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
import {
  buildProdRealisticVariantSeedSql,
  VARIANT_TEST_BASIS_DATE,
  VARIANT_TEST_LUXUS_DATE,
  VARIANT_TEST_PRODUCT_SKUS,
} from "../_helpers/variantItemkeyUigxSeed.mjs";
import {
  SMOKE_COMPANY_ID,
  SMOKE_EMAIL,
  SMOKE_LOCATION_ID,
  SMOKE_USER_ID,
} from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });

const MIG_BASE = path.join(
  process.cwd(),
  "supabase/migrations/20260610130000_lp_order_set_varmmat_msdi_alias.sql",
);
const MIG_VARIANT = path.join(
  process.cwd(),
  "supabase/migrations/20260611120000_lp_order_set_variant_itemkey.sql",
);

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

function expectMenuNotFound(error: { message?: string } | null) {
  expect(error).not.toBeNull();
  expect(String(error?.message ?? "")).toContain("MENU_SERVICE_DAY_ITEM_NOT_FOUND");
}

describe.skipIf(!enabled)("lp_order_set variant item_key (uigx integration)", () => {
  const basisDate = VARIANT_TEST_BASIS_DATE;
  const luxusDate = VARIANT_TEST_LUXUS_DATE;

  let admin: ReturnType<typeof createClient<Database>>;
  let userClient: ReturnType<typeof createClient<Database>>;
  let testUserId = SMOKE_USER_ID;
  let productIdBySku: Record<string, string> = {};

  beforeAll(async () => {
    assertStagingOnly();
    const { url, serviceKey, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    admin = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await fixturePgQuery(buildProdRealisticVariantSeedSql());
    await fixturePgQuery(fs.readFileSync(MIG_VARIANT, "utf8"));

    const skus = Object.values(VARIANT_TEST_PRODUCT_SKUS);
    const { rows: prods } = await fixturePgQuery<{ id: string; sku: string }>(
      `select id, sku from public.products
       where company_id is null and sku = any($1::text[])`,
      [skus],
    );
    for (const row of prods) {
      if (row.sku) productIdBySku[row.sku] = row.id;
    }
    for (const sku of skus) {
      if (!productIdBySku[sku]) {
        throw new Error(`ABORT: missing global product sku=${sku} on uigx — seed catalog first`);
      }
    }

    const email = String(process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL).trim();
    const password = String(process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.SMOKE_TEST_PASSWORD ?? "").trim();
    if (!email || !password) {
      throw new Error("SKIP_AUTH: set PLAYWRIGHT_TEST_PASSWORD for lp_order_set RPC");
    }

    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      throw new Error(`signIn failed: ${error?.message ?? "no token"}`);
    }
    testUserId = data.user?.id ?? SMOKE_USER_ID;
    userClient = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
  }, 120_000);

  afterAll(async () => {
    try {
      await fixturePgQuery(fs.readFileSync(MIG_VARIANT, "utf8"));
    } finally {
      await closeFixturePgPool();
    }
  });

  async function cancelIfActive(date: string) {
    await userClient.rpc("lp_order_set", {
      p_date: date,
      p_action: "CANCEL",
      p_note: null,
      p_slot: "default",
      p_choice_key: null,
      p_item_key: "default",
    });
  }

  async function setOrder(date: string, choiceKey: string, itemKey: string = "default") {
    return userClient.rpc("lp_order_set", {
      p_date: date,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: choiceKey,
      p_item_key: itemKey,
    });
  }

  async function activeOrderProductId(date: string): Promise<string | undefined> {
    const { data: order } = await admin
      .from("orders")
      .select("id, order_items(product_id)")
      .eq("user_id", testUserId)
      .eq("date", date)
      .eq("status", "ACTIVE")
      .maybeSingle();
    const items = order?.order_items;
    const row = Array.isArray(items) ? items[0] : items;
    return row && typeof row === "object" && "product_id" in row
      ? String((row as { product_id: string }).product_id)
      : undefined;
  }

  test("prove-fire: BASE RPC → 409, variant RPC → 200 (paasmurt+ost-skinke)", async () => {
    await fixturePgQuery(fs.readFileSync(MIG_BASE, "utf8"));
    await cancelIfActive(basisDate);
    const base = await setOrder(basisDate, "paasmurt", "ost-skinke");
    expectMenuNotFound(base.error);

    await fixturePgQuery(fs.readFileSync(MIG_VARIANT, "utf8"));
    await cancelIfActive(basisDate);
    const variant = await setOrder(basisDate, "paasmurt", "ost-skinke");
    expect(variant.error).toBeNull();
    expect(await activeOrderProductId(basisDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.paasmurt]);
  }, 90_000);

  test("BASIS: paasmurt+variant → 200 + item_key", async () => {
    await cancelIfActive(basisDate);
    const { error } = await setOrder(basisDate, "paasmurt", "ost-skinke");
    expect(error).toBeNull();

    const { data: dc } = await admin
      .from("day_choices")
      .select("choice_key, item_key")
      .eq("user_id", testUserId)
      .eq("company_id", SMOKE_COMPANY_ID)
      .eq("location_id", SMOKE_LOCATION_ID)
      .eq("date", basisDate)
      .maybeSingle();
    expect(dc?.choice_key).toBe("paasmurt");
    expect(dc?.item_key).toBe("ost-skinke");
    expect(await activeOrderProductId(basisDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.paasmurt]);
  }, 60_000);

  test("BASIS: salatboks+variant → 200 + item_key", async () => {
    await cancelIfActive(basisDate);
    const { error } = await setOrder(basisDate, "salatboks", "kylling-karri");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", basisDate)
      .maybeSingle();
    expect(dc?.item_key).toBe("kylling-karri");
    expect(await activeOrderProductId(basisDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.salatboks]);
  }, 60_000);

  test("BASIS: varmmat default → 200 (alias)", async () => {
    await cancelIfActive(basisDate);
    const { error } = await setOrder(basisDate, "varmmat", "default");
    expect(error).toBeNull();
    expect(await activeOrderProductId(basisDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.varmrett]);
  }, 60_000);

  test("BASIS: default item_key → 200, item_key null", async () => {
    await cancelIfActive(basisDate);
    const { error } = await setOrder(basisDate, "paasmurt", "default");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", basisDate)
      .maybeSingle();
    expect(dc?.item_key).toBeNull();
  }, 60_000);

  test("BASIS: sushi+variant → 409 (ikke på meny @9000)", async () => {
    await cancelIfActive(basisDate);
    const { error } = await setOrder(basisDate, "sushi", "laks-avokado");
    expectMenuNotFound(error);
  }, 60_000);

  test("LUXUS: sushi+variant → 200", async () => {
    await cancelIfActive(luxusDate);
    const { error } = await setOrder(luxusDate, "sushi", "laks-avokado");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", luxusDate)
      .maybeSingle();
    expect(dc?.item_key).toBe("laks-avokado");
    expect(await activeOrderProductId(luxusDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.sushi]);
  }, 60_000);

  test("LUXUS: pokebowl+variant → 200", async () => {
    await cancelIfActive(luxusDate);
    const { error } = await setOrder(luxusDate, "pokebowl", "kylling");
    expect(error).toBeNull();
    expect(await activeOrderProductId(luxusDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.pokebowl]);
  }, 60_000);

  test("LUXUS: thaimat+variant → 200 (kategori Thaimat)", async () => {
    await cancelIfActive(luxusDate);
    const { error } = await setOrder(luxusDate, "thaimat", "kylling-curry");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", luxusDate)
      .maybeSingle();
    expect(dc?.item_key).toBe("kylling-curry");
    expect(await activeOrderProductId(luxusDate)).toBe(productIdBySku[VARIANT_TEST_PRODUCT_SKUS.thaimat]);
  }, 60_000);
});
