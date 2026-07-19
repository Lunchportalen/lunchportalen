#!/usr/bin/env node
/**
 * LOCAL-ONLY batched ACTIVE order preload (setup).
 * Commits in small batches so capacity/commission triggers do not stall one 100k txn.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadPhase18Env, assertNotProduction, MARK } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const DB_CONTAINER = process.env.PHASE18_DB_CONTAINER || "supabase_db_lunchportalen";

function envInt(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

function psqlFile(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  if (!/127\.0\.0\.1|localhost|kong/i.test(url)) throw new Error("BULK_ORDERS_LOCAL_ONLY");

  const serviceDate = process.env.PHASE18_SERVICE_DATE;
  if (!serviceDate) throw new Error("PHASE18_SERVICE_DATE required");
  const target = envInt("PHASE18_ORDER_PRELOAD_TARGET") ?? 100000;
  const batch = envInt("PHASE18_ORDER_PRELOAD_BATCH") ?? 500;

  const agreements = Number(
    psql(
      `select count(*) from agreements a join companies c on c.id=a.company_id where c.contact_email like 'p18scale-%' and a.status='ACTIVE'`,
    ) || "0",
  );
  if (agreements < 2000) throw new Error(`NEED_AGREEMENTS: have ${agreements}`);

  // Raise capacity pools so bulk setup is not blocked (synthetic load only).
  psqlFile(`
INSERT INTO dish_day_capacity (provider_id, service_date, choice_key, capacity_limit, reserved_qty)
SELECT p.id, '${serviceDate}'::date, 'varmmat', 500000, 0
FROM providers p
WHERE p.slug LIKE 'p18scale-%'
ON CONFLICT (provider_id, service_date, choice_key) DO UPDATE
SET capacity_limit = greatest(dish_day_capacity.capacity_limit, 500000);
`);

  let totalInserted = 0;
  for (let offset = 0; offset < target; offset += batch) {
    const sql = `
BEGIN;
WITH emp AS (
  SELECT p.id AS user_id, p.company_id, p.location_id, c.provider_id,
         a.id AS agreement_id, a.tier,
         CASE a.tier::text
           WHEN 'LUXUS' THEN a.price_per_meal_luxus_nok
           WHEN 'ENTERPRISE' THEN coalesce(a.price_per_meal_enterprise_nok, 170)
           ELSE a.price_per_meal_nok
         END AS unit_price_nok,
         msd.id AS menu_service_day_id,
         msdi.id AS menu_service_day_item_id,
         msdi.product_id,
         msdi.product_name_snapshot,
         msdi.unit_name_snapshot,
         msdi.offered_price_cents_ex_vat,
         msdi.vat_rate_snapshot
  FROM profiles p
  JOIN companies c ON c.id = p.company_id
  JOIN agreements a ON a.company_id = c.id AND a.status = 'ACTIVE'
  JOIN menu_service_days msd ON msd.location_id = p.location_id AND msd.service_date = '${serviceDate}'::date AND msd.state = 'published'
  JOIN menu_service_day_items msdi ON msdi.menu_service_day_id = msd.id
  WHERE p.email LIKE 'p18scale-emp-%@load.lunchportalen.test'
    AND p.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.user_id = p.id AND o.date = '${serviceDate}'::date AND o.status = 'ACTIVE'
    )
  ORDER BY p.email
  LIMIT ${batch}
),
new_orders AS (
  INSERT INTO orders (
    user_id, company_id, location_id, provider_id, agreement_id, tier,
    unit_price_nok, date, service_date, status, slot, source,
    menu_service_day_id, currency_code, created_by,
    subtotal_cents_ex_vat, vat_cents, gross_cents_inc_vat
  )
  SELECT
    e.user_id, e.company_id, e.location_id, e.provider_id, e.agreement_id, e.tier,
    e.unit_price_nok, '${serviceDate}'::date, '${serviceDate}'::date, 'ACTIVE', 'default', 'web',
    e.menu_service_day_id, 'NOK', e.user_id,
    e.offered_price_cents_ex_vat,
    round(e.offered_price_cents_ex_vat * e.vat_rate_snapshot)::int,
    e.offered_price_cents_ex_vat + round(e.offered_price_cents_ex_vat * e.vat_rate_snapshot)::int
  FROM emp e
  RETURNING id, user_id
),
items AS (
  INSERT INTO order_items (
    order_id, product_id, menu_service_day_item_id, quantity,
    product_name_snapshot, unit_name_snapshot, unit_price_cents_ex_vat, vat_rate_snapshot,
    line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat
  )
  SELECT
    o.id, e.product_id, e.menu_service_day_item_id, 1,
    e.product_name_snapshot, e.unit_name_snapshot, e.offered_price_cents_ex_vat, e.vat_rate_snapshot,
    e.offered_price_cents_ex_vat,
    round(e.offered_price_cents_ex_vat * e.vat_rate_snapshot)::int,
    e.offered_price_cents_ex_vat + round(e.offered_price_cents_ex_vat * e.vat_rate_snapshot)::int
  FROM new_orders o
  JOIN emp e ON e.user_id = o.user_id
  RETURNING order_id
)
SELECT count(*) FROM new_orders;
COMMIT;
`;
    const inserted = Number(psqlFile(sql).split("\n").filter(Boolean).pop() || "0");
    totalInserted += inserted;
    const active = Number(
      psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE'`) || "0",
    );
    console.log(JSON.stringify({ offset, batch, inserted, active, target }));
    if (inserted === 0) break;
    if (active >= target) break;
  }

  const after = Number(
    psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE'`) || "0",
  );
  const withItems = Number(
    psql(
      `select count(distinct o.id) from orders o join order_items i on i.order_id=o.id where o.service_date='${serviceDate}' and o.status='ACTIVE'`,
    ) || "0",
  );
  const missingProvider = Number(
    psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE' and provider_id is null`) || "0",
  );
  const missingCompany = Number(
    psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE' and company_id is null`) || "0",
  );
  const missingEmployee = Number(
    psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE' and user_id is null`) || "0",
  );
  const missingAgreement = Number(
    psql(`select count(*) from orders where service_date='${serviceDate}' and status='ACTIVE' and agreement_id is null`) || "0",
  );

  const report = {
    phase: "18SCALE",
    MARK,
    mode: "local_sql_bulk_batched",
    service_date: serviceDate,
    target,
    totalInserted,
    LOCAL_ACTIVE_ORDERS: after,
    ORDERS_WITH_ITEMS: withItems,
    ORDERS_WITHOUT_PROVIDER: missingProvider,
    ORDERS_WITHOUT_COMPANY: missingCompany,
    ORDERS_WITHOUT_EMPLOYEE: missingEmployee,
    ORDERS_WITHOUT_AGREEMENT: missingAgreement,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "preload-orders-bulk-local.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (after < target * 0.99 || missingProvider || missingCompany || missingEmployee || missingAgreement) {
    process.exit(2);
  }
}

main();
