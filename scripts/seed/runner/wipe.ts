/**
 * Wipe all Variant C staging test data (@staging.lunchportalen.test).
 *
 * Usage: npm run seed:wipe -- --target staging --confirm
 * Dry-run (default): npm run seed:wipe -- --target staging
 */
import type pg from "pg";

import { listStagingAuthUsers } from "../auth/admin-api.js";
import { parallelDeleteAuthUsers } from "../auth/parallel.js";
import { closePool, getPool } from "../core/pool.js";
import { loadSeedEnv, STAGING_EMAIL_DOMAIN, STAGING_REF, type SeedEnv } from "../core/env.js";
import { createBatchLogger, initLogger, logEvent } from "../core/logger.js";

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

const SCALE_WIPE_PROFILE_THRESHOLD = 50;
const ORPHAN_PARALLEL_AUTH_THRESHOLD = 100;
const ORPHAN_DELETE_WORKERS = 10;
const ORPHAN_DELETE_PROGRESS_EVERY = 1000;

async function wipeDatabase(client: pg.PoolClient, profileCount: number): Promise<void> {
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

  if (profileCount >= SCALE_WIPE_PROFILE_THRESHOLD) {
    await client.query(
      `DELETE FROM public.location_memberships WHERE user_id IN (
        SELECT id FROM public.profiles WHERE lower(email) LIKE lower($1)
      )`,
      [EMAIL_PATTERN],
    );
    await client.query(
      `DELETE FROM public.company_memberships WHERE user_id IN (
        SELECT id FROM public.profiles WHERE lower(email) LIKE lower($1)
      )`,
      [EMAIL_PATTERN],
    );
    await client.query(`DELETE FROM public.profiles WHERE lower(email) LIKE lower($1)`, [
      EMAIL_PATTERN,
    ]);
  } else if (profileIds.length > 0) {
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

async function deleteStagingAuth(env: SeedEnv, profileCount: number): Promise<number> {
  const users = await listStagingAuthUsers(env);
  const ids = users.map((u) => u.id);
  const authCount = ids.length;

  if (authCount === 0) return 0;

  const parallelOrphan =
    profileCount === 0 && authCount > ORPHAN_PARALLEL_AUTH_THRESHOLD;
  const scaleProfile = profileCount >= SCALE_WIPE_PROFILE_THRESHOLD;

  if (!parallelOrphan && !scaleProfile) {
    return parallelDeleteAuthUsers(env, ids, { workers: 1 });
  }

  const batch = createBatchLogger(RUNNER, authCount, "auth_delete_progress");
  let lastPct = -1;
  let lastOrphanMilestone = 0;

  const deleted = await parallelDeleteAuthUsers(env, ids, {
    ...(parallelOrphan ? { workers: ORPHAN_DELETE_WORKERS } : {}),
    onProgress: (done, all) => {
      if (parallelOrphan) {
        const milestone = Math.floor(done / ORPHAN_DELETE_PROGRESS_EVERY) * ORPHAN_DELETE_PROGRESS_EVERY;
        if (milestone > lastOrphanMilestone && milestone > 0) {
          lastOrphanMilestone = milestone;
          logEvent(RUNNER, {
            action: "auth_delete_progress",
            count: done,
            message: `orphan_parallel of=${all}`,
          });
        }
      }
      if (scaleProfile) {
        const pct = all > 0 ? Math.floor((done / all) * 100) : 100;
        if (pct >= 25 && pct % 25 === 0 && pct !== lastPct) {
          lastPct = pct;
          batch.tick(done, `pct=${pct}`);
        }
      }
    },
  });
  batch.finish(`deleted=${deleted} orphan_parallel=${parallelOrphan}`);
  return deleted;
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

    const profileCount = counts.profiles;

    await client.query("BEGIN");
    try {
      await wipeDatabase(client, profileCount);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    const authDeleted = await deleteStagingAuth(cli, profileCount);
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
