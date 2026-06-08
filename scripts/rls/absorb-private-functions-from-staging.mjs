#!/usr/bin/env node
/**
 * Merge selected private.* function hashes from staging (uigx, pipeline-applied)
 * into tests/rls/golden-rls-snapshot.json (prod ref pin unchanged).
 *
 * Fail-closed: staging ref only; golden project_ref must stay prod pin.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { mapVolatility, createSupabasePoolConfig } from "./golden-snapshot-lib.mjs";
import {
  loadEnvFiles,
  normalizePgUrl,
  resolveStagingDatabaseUrl,
  STAGING_REF,
  PROD_REF,
} from "../smoke/resolve-staging-database-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const goldenPath = join(root, "tests", "rls", "golden-rls-snapshot.json");

/** #146 Model B — private functions only (golden tracks private schema). */
const ABSORB_NAMES = [
  "lp_assert_provider_kitchen_access_for",
  "lp_assert_provider_batch_delivered_actor",
  "lp_resolve_provider_for_location",
  "lp_order_advance_one_step_for_batch",
  "lp_sync_orders_for_batch_scope",
];

const SQL = `
SELECT
  p.proname AS name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS is_security_definer,
  p.provolatile::text AS provolatile,
  md5(pg_get_functiondef(p.oid)) AS body_hash
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname = ANY($1::text[])
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
`;

loadEnvFiles(root);
const picked = resolveStagingDatabaseUrl();
if (!picked?.url?.includes(STAGING_REF)) {
  console.error("ABORT: uigx staging DATABASE_URL required");
  process.exit(2);
}

const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
if (golden.project_ref !== PROD_REF) {
  console.error(`ABORT: golden.project_ref must stay ${PROD_REF}, got ${golden.project_ref}`);
  process.exit(2);
}

const pool = new pg.Pool(createSupabasePoolConfig(normalizePgUrl(picked.url), 2));
try {
  const { rows } = await pool.query(SQL, [ABSORB_NAMES]);
  if (rows.length !== ABSORB_NAMES.length) {
    const found = new Set(rows.map((r) => r.name));
    const missing = ABSORB_NAMES.filter((n) => !found.has(n));
    console.error("ABORT: missing functions on staging (pipeline migration not applied?)", missing);
    process.exit(1);
  }

  const incoming = rows.map((r) => ({
    name: String(r.name),
    args: String(r.args),
    result_type: String(r.result_type),
    is_security_definer: Boolean(r.is_security_definer),
    volatility: mapVolatility(r.provolatile),
    body_hash: String(r.body_hash),
  }));

  const byKey = new Map(golden.private_functions.map((f) => [`${f.name}(${f.args})`, f]));
  for (const fn of incoming) {
    byKey.set(`${fn.name}(${fn.args})`, fn);
  }

  golden.private_functions = [...byKey.values()].sort((a, b) => {
    const c = a.name.localeCompare(b.name, "en");
    return c !== 0 ? c : a.args.localeCompare(b.args, "en");
  });

  writeFileSync(goldenPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");
  console.log(
    "GOLDEN_ABSORB_OK",
    JSON.stringify({
      stagingRef: STAGING_REF,
      goldenProjectRef: golden.project_ref,
      absorbed: incoming.map((f) => f.name),
      privateFunctionCount: golden.private_functions.length,
    }),
  );
} finally {
  await pool.end();
}
