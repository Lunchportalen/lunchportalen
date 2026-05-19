/**
 * Wipe all Variant C staging test data (@staging.lunchportalen.test).
 *
 * Usage: npm run seed:wipe -- --target staging --confirm
 * Dry-run (default): npm run seed:wipe -- --target staging
 */
import type pg from "pg";

import { deleteAllStagingAuthUsers } from "../auth/admin-api.js";
import { closePool, getPool } from "../core/pool.js";
import { loadSeedEnv, STAGING_EMAIL_DOMAIN, STAGING_REF } from "../core/env.js";
import { initLogger, logEvent } from "../core/logger.js";

const RUNNER = "wipe";
const EMAIL_PATTERN = `%${STAGING_EMAIL_DOMAIN}`;

async function countByEmail(client: pg.PoolClient): Promise<{
  profiles: number;
  companyMemberships: number;
  locationMemberships: number;
  companies: number;
  locations: number;
}> {
  const profilesRes = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.profiles WHERE lower(email) LIKE lower($1)`,
    [EMAIL_PATTERN],
  );
  const profileIds = await client.query<{ id: string }>(
    `SELECT id FROM public.profiles WHERE lower(email) LIKE lower($1)`,
    [EMAIL_PATTERN],
  );
  const ids = profileIds.rows.map((r) => r.id);

  let companyMemberships = 0;
  let locationMemberships = 0;
  if (ids.length > 0) {
    const cm = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.company_memberships WHERE user_id = ANY($1::uuid[])`,
      [ids],
    );
    const lm = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.location_memberships WHERE user_id = ANY($1::uuid[])`,
      [ids],
    );
    companyMemberships = Number(cm.rows[0]?.c ?? 0);
    locationMemberships = Number(lm.rows[0]?.c ?? 0);
  }

  const companyIdsRes = await client.query<{ company_id: string | null }>(
    `SELECT DISTINCT company_id FROM public.profiles WHERE lower(email) LIKE lower($1) AND company_id IS NOT NULL`,
    [EMAIL_PATTERN],
  );
  const companyIds = companyIdsRes.rows
    .map((r) => r.company_id)
    .filter((id): id is string => Boolean(id));

  let locations = 0;
  if (companyIds.length > 0) {
    const loc = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM public.company_locations WHERE company_id = ANY($1::uuid[])`,
      [companyIds],
    );
    locations = Number(loc.rows[0]?.c ?? 0);
  }

  return {
    profiles: Number(profilesRes.rows[0]?.c ?? 0),
    companyMemberships,
    locationMemberships,
    companies: companyIds.length,
    locations,
  };
}

async function wipeDatabase(client: pg.PoolClient): Promise<void> {
  const profileRows = await client.query<{ id: string; company_id: string | null }>(
    `SELECT id, company_id FROM public.profiles WHERE lower(email) LIKE lower($1)`,
    [EMAIL_PATTERN],
  );
  const profileIds = profileRows.rows.map((r) => r.id);
  const companyIds = [
    ...new Set(
      profileRows.rows.map((r) => r.company_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  if (profileIds.length > 0) {
    await client.query(`DELETE FROM public.location_memberships WHERE user_id = ANY($1::uuid[])`, [
      profileIds,
    ]);
    await client.query(`DELETE FROM public.company_memberships WHERE user_id = ANY($1::uuid[])`, [
      profileIds,
    ]);
    await client.query(`DELETE FROM public.profiles WHERE id = ANY($1::uuid[])`, [profileIds]);
  }

  if (companyIds.length > 0) {
    await client.query(
      `UPDATE public.companies SET default_location_id = NULL WHERE id = ANY($1::uuid[])`,
      [companyIds],
    );
    await client.query(`DELETE FROM public.company_locations WHERE company_id = ANY($1::uuid[])`, [
      companyIds,
    ]);
    await client.query(`DELETE FROM public.companies WHERE id = ANY($1::uuid[])`, [companyIds]);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cli = loadSeedEnv(argv);
  const confirm = argv.includes("--confirm");

  initLogger(RUNNER);
  logEvent(RUNNER, {
    action: "start",
    message: `target_ref=${STAGING_REF} confirm=${confirm}`,
  });

  const pool = await getPool(cli);
  const client = await pool.connect();

  try {
    const counts = await countByEmail(client);
    logEvent(RUNNER, { action: "dry_run_counts", table: "profiles", count: counts.profiles });
    logEvent(RUNNER, {
      action: "dry_run_counts",
      table: "company_memberships",
      count: counts.companyMemberships,
    });
    logEvent(RUNNER, {
      action: "dry_run_counts",
      table: "location_memberships",
      count: counts.locationMemberships,
    });
    logEvent(RUNNER, { action: "dry_run_counts", table: "companies", count: counts.companies });
    logEvent(RUNNER, {
      action: "dry_run_counts",
      table: "company_locations",
      count: counts.locations,
    });

    if (!confirm) {
      logEvent(RUNNER, {
        action: "skipped",
        message: "Pass --confirm to delete. Dry-run only.",
      });
      return;
    }

    await client.query("BEGIN");
    try {
      await wipeDatabase(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    const authDeleted = await deleteAllStagingAuthUsers(cli);
    logEvent(RUNNER, { action: "auth_users_deleted", table: "auth.users", count: authDeleted });

    const after = await countByEmail(client);
    logEvent(RUNNER, { action: "complete", table: "profiles", count: after.profiles });
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  logEvent(RUNNER, {
    action: "fatal",
    level: "error",
    message: err instanceof Error ? err.message : String(err),
  });
  process.exitCode = 1;
});
