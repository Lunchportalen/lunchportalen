#!/usr/bin/env node
/**
 * Stage 4-B — provider_memberships for kitchen-a@ / driver-a@ on location's active provider (uigx only).
 * Run after stage4-realistic-fixture-seed.mjs and before batch loop verify.
 */
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_LOCATION_ID,
  SMOKE_KITCHEN_USER_A,
  SMOKE_DRIVER_USER_A,
} from "./fixtures/stage4-realistic.constants.mjs";
import { loadEnvFiles, normalizePgUrl, resolveStagingDatabaseUrl } from "./resolve-staging-database-url.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvFiles(root);

const picked = resolveStagingDatabaseUrl();
if (!picked) {
  console.error("ABORT: uigx DATABASE_URL only (set STAGING_DATABASE_URL or use staging env extract)");
  process.exit(2);
}
const url = picked.url;

const client = new pg.Client({ connectionString: normalizePgUrl(url), ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows } = await client.query(
    `select private.lp_resolve_provider_for_location($1::uuid) as provider_id`,
    [SMOKE_LOCATION_ID],
  );
  const providerId = rows[0]?.provider_id;
  if (!providerId) {
    throw new Error(`No provider resolved for location ${SMOKE_LOCATION_ID}`);
  }

  await client.query("begin");
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
  await client.query("commit");
  console.log(
    "STAGE4B_PROVIDER_MEMBERSHIPS_OK",
    JSON.stringify({ provider_id: providerId, kitchen: SMOKE_KITCHEN_USER_A, driver: SMOKE_DRIVER_USER_A }),
  );
} catch (e) {
  await client.query("rollback");
  console.error("STAGE4B_PROVIDER_MEMBERSHIPS_FAIL", e);
  process.exit(1);
} finally {
  await client.end();
}
