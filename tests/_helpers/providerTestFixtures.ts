/**
 * Provider-scoped integration fixtures (Patch 6 / 7).
 * Table DML via postgres connection; auth users via service_role Auth Admin API.
 */
import crypto from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { ensureIntegrationTestTableGrants, fixturePgQuery } from "./fixturePg";
import { createAccessToken, DEFAULT_PROVIDER_ID, type AuthUserFx } from "./rlsFixtures";
import { serviceRoleClient } from "./supabaseTestClient";

export type ProviderTestFixtures = {
  rid: string;
  admin: SupabaseClient<Database>;
  providerA: string;
  providerB: string;
  companyA: string;
  companyB: string;
  locA: string;
  locB: string;
  orderA: string | null;
  regA: string | null;
  regNull: string | null;
  providerAdminA: AuthUserFx;
  providerAdminB: AuthUserFx;
  superadmin: AuthUserFx;
  outsider: AuthUserFx;
  employeeA: AuthUserFx;
  companyAdminA: AuthUserFx | null;
  cleanup: () => Promise<void>;
};

function randEmail(prefix: string) {
  return `${prefix}.${crypto.randomUUID().slice(0, 8)}@test.lunchportalen.no`;
}

async function createAuthUser(admin: SupabaseClient<Database>, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
  return data.user.id as string;
}

async function insertProviders(
  providerA: string,
  providerB: string,
  rid: string,
  slugA: string,
  slugB: string,
) {
  await fixturePgQuery(
    `INSERT INTO public.providers (id, name, slug, contact_email, status, billing_model)
     VALUES ($1, $2, $3, $4, 'ACTIVE'::public.provider_status, 'SAAS_FIXED'),
            ($5, $6, $7, $8, 'ACTIVE'::public.provider_status, 'SAAS_FIXED')`,
    [
      providerA,
      `FX Provider A ${rid}`,
      slugA,
      `a.${rid}@test.lunchportalen.no`,
      providerB,
      `FX Provider B ${rid}`,
      slugB,
      `b.${rid}@test.lunchportalen.no`,
    ],
  );
}

async function insertCompanies(
  companyA: string,
  companyB: string,
  providerA: string,
  providerB: string,
  rid: string,
  orgBase: number,
) {
  await fixturePgQuery(
    `INSERT INTO public.companies (id, name, status, orgnr, provider_id)
     VALUES ($1, $2, 'ACTIVE', $3, $4), ($5, $6, 'ACTIVE', $7, $8)`,
    [
      companyA,
      `FX Co A ${rid}`,
      String(orgBase),
      providerA,
      companyB,
      `FX Co B ${rid}`,
      String(orgBase + 1),
      providerB,
    ],
  );
}

async function insertLocations(locA: string, locB: string, companyA: string, companyB: string, rid: string) {
  await fixturePgQuery(
    `INSERT INTO public.company_locations (id, company_id, name)
     VALUES ($1, $2, $3), ($4, $5, $6)`,
    [locA, companyA, `Loc A ${rid}`, locB, companyB, `Loc B ${rid}`],
  );
}

async function upsertProfile(
  userId: string,
  email: string,
  role: string,
  opts?: { company_id?: string | null; location_id?: string | null },
) {
  await fixturePgQuery(
    `INSERT INTO public.profiles (id, email, role, active, company_id, location_id)
     VALUES ($1, $2, $3::public.user_role, true, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       active = EXCLUDED.active,
       company_id = EXCLUDED.company_id,
       location_id = EXCLUDED.location_id`,
    [userId, email, role, opts?.company_id ?? null, opts?.location_id ?? null],
  );
}

async function ensureMenuServiceDayPg(
  menuDayId: string,
  companyId: string,
  locationId: string,
  providerId: string,
  serviceDate: string,
) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  await fixturePgQuery(
    `INSERT INTO public.menu_service_days (
       id, company_id, location_id, service_date, state, cutoff_at, provider_id, published_at
     ) VALUES ($1, $2, $3, $4::date, 'published'::public.menu_state, $5::timestamptz, $6::uuid, now())`,
    [menuDayId, companyId, locationId, serviceDate, cutoff.toISOString(), providerId],
  );
}

async function ensureActiveAgreementPg(companyId: string, locationId: string, providerId: string, startsAtISO: string) {
  await fixturePgQuery(
    `INSERT INTO public.agreements (
       company_id, location_id, provider_id, tier, status,
       delivery_days, slot_start, slot_end, starts_at
     ) VALUES ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', $4::jsonb, '11:00', '13:00', $5::timestamptz)`,
    [
      companyId,
      locationId,
      providerId,
      JSON.stringify(["mon", "tue", "wed", "thu", "fri"]),
      startsAtISO,
    ],
  );
}

async function insertProviderMembership(userId: string, providerId: string, role: string) {
  await fixturePgQuery(
    `INSERT INTO public.provider_memberships (user_id, provider_id, role)
     VALUES ($1, $2, $3::public.provider_role)`,
    [userId, providerId, role],
  );
}

export async function buildProviderTestFixtures(options?: {
  /** Patch 7: employee on company A for order + suspend tests */
  includeEmployee?: boolean;
  /** Patch 6: company_registrations RLS cases */
  includeRegistrations?: boolean;
  /** Who owns the fixture order row (default provider_admin A) */
  orderOwner?: "providerAdminA" | "employeeA";
  /** Patch 7 suspend cascade — fail fixture build if order cannot be created */
  requireOrder?: boolean;
  /** Patch 6 provider-RLS: company_admin on company A (avoids full buildRlsFixtures in parallel runs) */
  includeCompanyAdmin?: boolean;
}): Promise<ProviderTestFixtures> {
  const includeEmployee = options?.includeEmployee ?? false;
  const includeRegistrations = options?.includeRegistrations ?? true;
  const orderOwner = options?.orderOwner ?? "providerAdminA";
  const requireOrder = options?.requireOrder ?? false;
  const includeCompanyAdmin = options?.includeCompanyAdmin ?? false;

  const rid = crypto.randomUUID().slice(0, 8);
  const admin = serviceRoleClient();
  const providerA = crypto.randomUUID();
  const providerB = crypto.randomUUID();
  const slugA = `fx-a-${rid}`;
  const slugB = `fx-b-${rid}`;

  await insertProviders(providerA, providerB, rid, slugA, slugB);

  const companyA = crypto.randomUUID();
  const companyB = crypto.randomUUID();
  const orgBase = 200000000 + (parseInt(rid, 16) % 700000000);
  await insertCompanies(companyA, companyB, providerA, providerB, rid, orgBase);

  const locA = crypto.randomUUID();
  const locB = crypto.randomUUID();
  await insertLocations(locA, locB, companyA, companyB, rid);

  const mkUser = async (
    prefix: string,
    profileRole: "superadmin" | "employee" | "company_admin",
    membership?: { providerId: string; providerRole: string },
    profileExtra?: { company_id?: string; location_id?: string },
  ) => {
    const email = randEmail(prefix);
    const password = crypto.randomBytes(20).toString("hex");
    const user_id = await createAuthUser(admin, email, password);
    const accessToken = await createAccessToken(admin, email, password);
    await upsertProfile(user_id, email, profileRole, profileExtra);
    if (membership) {
      await insertProviderMembership(user_id, membership.providerId, membership.providerRole);
    }
    return { user_id, email, accessToken, access_token: accessToken } as AuthUserFx;
  };

  const providerAdminA = await mkUser("provadmin-a", "employee", {
    providerId: providerA,
    providerRole: "provider_admin",
  });
  const providerAdminB = await mkUser("provadmin-b", "employee", {
    providerId: providerB,
    providerRole: "provider_admin",
  });
  const superadmin = await mkUser("superadmin", "superadmin");
  const outsider = await mkUser("outsider", "employee");

  let employeeA = outsider;
  if (includeEmployee) {
    employeeA = await mkUser("employee-a", "employee", undefined, { company_id: companyA, location_id: locA });
  }

  let companyAdminA: AuthUserFx | null = null;
  if (includeCompanyAdmin) {
    companyAdminA = await mkUser("companyadmin-a", "company_admin", undefined, {
      company_id: companyA,
      location_id: locA,
    });
  }

  const now = new Date();
  const past = new Date(now);
  past.setUTCDate(past.getUTCDate() - 7);
  const startsAtISO = past.toISOString().slice(0, 10);

  const future = new Date(now);
  future.setUTCDate(future.getUTCDate() + 14);
  const orderDate = future.toISOString().slice(0, 10);

  await ensureActiveAgreementPg(companyA, locA, providerA, startsAtISO);

  const menuDayId = crypto.randomUUID();
  await ensureMenuServiceDayPg(menuDayId, companyA, locA, providerA, orderDate);

  let orderA: string | null = null;
  const orderId = crypto.randomUUID();
  const orderUserId = orderOwner === "employeeA" ? employeeA.user_id : providerAdminA.user_id;
  try {
    await fixturePgQuery(
      `INSERT INTO public.orders (id, user_id, date, company_id, location_id, provider_id, status, slot)
       VALUES ($1, $2, $3::date, $4, $5, $6, 'ACTIVE', 'default')`,
      [orderId, orderUserId, orderDate, companyA, locA, providerA],
    );
    orderA = orderId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (requireOrder) throw new Error(`insert order failed: ${msg}`);
    console.warn(`[providerTestFixtures] order insert skipped: ${msg}`);
  }

  let regA: string | null = null;
  let regNull: string | null = null;
  if (includeRegistrations) {
    regA = crypto.randomUUID();
    regNull = crypto.randomUUID();
    await fixturePgQuery(
      `INSERT INTO public.company_registrations (id, company_name, provider_id, status)
       VALUES ($1, $2, $3, 'pending'), ($4, $5, NULL, 'pending')`,
      [regA, `Reg A ${rid}`, providerA, regNull, `Reg Null ${rid}`],
    );
  }

  const authIds = [
    providerAdminA.user_id,
    providerAdminB.user_id,
    superadmin.user_id,
    outsider.user_id,
    ...(includeEmployee && employeeA.user_id !== outsider.user_id ? [employeeA.user_id] : []),
    ...(companyAdminA ? [companyAdminA.user_id] : []),
  ];

  async function cleanup() {
    if (orderA) {
      await fixturePgQuery(`DELETE FROM public.orders WHERE id = $1`, [orderA]);
    }
    await fixturePgQuery(`DELETE FROM public.menu_service_days WHERE id = $1`, [menuDayId]);
    await fixturePgQuery(`DELETE FROM public.agreements WHERE company_id = ANY($1::uuid[])`, [
      [companyA, companyB],
    ]);
    if (regA && regNull) {
      await fixturePgQuery(`DELETE FROM public.company_registrations WHERE id = ANY($1::uuid[])`, [
        [regA, regNull],
      ]);
    }
    await fixturePgQuery(
      `DELETE FROM public.lifecycle_audit_log
       WHERE entity_id = ANY($1::uuid[]) OR actor_id = ANY($2::uuid[])`,
      [[companyA, companyB, providerA, providerB, DEFAULT_PROVIDER_ID], authIds],
    );
    await fixturePgQuery(`DELETE FROM public.provider_memberships WHERE user_id = ANY($1::uuid[])`, [authIds]);
    await fixturePgQuery(`DELETE FROM public.profiles WHERE id = ANY($1::uuid[])`, [authIds]);
    await fixturePgQuery(`DELETE FROM public.company_locations WHERE id = ANY($1::uuid[])`, [[locA, locB]]);
    await fixturePgQuery(`DELETE FROM public.companies WHERE id = ANY($1::uuid[])`, [[companyA, companyB]]);
    await fixturePgQuery(`DELETE FROM public.providers WHERE id = ANY($1::uuid[])`, [[providerA, providerB]]);
    for (const id of authIds) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // ignore
      }
    }
  }

  return {
    rid,
    admin,
    providerA,
    providerB,
    companyA,
    companyB,
    locA,
    locB,
    orderA,
    regA,
    regNull,
    providerAdminA,
    providerAdminB,
    superadmin,
    outsider,
    employeeA,
    companyAdminA,
    cleanup,
  };
}
