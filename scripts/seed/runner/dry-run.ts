/**
 * B4.1 dry-run — 100 companies × ~10K users on staging (Variant C).
 *
 * Usage: npm run seed:dry-run -- --target staging [--companies 100] [--total-users 10000] [--workers 10] [--seed 42]
 */
import type pg from "pg";

import { parallelCreateUsers, toParallelAuthSpecs } from "../auth/parallel.js";
import { buildSeedFingerprint } from "../core/fingerprint.js";
import { loadSeedEnv, STAGING_REF } from "../core/env.js";
import {
  createBatchLogger,
  initLogger,
  logEvent,
  summarizePerf,
  timed,
} from "../core/logger.js";
import { closePool, getPool } from "../core/pool.js";
import { F1_FIRST10_EMAILS_HASH, getCompanySizes, paretoStats } from "../core/pareto.js";
import {
  buildDryRunUsers,
  companyDataForIndex,
  dryRunCompanyId,
  dryRunLocationId,
  dryRunLocationLabel,
  type DryRunUserSpec,
} from "../faker-norwegian/index.js";

const RUNNER = "dry-run";
const PROFILE_BATCH_SIZE = 100;

type DryRunCli = {
  companies: number;
  totalUsers: number;
  workers: number;
  seed: number;
};

type CompanyPlan = {
  index: number;
  companyId: string;
  locationId: string;
  size: number;
  data: ReturnType<typeof companyDataForIndex>;
};

function parseArgs(argv: string[]): DryRunCli {
  const readNum = (flag: string, fallback: number): number => {
    const idx = argv.indexOf(flag);
    if (idx < 0 || !argv[idx + 1]) return fallback;
    const n = Number.parseInt(argv[idx + 1]!, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(`INVALID_ARG ${flag}`);
    }
    return n;
  };

  return {
    companies: readNum("--companies", 100),
    totalUsers: readNum("--total-users", 10_000),
    workers: readNum("--workers", 10),
    seed: readNum("--seed", 42),
  };
}

function assignUsersToCompanies(
  users: DryRunUserSpec[],
  sizes: number[],
): Array<{ plan: CompanyPlan; users: DryRunUserSpec[] }> {
  const plans: CompanyPlan[] = sizes.map((size, index) => ({
    index,
    companyId: dryRunCompanyId(index),
    locationId: dryRunLocationId(index),
    size,
    data: companyDataForIndex(index),
  }));

  let offset = 0;
  const out: Array<{ plan: CompanyPlan; users: DryRunUserSpec[] }> = [];

  for (const plan of plans) {
    const slice = users.slice(offset, offset + plan.size);
    if (slice.length !== plan.size) {
      throw new Error(
        `USER_ASSIGNMENT_MISMATCH company=${plan.index} expected=${plan.size} actual=${slice.length}`,
      );
    }
    out.push({ plan, users: slice });
    offset += plan.size;
  }

  return out;
}

async function insertProfilesBatch(
  client: pg.PoolClient,
  rows: DryRunUserSpec[],
  companyId: string,
  locationId: string,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += PROFILE_BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + PROFILE_BATCH_SIZE);
    const values: string[] = [];
    const params: unknown[] = [];
    let param = 1;

    for (let i = 0; i < chunk.length; i++) {
      const user = chunk[i]!;
      const role = offset === 0 && i === 0 ? "company_admin" : "employee";
      values.push(
        `($${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++}, $${param++}, true, true)`,
      );
      params.push(
        user.userId,
        user.email,
        user.fullName,
        role,
        companyId,
        locationId,
        user.phone,
      );
    }

    await client.query(
      `INSERT INTO public.profiles (
        id, email, full_name, role, company_id, location_id, phone, active, is_active
      ) VALUES ${values.join(", ")}`,
      params,
    );
  }
}

async function insertCompanyTx(
  client: pg.PoolClient,
  plan: CompanyPlan,
  users: DryRunUserSpec[],
): Promise<number> {
  const adminUserId = users[0]?.userId;
  if (!adminUserId) {
    throw new Error(`COMPANY_EMPTY_USERS index=${plan.index}`);
  }

  const c = plan.data;
  const addressLine = `${c.address}, ${c.postalCode} ${c.city}`;

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO public.companies (
        id, name, status, orgnr, contact_name, contact_email, contact_phone,
        address, employee_count, created_by, default_location_id
      ) VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6, $7, $8, $9, NULL)`,
      [
        plan.companyId,
        c.name,
        c.orgnr,
        c.contactName,
        c.contactEmail,
        c.contactPhone,
        addressLine,
        plan.size,
        adminUserId,
      ],
    );

    await client.query(
      `INSERT INTO public.company_locations (id, company_id, name, address, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [plan.locationId, plan.companyId, dryRunLocationLabel(plan.index), c.address],
    );

    await client.query(
      `UPDATE public.companies SET default_location_id = $1, updated_at = now() WHERE id = $2`,
      [plan.locationId, plan.companyId],
    );

    await insertProfilesBatch(client, users, plan.companyId, plan.locationId);
    await client.query("COMMIT");
    return users.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function smokeCheck(client: pg.PoolClient, expectedProfiles: number): Promise<void> {
  const domain = "%@staging.lunchportalen.test";
  const profiles = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.profiles WHERE lower(email) LIKE lower($1)`,
    [domain],
  );
  const count = Number(profiles.rows[0]?.c ?? 0);
  const tolerance = 10;
  if (Math.abs(count - expectedProfiles) > tolerance) {
    throw new Error(`SMOKE_FAIL profiles expected≈${expectedProfiles} actual=${count}`);
  }
  logEvent(RUNNER, { action: "smoke_profiles", table: "profiles", count });
}

async function main(): Promise<void> {
  const started = Date.now();
  const argv = process.argv.slice(2);
  const env = loadSeedEnv(argv);
  const cli = parseArgs(argv);

  initLogger(RUNNER);
  logEvent(RUNNER, {
    action: "start",
    message: `target_ref=${STAGING_REF} companies=${cli.companies} users=${cli.totalUsers} workers=${cli.workers} seed=${cli.seed}`,
  });

  const sizes = getCompanySizes({
    companies: cli.companies,
    targetUsers: cli.totalUsers,
    seed: cli.seed,
  });
  const stats = paretoStats(sizes);
  logEvent(RUNNER, {
    action: "pareto_distribution",
    count: stats.count,
    message: `sum=${stats.sum} min=${stats.min} max=${stats.max} p50=${stats.p50} p95=${stats.p95} ratio=${stats.ratioMaxMin.toFixed(2)}`,
  });

  const allUsers = buildDryRunUsers(cli.totalUsers);
  const assignments = assignUsersToCompanies(allUsers, sizes);

  const userCompanyPlan = new Map<number, CompanyPlan>();
  for (const { plan, users } of assignments) {
    for (const u of users) {
      userCompanyPlan.set(u.globalIndex, plan);
    }
  }

  const authSpecs = toParallelAuthSpecs(
    allUsers.map((u) => {
      const plan = userCompanyPlan.get(u.globalIndex);
      if (!plan) {
        throw new Error(`USER_WITHOUT_COMPANY globalIndex=${u.globalIndex}`);
      }
      const isCompanyAdmin =
        assignments.find((a) => a.plan.index === plan.index)?.users[0]?.globalIndex ===
        u.globalIndex;
      return {
        globalIndex: u.globalIndex,
        userId: u.userId,
        email: u.email,
        role: isCompanyAdmin ? ("company_admin" as const) : ("employee" as const),
        fullName: u.fullName,
        phone: u.phone,
        companyId: plan.companyId,
        locationId: plan.locationId,
      };
    }),
  );

  const authResult = await timed(RUNNER, "auth_phase", "auth.users", async () =>
    parallelCreateUsers(env, authSpecs, {
      workers: cli.workers,
      failureRateMax: 0.05,
    }),
  );

  const pool = await getPool(env);
  const client = await pool.connect();
  const tenantDurations: number[] = [];
  let companiesOk = 0;
  let companiesFailed = 0;

  const dbBatch = createBatchLogger(RUNNER, cli.companies, "db_company_progress");

  try {
    for (const { plan, users } of assignments) {
      const t0 = Date.now();
      try {
        const inserted = await insertCompanyTx(client, plan, users);
        companiesOk += 1;
        tenantDurations.push(Date.now() - t0);
        dbBatch.tick(companiesOk, `profiles=${inserted}`);
      } catch (err) {
        companiesFailed += 1;
        logEvent(RUNNER, {
          action: "company_tx_failed",
          level: "error",
          count: plan.index,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    dbBatch.finish(`ok=${companiesOk} failed=${companiesFailed}`);

    const companyFailureRate = cli.companies > 0 ? companiesFailed / cli.companies : 0;
    if (companyFailureRate > 0.05) {
      throw new Error(
        `DB_FAILURE_GATE company_failure_rate=${(companyFailureRate * 100).toFixed(2)}% failed=${companiesFailed}`,
      );
    }

    await smokeCheck(client, cli.totalUsers);

    const emails = allUsers.map((u) => u.email);
    const first10Emails = allUsers.filter((u) => u.globalIndex < 10).map((u) => u.email);
    const fingerprint = buildSeedFingerprint({
      emails,
      first10Emails,
      companyNames: assignments.map((a) => a.plan.data.name),
      locationNames: assignments.map((a) => dryRunLocationLabel(a.plan.index)),
    });

    if (fingerprint.first10_emails_hash !== F1_FIRST10_EMAILS_HASH) {
      throw new Error(
        `DETERMINISM_FAIL first10_emails_hash=${fingerprint.first10_emails_hash} expected=${F1_FIRST10_EMAILS_HASH}`,
      );
    }

    const tenantPerf = summarizePerf(tenantDurations);

    logEvent(RUNNER, {
      action: "fingerprint",
      count: fingerprint.email_count,
      message: `emails_hash=${fingerprint.emails_hash} first10=${fingerprint.first10_emails_hash} company_names_hash=${fingerprint.company_names_hash} location_names_hash=${fingerprint.location_names_hash}`,
    });

    logEvent(RUNNER, {
      action: "success",
      duration_ms: Date.now() - started,
      message: [
        `auth_success=${authResult.stats.success}`,
        `auth_throughput=${authResult.stats.throughput_per_sec.toFixed(2)}/s`,
        `auth_p95_ms=${authResult.stats.p95_ms}`,
        `auth_429=${authResult.stats.rate_limited_429}`,
        `tenant_p50_ms=${tenantPerf.p50_ms}`,
        `tenant_p95_ms=${tenantPerf.p95_ms}`,
        `companies_ok=${companiesOk}`,
      ].join(" "),
    });
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
