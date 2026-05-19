/**
 * B4-F1 hello seed — 1 company, 1 location, 10 auth.users + profiles.
 *
 * Usage: npm run seed:hello -- --target staging
 */
import type pg from "pg";

import {
  createAuthUser,
  stagingPasswordForEmail,
} from "../auth/admin-api.js";
import { closePool, getPool } from "../core/pool.js";
import { loadSeedEnv, STAGING_REF } from "../core/env.js";
import { formatEntityHashes, initLogger, logEvent, timed } from "../core/logger.js";
import {
  buildHelloUsers,
  helloCompany,
  helloCompanyId,
  helloLocationId,
  helloLocationName,
} from "../faker-norwegian/index.js";

const RUNNER = "hello";

async function insertTenant(
  client: pg.PoolClient,
  company: ReturnType<typeof helloCompany>,
  adminUserId: string,
): Promise<{ companyId: string; locationId: string }> {
  const companyId = helloCompanyId();
  const locationId = helloLocationId();

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO public.companies (
        id, name, status, orgnr, contact_name, contact_email, contact_phone,
        address, employee_count, created_by, default_location_id
      ) VALUES (
        $1, $2, 'ACTIVE', $3, $4, $5, $6,
        $7, $8, $9, NULL
      )`,
      [
        companyId,
        company.name,
        company.orgnr,
        company.contactName,
        company.contactEmail,
        company.contactPhone,
        `${company.address}, ${company.postalCode} ${company.city}`,
        10,
        adminUserId,
      ],
    );

    await client.query(
      `INSERT INTO public.company_locations (
        id, company_id, name, address, status
      ) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [locationId, companyId, helloLocationName(), company.address],
    );

    await client.query(
      `UPDATE public.companies SET default_location_id = $1, updated_at = now() WHERE id = $2`,
      [locationId, companyId],
    );

    await client.query("COMMIT");
    return { companyId, locationId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function insertProfile(
  client: pg.PoolClient,
  user: ReturnType<typeof buildHelloUsers>[number],
  companyId: string,
  locationId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO public.profiles (
      id, email, full_name, role, company_id, location_id, phone, active, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)`,
    [
      user.userId,
      user.email,
      user.fullName,
      user.role,
      companyId,
      locationId,
      user.phone,
    ],
  );
}

async function smokeCheck(client: pg.PoolClient): Promise<void> {
  const domain = "%@staging.lunchportalen.test";
  const profiles = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.profiles WHERE lower(email) LIKE lower($1)`,
    [domain],
  );
  const memberships = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c
     FROM public.company_memberships cm
     JOIN public.profiles p ON p.id = cm.user_id
     WHERE lower(p.email) LIKE lower($1)`,
    [domain],
  );

  const profileCount = Number(profiles.rows[0]?.c ?? 0);
  const membershipCount = Number(memberships.rows[0]?.c ?? 0);

  logEvent(RUNNER, { action: "smoke_profiles", table: "profiles", count: profileCount });
  logEvent(RUNNER, {
    action: "smoke_company_memberships",
    table: "company_memberships",
    count: membershipCount,
  });

  if (profileCount !== 10) {
    throw new Error(`SMOKE_FAIL profiles expected=10 actual=${profileCount}`);
  }
  if (membershipCount < 10) {
    throw new Error(`SMOKE_FAIL company_memberships expected>=10 actual=${membershipCount}`);
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const argv = process.argv.slice(2);
  const env = loadSeedEnv(argv);

  initLogger(RUNNER);
  logEvent(RUNNER, { action: "start", message: `target_ref=${STAGING_REF}` });

  const users = buildHelloUsers();
  const company = helloCompany();
  const pool = await getPool(env);
  const client = await pool.connect();

  try {
    const adminUser = users[0];
    if (!adminUser) throw new Error("HELLO_USERS_EMPTY");

    await timed(RUNNER, "create_auth_users", "auth.users", async () => {
      for (const user of users) {
        await createAuthUser(env, {
          id: user.userId,
          email: user.email,
          password: stagingPasswordForEmail(user.email),
          role: user.role,
          fullName: user.fullName,
          phone: user.phone,
          companyId: helloCompanyId(),
          locationId: helloLocationId(),
        });
        await new Promise((r) => setTimeout(r, 150));
      }
      return users.length;
    });

    const { companyId, locationId } = await timed(
      RUNNER,
      "insert_tenant",
      "companies+company_locations",
      async () => insertTenant(client, company, adminUser.userId),
    );

    logEvent(RUNNER, { action: "tenant_created", table: "companies", count: 1 });
    logEvent(RUNNER, { action: "tenant_created", table: "company_locations", count: 1 });

    await timed(RUNNER, "insert_profiles", "profiles", async () => {
      for (const user of users) {
        await insertProfile(client, user, companyId, locationId);
      }
      return users.length;
    });

    await smokeCheck(client);

    logEvent(RUNNER, {
      action: "success",
      duration_ms: Date.now() - started,
      message: formatEntityHashes({ company: companyId, location: locationId }),
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
