#!/usr/bin/env node
/**
 * Idempotent staging menu seed for DC-011 A6 (uigx only).
 * Requires DATABASE_URL or SUPABASE_DB_URL (session pooler) in env / .env.local.
 *
 * Usage: node scripts/smoke/seed-smoke-menu-fixture.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  SMOKE_BASIS_PRICE_CENTS,
  SMOKE_CATEGORY_NAME,
  SMOKE_CHOICE_KEY,
  SMOKE_COMPANY_ID,
  SMOKE_LOCATION_ID,
  SMOKE_MENU_ITEM_ID,
  SMOKE_MENU_SERVICE_DAY_ID,
  SMOKE_ORDER_DATE,
  SMOKE_PRODUCT_CATEGORY_ID,
  SMOKE_PRODUCT_ID,
  SMOKE_PRODUCT_SKU,
  SMOKE_USER_ID,
} from "./fixtures/smoke-menu-fixture.constants.mjs";

const { Client } = pg;

function loadEnvFile(file, override = false) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (override || process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_POSTGRES_URL ||
    ""
  ).trim();
}

function normalizePgUrl(url) {
  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]+/i, "sslmode=no-verify");
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=no-verify`;
}

function createPgClient(url) {
  return new Client({
    connectionString: normalizePgUrl(url),
    ssl: { rejectUnauthorized: false },
  });
}

export function buildSmokeMenuSeedSql() {
  return `
-- smoke-menu-fixture (deterministic, idempotent)
insert into public.product_categories (id, name, sort_order, created_at, updated_at)
values (
  '${SMOKE_PRODUCT_CATEGORY_ID}',
  '${SMOKE_CATEGORY_NAME}',
  0,
  now(),
  now()
)
on conflict (name) do update set updated_at = now();

insert into public.products (
  id,
  company_id,
  category_id,
  name,
  description,
  sku,
  unit_name,
  vat_rate,
  base_price_cents_ex_vat,
  currency_code,
  is_active,
  is_visible,
  sort_order,
  created_at,
  updated_at
)
values (
  '${SMOKE_PRODUCT_ID}',
  '${SMOKE_COMPANY_ID}',
  (select id from public.product_categories where name = '${SMOKE_CATEGORY_NAME}' limit 1),
  'LP Smoke Varmrett',
  'DC-011 idempotency fixture',
  '${SMOKE_PRODUCT_SKU}',
  'kuvert',
  0.15,
  ${SMOKE_BASIS_PRICE_CENTS},
  'NOK',
  true,
  true,
  0,
  now(),
  now()
)
on conflict (id) do update set
  company_id = excluded.company_id,
  category_id = excluded.category_id,
  is_active = true,
  is_visible = true,
  base_price_cents_ex_vat = excluded.base_price_cents_ex_vat,
  updated_at = now();

insert into public.menu_service_days (
  id,
  company_id,
  location_id,
  service_date,
  state,
  provider_id,
  created_at,
  updated_at
)
select
  '${SMOKE_MENU_SERVICE_DAY_ID}',
  '${SMOKE_COMPANY_ID}',
  '${SMOKE_LOCATION_ID}',
  '${SMOKE_ORDER_DATE}'::date,
  'published',
  c.provider_id,
  now(),
  now()
from public.companies c
where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do update set
  state = 'published',
  company_id = excluded.company_id,
  provider_id = excluded.provider_id,
  updated_at = now();

insert into public.menu_service_day_items (
  id,
  menu_service_day_id,
  product_id,
  product_name_snapshot,
  unit_name_snapshot,
  offered_price_cents_ex_vat,
  vat_rate_snapshot,
  quantity,
  sort_order,
  is_optional,
  created_at,
  updated_at
)
values (
  '${SMOKE_MENU_ITEM_ID}',
  (select id from public.menu_service_days where location_id = '${SMOKE_LOCATION_ID}' and service_date = '${SMOKE_ORDER_DATE}'::date limit 1),
  '${SMOKE_PRODUCT_ID}',
  'LP Smoke Varmrett',
  'kuvert',
  ${SMOKE_BASIS_PRICE_CENTS},
  0.15,
  1,
  0,
  false,
  now(),
  now()
)
on conflict (menu_service_day_id, product_id) do update set
  offered_price_cents_ex_vat = excluded.offered_price_cents_ex_vat,
  product_name_snapshot = excluded.product_name_snapshot,
  unit_name_snapshot = excluded.unit_name_snapshot,
  updated_at = now();
`;
}

const STAGING_PROJECT_REF = "uigxsboqeruxflgzqztl";

export async function seedSmokeMenuFixture() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("seedSmokeMenuFixture: DATABASE_URL (or SUPABASE_DB_URL) required");
  }
  if (!url.includes(STAGING_PROJECT_REF) && process.env.DC011_ALLOW_ANY_DB !== "1") {
    throw new Error(
      `seedSmokeMenuFixture: DATABASE_URL must target staging ${STAGING_PROJECT_REF} (got other host).`,
    );
  }
  const client = createPgClient(url);
  await client.connect();
  try {
    await client.query("begin");
    await client.query(buildSmokeMenuSeedSql());
    const verify = await client.query(
      `select
         (select count(*)::int from public.menu_service_day_items msdi
          join public.menu_service_days msd on msd.id = msdi.menu_service_day_id
          where msd.location_id = $1 and msd.service_date = $2::date) as items,
         (select state from public.menu_service_days
          where location_id = $1 and service_date = $2::date limit 1) as msd_state`,
      [SMOKE_LOCATION_ID, SMOKE_ORDER_DATE],
    );
    const row = verify.rows[0];
    if (!row || row.items < 1 || row.msd_state !== "published") {
      throw new Error(
        `seedSmokeMenuFixture verify failed: items=${row?.items} state=${row?.msd_state}`,
      );
    }
    await client.query("commit");
    return { ok: true, date: SMOKE_ORDER_DATE, items: row.items, choiceKey: SMOKE_CHOICE_KEY };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

/** Count ACTIVE/ORDERED orders for smoke user on fixture date (expect 1 after idempotent replay). */
export async function countSmokeOrdersOnFixtureDate() {
  const url = databaseUrl();
  if (!url) throw new Error("countSmokeOrdersOnFixtureDate: DATABASE_URL required");
  const client = createPgClient(url);
  await client.connect();
  try {
    const res = await client.query(
      `select count(*)::int as n
       from public.orders
       where user_id = $1
         and date = $2::date
         and upper(status) in ('ACTIVE', 'ORDERED')`,
      [SMOKE_USER_ID, SMOKE_ORDER_DATE],
    );
    return res.rows[0]?.n ?? 0;
  } finally {
    await client.end();
  }
}

async function main() {
  loadEnvFile(".env.local", true);
  const out = await seedSmokeMenuFixture();
  console.log("SMOKE_MENU_SEED_OK", JSON.stringify(out));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
