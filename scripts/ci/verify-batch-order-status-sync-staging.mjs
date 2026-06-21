#!/usr/bin/env node
/**
 * Staging (uigx) — Model B loop verify via pipeline-applied schema (no MCP apply).
 * Requires: db push applied 20260713120000, stage4b-provision-provider-memberships (inline).
 */
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

const root = process.cwd();
loadEnvFiles(root);

const picked = resolveStagingDatabaseUrl();
if (!picked) {
  console.error("ABORT: uigx DATABASE_URL only");
  process.exit(2);
}
const url = picked.url;

const orderId = REALISTIC_ORDER_IDS.a1;

const client = new pg.Client({ connectionString: normalizePgUrl(url), ssl: { rejectUnauthorized: false } });
await client.connect();

async function rpc(name, params) {
  const keys = Object.keys(params);
  const vals = Object.values(params);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await client.query(`select public.${name}(${placeholders}) as result`, vals);
  return rows[0]?.result;
}

async function ensureProviderMemberships(locationId) {
  const { rows } = await client.query(
    `select private.lp_resolve_provider_for_location($1::uuid) as provider_id`,
    [locationId],
  );
  const providerId = rows[0]?.provider_id;
  if (!providerId) throw new Error("PROVIDER_NOT_RESOLVED");

  await client.query(
    `insert into public.provider_memberships (user_id, provider_id, role)
     values ($1, $2, 'provider_kitchen'::public.provider_role)
     on conflict (user_id, provider_id) do update set role = excluded.role`,
    [SMOKE_KITCHEN_USER_A, providerId],
  );
  await client.query(
    `insert into public.provider_memberships (user_id, provider_id, role)
     values ($1, $2, 'provider_viewer'::public.provider_role)
     on conflict (user_id, provider_id) do update set role = excluded.role`,
    [SMOKE_DRIVER_USER_A, providerId],
  );
  return providerId;
}

try {
  const fnCheck = await client.query(
    `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'lp_batch_transition_and_sync_orders'`,
  );
  if (fnCheck.rowCount === 0) {
    console.error("ABORT: lp_batch_transition_and_sync_orders missing — run db push via pipeline first");
    process.exit(1);
  }

  const ledger = await client.query(
    `select version from supabase_migrations.schema_migrations where version = '20260713120000'`,
  );
  if (ledger.rowCount === 0) {
    console.error("ABORT: migration 20260713120000 not in ledger — pipeline db push required");
    process.exit(1);
  }

  const oslo = (await client.query(`select public.oslo_time()::text as t`)).rows[0];
  // Deterministic fixture date (seeded menu on staging) — not oslo_today() (weekends/holidays have no menu).
  const orderDate = SMOKE_ORDER_DATE;

  await ensureProviderMemberships(SMOKE_LOCATION_ID);

  await client.query("begin");

  await client.query(
    `delete from public.kitchen_batches
     where delivery_date = $1::date and company_location_id = $2::uuid`,
    [orderDate, SMOKE_LOCATION_ID],
  );

  await client.query(`alter table public.orders disable trigger guard_order_mutation`);
  await client.query(`alter table public.orders disable trigger orders_cutoff_0800`);
  await client.query(
    `insert into public.orders (id, user_id, company_id, location_id, date, status, slot, note, created_at, updated_at)
     values ($1,$2,$3,$4,$5::date,'ACTIVE',$6,'loop-verify-pipeline',now(),now())
     on conflict (id) do update set date = excluded.date, status = 'ACTIVE', slot = excluded.slot, updated_at = now()`,
    [orderId, SMOKE_EMPLOYEE_A1, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, orderDate, SMOKE_OPERATIVE_SLOT],
  );
  await client.query(
    `insert into public.day_choices (user_id, company_id, location_id, date, choice_key, status, updated_at)
     values ($1,$2,$3,$4::date,'varmmat','ACTIVE',now())
     on conflict on constraint day_choices_company_location_user_date_key do update set status = 'ACTIVE', updated_at = now()`,
    [SMOKE_EMPLOYEE_A1, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, orderDate],
  );
  await client.query(`alter table public.orders enable trigger orders_cutoff_0800`);
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

  const orderStatus = (await client.query(`select status::text from public.orders where id = $1`, [orderId])).rows[0]
    ?.status;
  const batchRow = (
    await client.query(
      `select id, status from public.kitchen_batches where delivery_date = $1::date and company_location_id = $2`,
      [orderDate, SMOKE_LOCATION_ID],
    )
  ).rows[0];

  const history = (
    await client.query(
      `select to_status::text, note, changed_by::text from public.order_status_history where order_id = $1 order by changed_at`,
      [orderId],
    )
  ).rows;

  const derivedNotes = history.filter((h) => String(h.note ?? "").startsWith("derived:batch:"));
  const deliveredNote = derivedNotes.find((h) => h.note === `derived:batch:delivered:${batchRow?.id}`);

  const failures = [];
  if (!packed?.ok) failures.push("packed rpc failed");
  if (!delivered?.ok) failures.push("delivered rpc failed");
  if (!redeliver?.ok) failures.push("redeliver rpc failed");
  if (orderStatus !== "DELIVERED") failures.push(`order status=${orderStatus}, expected DELIVERED`);
  if (batchRow?.status !== "DELIVERED") failures.push(`batch status=${batchRow?.status}, expected DELIVERED`);
  if (!deliveredNote) failures.push("missing derived:batch:delivered history note");
  if (deliveredNote && deliveredNote.changed_by !== SMOKE_DRIVER_USER_A) {
    failures.push("delivered history changed_by is not driver-a");
  }
  if (redeliver?.batch_updated !== false) failures.push("idempotent redeliver should not update batch");
  if ((redeliver?.sync?.advanced ?? 0) > 0) failures.push("idempotent redeliver should advance 0 orders");

  if (oslo.t >= "08:00:00") {
    let cutoffBlocked = false;
    try {
      await client.query(`update public.orders set note = 'employee-cutoff-probe' where id = $1`, [orderId]);
    } catch (e) {
      const msg = String(e?.message ?? "");
      // Cutoff trigger or guard_order_mutation — both fail-closed without app.batch_derived_advance.
      if (
        msg.includes("orders locked after 08:00") ||
        msg.includes("Order is locked and cannot be changed")
      ) {
        cutoffBlocked = true;
      } else {
        failures.push(`employee cutoff unexpected error: ${msg || e}`);
      }
    }
    if (!cutoffBlocked) {
      failures.push("employee path should be blocked after 08:00 Oslo without batch_derived_advance GUC");
    }
  } else {
    console.log("EMPLOYEE_CUTOFF_SKIP", "before 08:00 Oslo — cutoff probe deferred");
  }

  console.log(
    "BATCH_ORDER_STATUS_SYNC_VERIFY",
    JSON.stringify({
      orderDate,
      orderId,
      batchId: batchRow?.id,
      ledgerVersion: "20260713120000",
      packed,
      delivered,
      redeliver,
      orderStatus,
      batchStatus: batchRow?.status,
      derivedNotes: derivedNotes.map((h) => ({ to: h.to_status, note: h.note, by: h.changed_by })),
      employeeCutoffProbe: oslo.t >= "08:00:00" ? "ran" : "skipped",
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
