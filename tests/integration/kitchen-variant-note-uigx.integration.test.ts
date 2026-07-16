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
  nextWednesdayISO,
} from "../_helpers/variantItemkeyUigxSeed.mjs";
import { SMOKE_COMPANY_ID, SMOKE_EMAIL, SMOKE_LOCATION_ID } from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });
// FASE 13: egen uke (+5) — deler ikke fixture-datoer med variant-itemkey-suiten.
const basisDate = nextWednesdayISO(5);
const luxusDate = plusDaysForKitchen(basisDate, 1);
function plusDaysForKitchen(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// FASE 10-drift-fix: bruk KANONISK lp_order_set (20260814, inkluderer hele
// variant-logikken + markeds-/cutoff-kontekst). Re-applisering av 20260611
// nedgraderte golden-path-funksjonen på staging.
const MIG_CANONICAL_ORDER_SET = path.join(
  process.cwd(),
  "supabase/migrations/20260814120000_market_timezone_cutoff.sql",
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

    await fixturePgQuery(buildProdRealisticVariantSeedSql({ basisDate, luxusDate }));
    await fixturePgQuery(fs.readFileSync(MIG_CANONICAL_ORDER_SET, "utf8"));

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
