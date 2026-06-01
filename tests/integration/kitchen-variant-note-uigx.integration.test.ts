/**
 * Kitchen variant note from persisted order — uigx only.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildKitchenMealNote, buildVariantTitleLookup } from "@/lib/kitchen/kitchenMealNote";
import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import type { Database } from "@/lib/types/database";
import { closeFixturePgPool, fixturePgQuery } from "../_helpers/fixturePg";
import {
  hasRemoteSupabaseIntegrationEnv,
  readRemoteSupabaseIntegrationEnv,
  STAGING_SUPABASE_REF,
} from "../_helpers/remoteSupabaseIntegration";
import {
  buildProdRealisticVariantSeedSql,
  VARIANT_TEST_BASIS_DATE,
} from "../_helpers/variantItemkeyUigxSeed.mjs";
import { SMOKE_COMPANY_ID, SMOKE_EMAIL, SMOKE_LOCATION_ID } from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });
const basisDate = VARIANT_TEST_BASIS_DATE;

const MIG_VARIANT = path.join(
  process.cwd(),
  "supabase/migrations/20260611120000_lp_order_set_variant_itemkey.sql",
);

function assertStagingOnly() {
  const { url } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  if (!url.includes(STAGING_SUPABASE_REF) || url.includes("hkpoky")) {
    throw new Error("ABORT: uigx only");
  }
}

describe.skipIf(!enabled)("kitchen variant note e2e (uigx)", () => {
  let admin: ReturnType<typeof createClient<Database>>;
  let userClient: ReturnType<typeof createClient<Database>>;
  let userId: string;

  beforeAll(async () => {
    assertStagingOnly();
    const { url, serviceKey, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

    await fixturePgQuery(buildProdRealisticVariantSeedSql());
    await fixturePgQuery(fs.readFileSync(MIG_VARIANT, "utf8"));

    const anon = createClient<Database>(url, anonKey!, { auth: { persistSession: false } });
    const password = String(process.env.PLAYWRIGHT_TEST_PASSWORD ?? "").trim();
    const { data, error } = await anon.auth.signInWithPassword({
      email: SMOKE_EMAIL,
      password,
    });
    if (error || !data.session?.access_token) throw new Error(`signIn: ${error?.message}`);
    userId = data.user!.id;
    userClient = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });

    await userClient.rpc("lp_order_set", {
      p_date: basisDate,
      p_action: "CANCEL",
      p_note: null,
      p_slot: "default",
      p_choice_key: null,
      p_item_key: "default",
    });
    const { error: setErr } = await userClient.rpc("lp_order_set", {
      p_date: basisDate,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: "paasmurt",
      p_item_key: "ost-skinke",
    });
    if (setErr) throw new Error(`lp_order_set: ${setErr.message}`);
  }, 120_000);

  afterAll(async () => {
    await closeFixturePgPool();
  });

  test("loadOperativeKitchenOrders + buildKitchenMealNote shows variant from persisted item_key", async () => {
    const loaded = await loadOperativeKitchenOrders({
      admin,
      dateISO: basisDate,
      tenant: { companyId: SMOKE_COMPANY_ID, locationId: SMOKE_LOCATION_ID },
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const dcKey = `${SMOKE_COMPANY_ID}|${SMOKE_LOCATION_ID}|${userId}`;
    const dc = loaded.dcMap.get(dcKey);
    expect(dc?.item_key).toBe("ost-skinke");

    const variantLookup = await buildVariantTitleLookup();
    const note = buildKitchenMealNote({
      choiceKey: dc?.choice_key ?? "paasmurt",
      itemKey: dc?.item_key,
      itemTitleSnapshot: dc?.item_title_snapshot,
      note: dc?.note,
      menuByMeal: new Map(),
      variantLookup,
    });

    expect(note).toBeTruthy();
    expect(note).toMatch(/Påsmurt/i);
    expect(note).toMatch(/\(.+\)/);
    console.log("KITCHEN_E2E_OBSERVED", JSON.stringify({ kitchen_note: note, item_key: dc?.item_key }));
  }, 60_000);
});
