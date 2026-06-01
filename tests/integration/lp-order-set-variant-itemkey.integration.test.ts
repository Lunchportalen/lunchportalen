/**
 * lp_order_set variant item_key (CMS slug) — uigx only (RUN_SUPABASE_INTEGRATION_TESTS=1).
 * Requires 20260611120000_lp_order_set_variant_itemkey applied on staging branch.
 */
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
  SMOKE_BASIS_PRICE_CENTS,
  SMOKE_COMPANY_ID,
  SMOKE_EMAIL,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
  SMOKE_USER_ID,
} from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });

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

function buildTriCategorySeedSql(serviceDate: string) {
  const catPaasmurt = "c1111111-1111-4111-8111-000000000101";
  const catSalat = "c1111111-1111-4111-8111-000000000102";
  const catVarmrett = "c1111111-1111-4111-8111-000000000103";
  const prodPaasmurt = "c1111111-1111-4111-8111-000000000201";
  const prodSalat = "c1111111-1111-4111-8111-000000000202";
  const prodVarmrett = "c1111111-1111-4111-8111-000000000203";
  const msdId = "c1111111-1111-4111-8111-000000000301";

  return `
insert into public.product_categories (id, name, sort_order, created_at, updated_at)
values
  ('${catPaasmurt}', 'Paasmurt', 1, now(), now()),
  ('${catSalat}', 'Salatboks', 2, now(), now()),
  ('${catVarmrett}', 'Varmrett', 3, now(), now())
on conflict (name) do update set updated_at = now();

insert into public.products (id, company_id, category_id, name, sku, unit_name, vat_rate, base_price_cents_ex_vat, currency_code, is_active, is_visible, sort_order, created_at, updated_at)
values
  ('${prodPaasmurt}', null, (select id from public.product_categories where name = 'Paasmurt' limit 1), 'LP Test Paasmurt', 'paasmurt', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 1, now(), now()),
  ('${prodSalat}', null, (select id from public.product_categories where name = 'Salatboks' limit 1), 'LP Test Salatboks', 'salatboks', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 2, now(), now()),
  ('${prodVarmrett}', null, (select id from public.product_categories where name = 'Varmrett' limit 1), 'LP Test Varmrett', 'varmrett', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 3, now(), now())
on conflict (id) do update set category_id = excluded.category_id, sku = excluded.sku, updated_at = now();

insert into public.menu_service_days (id, company_id, location_id, service_date, state, provider_id, created_at, updated_at)
select '${msdId}', '${SMOKE_COMPANY_ID}', '${SMOKE_LOCATION_ID}', '${serviceDate}'::date, 'published', c.provider_id, now(), now()
from public.companies c where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do nothing;

insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional, created_at, updated_at)
select msd.id, p.id, p.name, 'porsjon', ${SMOKE_BASIS_PRICE_CENTS}, 0.15, 1,
  10 + row_number() over (order by p.sku), false, now(), now()
from public.menu_service_days msd
cross join public.products p
where msd.location_id = '${SMOKE_LOCATION_ID}' and msd.service_date = '${serviceDate}'::date
  and msd.state in ('published', 'locked')
  and p.sku in ('paasmurt', 'salatboks', 'varmrett') and p.company_id is null
  and not exists (
    select 1 from public.menu_service_day_items x
    where x.menu_service_day_id = msd.id and x.product_id = p.id
  );
`;
}

describe.skipIf(!enabled)("lp_order_set variant item_key (uigx integration)", () => {
  const serviceDate = SMOKE_ORDER_DATE;
  let admin: ReturnType<typeof createClient<Database>>;
  let userClient: ReturnType<typeof createClient<Database>>;
  let testUserId = SMOKE_USER_ID;
  const productIds = {
    paasmurt: "c1111111-1111-4111-8111-000000000201",
    salatboks: "c1111111-1111-4111-8111-000000000202",
    varmrett: "c1111111-1111-4111-8111-000000000203",
  };

  beforeAll(async () => {
    assertStagingOnly();
    const { url, serviceKey, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    admin = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await fixturePgQuery(buildTriCategorySeedSql(serviceDate));

    const email = String(
      process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL ?? process.env.PLAYWRIGHT_TEST_PASSWORD ?? "",
    ).trim();
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
    await closeFixturePgPool();
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

  async function setOrder(
    date: string,
    choiceKey: string,
    itemKey: string = "default",
  ) {
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

  test("PROVE-FIRE: variant slug ost-skinke → 200 (pre-migration RPC returned MENU_SERVICE_DAY_ITEM_NOT_FOUND)", async () => {
    await cancelIfActive(serviceDate);
    const { error } = await setOrder(serviceDate, "paasmurt", "ost-skinke");
    expect(error).toBeNull();

    const { data: dc } = await admin
      .from("day_choices")
      .select("choice_key, item_key")
      .eq("user_id", testUserId)
      .eq("company_id", SMOKE_COMPANY_ID)
      .eq("location_id", SMOKE_LOCATION_ID)
      .eq("date", serviceDate)
      .maybeSingle();
    expect(dc?.choice_key).toBe("paasmurt");
    expect(dc?.item_key).toBe("ost-skinke");
    expect(await activeOrderProductId(serviceDate)).toBe(productIds.paasmurt);
  }, 60_000);

  test("salatboks variant slug → 200 + item_key", async () => {
    await cancelIfActive(serviceDate);
    const { error } = await setOrder(serviceDate, "salatboks", "kylling-karri");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", serviceDate)
      .maybeSingle();
    expect(dc?.item_key).toBe("kylling-karri");
    expect(await activeOrderProductId(serviceDate)).toBe(productIds.salatboks);
  }, 60_000);

  test("varmmat default → 200 (alias + no variant regression)", async () => {
    await cancelIfActive(serviceDate);
    const { error } = await setOrder(serviceDate, "varmmat", "default");
    expect(error).toBeNull();
    expect(await activeOrderProductId(serviceDate)).toBe(productIds.varmrett);
  }, 60_000);

  test("default item_key → 200, item_key null in day_choices", async () => {
    await cancelIfActive(serviceDate);
    const { error } = await setOrder(serviceDate, "paasmurt", "default");
    expect(error).toBeNull();
    const { data: dc } = await admin
      .from("day_choices")
      .select("item_key")
      .eq("user_id", testUserId)
      .eq("date", serviceDate)
      .maybeSingle();
    expect(dc?.item_key).toBeNull();
  }, 60_000);
});
