/**
 * lp_order_set varmmat→varmrett MSDI alias — uigx only (RUN_SUPABASE_INTEGRATION_TESTS=1).
 * Requires migration 20260610130000 applied on staging branch.
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
  SMOKE_USER_ID,
} from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";
import { nextWednesdayISO } from "../_helpers/variantItemkeyUigxSeed.mjs";

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
select gen_random_uuid(), '${SMOKE_COMPANY_ID}', '${SMOKE_LOCATION_ID}', '${serviceDate}'::date, 'published', c.provider_id, now(), now()
from public.companies c where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do update set state = 'published', updated_at = now();

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

describe.skipIf(!enabled)("lp_order_set varmmat MSDI alias (uigx integration)", () => {
  /** Fixed Wed in smoke agreement window (see scripts/smoke/fixtures). */
  // FASE 13: dynamisk framtidig onsdag (+4 uker) — fast dato forfalt mot cutoff.
  const serviceDate = nextWednesdayISO(4);
  let admin: ReturnType<typeof createClient<Database>>;
  let userClient: ReturnType<typeof createClient<Database>>;
  /** Resolved at sign-in (uigx smoke user id may differ from SMOKE_USER_ID default). */
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
      process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL ?? process.env.PLAYWRIGHT_TEST_EMAIL ?? "",
    ).trim();
    const password = String(process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.SMOKE_TEST_PASSWORD ?? "").trim();
    if (!email || !password) {
      throw new Error("SKIP_AUTH: set PLAYWRIGHT_TEST_PASSWORD (and SMOKE_EMAIL) for lp_order_set RPC as employee");
    }

    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      throw new Error(`signIn failed: ${error?.message ?? "no token"}`);
    }
    const uid = data.user?.id;
    if (!uid) {
      throw new Error("signIn succeeded but auth.users id missing");
    }
    testUserId = uid;
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

  async function setChoice(date: string, choiceKey: string) {
    const { error } = await userClient.rpc("lp_order_set", {
      p_date: date,
      p_action: "SET",
      p_note: null,
      p_slot: "default",
      p_choice_key: choiceKey,
      p_item_key: "default",
    });
    return error;
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

  test("varmmat: resolves MSDI, stores choice_key varmmat", async () => {
    await cancelIfActive(serviceDate);
    const err = await setChoice(serviceDate, "varmmat");
    expect(err).toBeNull();

    const { data: dc } = await admin
      .from("day_choices")
      .select("choice_key")
      .eq("user_id", testUserId)
      .eq("company_id", SMOKE_COMPANY_ID)
      .eq("location_id", SMOKE_LOCATION_ID)
      .eq("date", serviceDate)
      .maybeSingle();
    expect(dc?.choice_key).toBe("varmmat");

    expect(await activeOrderProductId(serviceDate)).toBe(productIds.varmrett);
  }, 60_000);

  test("paasmurt: no regression", async () => {
    await cancelIfActive(serviceDate);
    const err = await setChoice(serviceDate, "paasmurt");
    expect(err).toBeNull();
    expect(await activeOrderProductId(serviceDate)).toBe(productIds.paasmurt);
  }, 60_000);

  test("salatboks: no regression", async () => {
    await cancelIfActive(serviceDate);
    const err = await setChoice(serviceDate, "salatboks");
    expect(err).toBeNull();
    expect(await activeOrderProductId(serviceDate)).toBe(productIds.salatboks);
  }, 60_000);
});
