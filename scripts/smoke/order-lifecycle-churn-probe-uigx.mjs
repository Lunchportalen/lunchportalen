#!/usr/bin/env node
/**
 * FASE 0.2 — dump state after each churn step on uigx (read-only except RPC writes on staging).
 * Usage: RUN_SUPABASE_INTEGRATION_TESTS=1 node scripts/smoke/order-lifecycle-churn-probe-uigx.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import {
  SMOKE_BASIS_PRICE_CENTS,
  SMOKE_COMPANY_ID,
  SMOKE_EMAIL,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
  SMOKE_USER_ID,
} from "./fixtures/smoke-menu-fixture.constants.mjs";

const PROD_REF = "hkpokyapzarefrgqzkos";
const STAGING_REF = "uigxsboqeruxflgzqztl";
const DATE = SMOKE_ORDER_DATE;

function buildTriCategorySeedSql(serviceDate) {
  return `
insert into public.product_categories (name, sort_order, created_at, updated_at)
select v.name, v.sort_order, now(), now()
from (values ('Paasmurt', 1), ('Salatboks', 2), ('Varmrett', 3)) as v(name, sort_order)
where not exists (select 1 from public.product_categories pc where pc.name = v.name);

insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id, created_at, updated_at)
select '${SMOKE_COMPANY_ID}', '${SMOKE_LOCATION_ID}', '${serviceDate}'::date, 'published', c.provider_id, now(), now()
from public.companies c where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do update set state = 'published', updated_at = now();

insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional, created_at, updated_at)
select msd.id, p.id, p.name, 'porsjon', ${SMOKE_BASIS_PRICE_CENTS}, 0.15, 1, 10, false, now(), now()
from public.menu_service_days msd
inner join public.products p on p.company_id is null and p.sku in ('paasmurt', 'salatboks', 'varmrett')
where msd.location_id = '${SMOKE_LOCATION_ID}' and msd.service_date = '${serviceDate}'::date;
`;
}

function abort(msg) {
  console.error(`ABORT: ${msg}`);
  process.exit(2);
}

function pgUrl() {
  const u =
    process.env.SUPABASE_POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    "";
  if (!u || u.includes(PROD_REF)) abort("prod URL or missing postgres");
  if (!u.includes(STAGING_REF)) abort(`expected ${STAGING_REF}`);
  return u;
}

async function pgQuery(sql, params = []) {
  const pool = new pg.Pool({ connectionString: pgUrl(), ssl: { rejectUnauthorized: false } });
  try {
    return (await pool.query(sql, params)).rows;
  } finally {
    await pool.end();
  }
}

function foldCanonical(orders) {
  const rank = (s) => {
    const u = String(s ?? "").toUpperCase();
    if (u === "ACTIVE") return 2;
    if (u === "CANCELLED" || u === "CANCELED") return 1;
    return 0;
  };
  let best = null;
  for (const o of orders) {
    if (!best) {
      best = o;
      continue;
    }
    const br = rank(best.status);
    const cr = rank(o.status);
    if (cr > br) best = o;
    else if (cr === br) {
      const bt = new Date(best.updated_at ?? 0).getTime();
      const ct = new Date(o.updated_at ?? 0).getTime();
      if (ct > bt) best = o;
    }
  }
  return best;
}

async function dump(label, userId) {
  const orders = await pgQuery(
    `select id, status, updated_at, slot from public.orders
     where user_id = $1 and company_id = $2 and location_id = $3 and date = $4::date
     order by updated_at asc`,
    [userId, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, DATE],
  );
  const dc = await pgQuery(
    `select status, choice_key, item_key, updated_at from public.day_choices
     where user_id = $1 and company_id = $2 and location_id = $3 and date = $4::date`,
    [userId, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, DATE],
  );
  const activeId = orders.find((o) => String(o.status).toUpperCase() === "ACTIVE")?.id ?? null;
  const items = activeId
    ? await pgQuery(`select order_id, product_id from public.order_items where order_id = $1`, [activeId])
    : [];
  const last = orders.length ? orders[orders.length - 1] : null;
  const canon = foldCanonical(orders);
  console.log(`\n=== ${label} ===`);
  console.log("orders:", JSON.stringify(orders, null, 2));
  console.log("day_choices:", JSON.stringify(dc, null, 2));
  console.log("order_items:", JSON.stringify(items, null, 2));
  console.log("window_naive_last:", {
    orderStatus: last?.status ?? null,
    wantsLunch: String(last?.status ?? "").toUpperCase() === "ACTIVE",
  });
  console.log("window_canonical:", {
    orderStatus: canon?.status ?? null,
    wantsLunch: String(canon?.status ?? "").toUpperCase() === "ACTIVE",
    dc: dc[0] ?? null,
  });
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.SMOKE_TEST_PASSWORD ?? "";
  if (!url.includes(STAGING_REF)) abort("staging SUPABASE_URL required");
  if (!anonKey || !password) abort("anon + PLAYWRIGHT_TEST_PASSWORD");

  await pgQuery(buildTriCategorySeedSql(DATE));
  const mig = path.join(
    process.cwd(),
    "supabase/migrations/20260612120000_lp_order_set_lifecycle_robustness.sql",
  );
  if (fs.existsSync(mig)) await pgQuery(fs.readFileSync(mig, "utf8"));

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error } = await anon.auth.signInWithPassword({
    email: process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL,
    password,
  });
  if (error || !signIn.session) abort(String(error?.message ?? "sign-in"));
  const userId = signIn.user?.id ?? SMOKE_USER_ID;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });

  const steps = [
    ["set A paasmurt", { p_action: "SET", p_choice_key: "paasmurt", p_item_key: "default" }],
    ["cancel", { p_action: "CANCEL" }],
    ["set B salatboks/skinke", { p_action: "SET", p_choice_key: "salatboks", p_item_key: "skinke" }],
    ["cancel", { p_action: "CANCEL" }],
    ["set C varmmat", { p_action: "SET", p_choice_key: "varmmat", p_item_key: "default" }],
  ];

  for (const [label, params] of steps) {
    const { error: rpcErr } = await client.rpc("lp_order_set", {
      p_date: DATE,
      p_slot: "default",
      ...params,
    });
    if (rpcErr) {
      console.error("RPC failed", label, rpcErr);
      process.exit(1);
    }
    await dump(label, userId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
