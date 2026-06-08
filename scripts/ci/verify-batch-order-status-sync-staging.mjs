#!/usr/bin/env node
/**
 * Staging (uigx) — Model B loop verify: batch PACKED/DELIVERED derives orders.status.
 * Prerequisites: migrations applied, seed-staging-tenant.sql, stage4-realistic-fixture-seed.mjs,
 * stage4b-provision-provider-memberships.mjs
 *
 * Uses RPC directly (same path as handlers) with kitchen-a / driver-a actor IDs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  SMOKE_COMPANY_ID,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
  SMOKE_EMPLOYEE_A1,
  SMOKE_KITCHEN_USER_A,
  SMOKE_DRIVER_USER_A,
  SMOKE_OPERATIVE_SLOT,
  REALISTIC_ORDER_IDS,
} from "../smoke/fixtures/stage4-realistic.constants.mjs";
import { loadEnvFiles, normalizePgUrl, resolveStagingDatabaseUrl } from "../smoke/resolve-staging-database-url.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(root);

const picked = resolveStagingDatabaseUrl();
if (!picked) {
  console.error("ABORT: uigx DATABASE_URL only (set STAGING_DATABASE_URL or use staging env extract)");
  process.exit(2);
}
const url = picked.url;

const orderDate = SMOKE_ORDER_DATE;
const orderId = REALISTIC_ORDER_IDS.a1;

const client = new pg.Client({ connectionString: normalizePgUrl(url), ssl: { rejectUnauthorized: false } });
await client.connect();

async function rpc(name, params) {
  const keys = Object.keys(params);
  const vals = Object.values(params);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `select public.${name}(${placeholders}) as result`;
  const { rows } = await client.query(sql, vals);
  return rows[0]?.result;
}

try {
  const fnCheck = await client.query(
    `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'lp_batch_transition_and_sync_orders'`,
  );
  if (fnCheck.rowCount === 0) {
    const migPath = path.join(root, "supabase/migrations/20260713120000_batch_order_status_sync.sql");
    const sql = fs.readFileSync(migPath, "utf8");
    await client.query(sql);
    console.log("APPLIED_MIGRATION", "20260713120000_batch_order_status_sync.sql");
  }

  await client.query("begin");

  await client.query(
    `delete from public.kitchen_batches
     where delivery_date = $1::date and company_location_id = $2::uuid`,
    [orderDate, SMOKE_LOCATION_ID],
  );

  await client.query(`alter table public.orders disable trigger guard_order_mutation`);
  await client.query(
    `insert into public.orders (id, user_id, company_id, location_id, date, status, slot, note, created_at, updated_at)
     values ($1,$2,$3,$4,$5::date,'ACTIVE',$6,'loop-verify',now(),now())
     on conflict (id) do update set date = excluded.date, status = 'ACTIVE', slot = excluded.slot, updated_at = now()`,
    [orderId, SMOKE_EMPLOYEE_A1, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, orderDate, SMOKE_OPERATIVE_SLOT],
  );
  await client.query(
    `insert into public.day_choices (user_id, company_id, location_id, date, choice_key, status, updated_at)
     values ($1,$2,$3,$4::date,'varmmat','ACTIVE',now())
     on conflict on constraint day_choices_company_location_user_date_key do update set status = 'ACTIVE', updated_at = now()`,
    [SMOKE_EMPLOYEE_A1, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, orderDate],
  );
  await client.query(`alter table public.orders enable trigger guard_order_mutation`);

  const packed = await rpc("lp_batch_transition_and_sync_orders", {
    p_delivery_date: orderDate,
    p_delivery_window: SMOKE_OPERATIVE_SLOT,
    p_company_location_id: SMOKE_LOCATION_ID,
    p_target_batch_status: "PACKED",
    p_actor_user_id: SMOKE_KITCHEN_USER_A,
    p_mode: "create",
  });

  const delivered = await rpc("lp_batch_transition_and_sync_orders", {
    p_delivery_date: orderDate,
    p_delivery_window: SMOKE_OPERATIVE_SLOT,
    p_company_location_id: SMOKE_LOCATION_ID,
    p_target_batch_status: "DELIVERED",
    p_actor_user_id: SMOKE_DRIVER_USER_A,
    p_mode: "from_packed",
  });

  const redeliver = await rpc("lp_batch_transition_and_sync_orders", {
    p_delivery_date: orderDate,
    p_delivery_window: SMOKE_OPERATIVE_SLOT,
    p_company_location_id: SMOKE_LOCATION_ID,
    p_target_batch_status: "DELIVERED",
    p_actor_user_id: SMOKE_DRIVER_USER_A,
    p_mode: "from_packed",
  });

  await client.query("commit");

  const orderStatus = (
    await client.query(`select status::text from public.orders where id = $1`, [orderId])
  ).rows[0]?.status;
  const batchStatus = (
    await client.query(
      `select status from public.kitchen_batches where delivery_date = $1::date and company_location_id = $2`,
      [orderDate, SMOKE_LOCATION_ID],
    )
  ).rows[0]?.status;
  const batchId = (
    await client.query(
      `select id from public.kitchen_batches where delivery_date = $1::date and company_location_id = $2`,
      [orderDate, SMOKE_LOCATION_ID],
    )
  ).rows[0]?.id;

  const history = (
    await client.query(
      `select to_status::text, note, changed_by from public.order_status_history where order_id = $1 order by changed_at`,
      [orderId],
    )
  ).rows;

  const derivedNotes = history.filter((h) => String(h.note ?? "").startsWith("derived:batch:"));
  const deliveredNote = derivedNotes.find((h) => h.note === `derived:batch:delivered:${batchId}`);

  const failures = [];
  if (!packed?.ok) failures.push("packed rpc failed");
  if (!delivered?.ok) failures.push("delivered rpc failed");
  if (!redeliver?.ok) failures.push("redeliver rpc failed");
  if (orderStatus !== "DELIVERED") failures.push(`order status=${orderStatus}, expected DELIVERED`);
  if (batchStatus !== "DELIVERED") failures.push(`batch status=${batchStatus}, expected DELIVERED`);
  if (!deliveredNote) failures.push("missing derived:batch:delivered history note");
  if (deliveredNote && String(deliveredNote.changed_by) !== SMOKE_DRIVER_USER_A) {
    failures.push("delivered history changed_by is not driver-a");
  }
  if (redeliver?.batch_updated !== false) failures.push("idempotent redeliver should not update batch");
  if ((redeliver?.sync?.advanced ?? 0) > 0) failures.push("idempotent redeliver should advance 0 orders");

  console.log(
    "BATCH_ORDER_STATUS_SYNC_VERIFY",
    JSON.stringify({
      orderDate,
      orderId,
      batchId,
      packed,
      delivered,
      redeliver,
      orderStatus,
      batchStatus,
      derivedNotes: derivedNotes.map((h) => ({ to: h.to_status, note: h.note, by: h.changed_by })),
      failures,
    }),
  );

  if (failures.length) {
    console.error("VERIFY_FAIL", failures);
    process.exit(1);
  }

  console.log("BATCH_ORDER_STATUS_SYNC_VERIFY_OK");
} catch (e) {
  try {
    await client.query("rollback");
  } catch {
    /* ignore */
  }
  console.error("BATCH_ORDER_STATUS_SYNC_VERIFY_FAIL", e);
  process.exit(1);
} finally {
  await client.end();
}
