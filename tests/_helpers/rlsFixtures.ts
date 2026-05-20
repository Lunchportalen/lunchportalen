// tests/_helpers/rlsFixtures.ts
// RLS fixture: builds companies, locations, users, and real auth tokens via signInWithPassword.
// Sign-ins are throttled and serialized (cross-process lock) to avoid Supabase "Request rate limit reached".
// When running multiple RLS test files, use: vitest run --pool threads (see vitest.config.ts)
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { ensureIntegrationTestTableGrants, fixturePgQuery } from "./fixturePg";
import { readRemoteSupabaseIntegrationEnv } from "./remoteSupabaseIntegration";
import { anonClient, serviceRoleClient } from "./supabaseTestClient";

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/** Default provider from Patch 5 (Melhus); required on companies/orders/agreements inserts. */
export const DEFAULT_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

export type AuthUserFx = {
  user_id: string;
  email: string;
  access_token: string;
  accessToken: string;
};

export type Fixtures = {
  rid: string;

  admin: SupabaseClient<Database>; // service role
  anon: SupabaseClient<Database>; // anon

  companyA: { id: string; name: string };
  companyB: { id: string; name: string };
  locA: { id: string; company_id: string; name: string };
  locB: { id: string; company_id: string; name: string };

  companyActiveId: string;
  companyPausedId: string;
  companyClosedId: string;
  companyOtherId: string;

  adminActive: AuthUserFx;
  adminPaused: AuthUserFx;
  adminClosed: AuthUserFx;

  superadmin: AuthUserFx;

  users: {
    employeeA: AuthUserFx;
    adminA: AuthUserFx;
    employeeB: AuthUserFx;
    adminB: AuthUserFx;
    kitchen: AuthUserFx;
    driver: AuthUserFx;
  };

  supabaseAs: (accessToken: string) => SupabaseClient<Database>;
  cleanup: () => Promise<void>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function randEmail(prefix: string) {
  const n = crypto.randomUUID().slice(0, 8);
  return `${prefix}.${n}@test.lunchportalen.no`;
}

function supabaseAdmin(): SupabaseClient<Database> {
  return serviceRoleClient();
}

function supabaseAnon(): SupabaseClient<Database> {
  return anonClient();
}

function supabaseAs(accessToken: string): SupabaseClient<Database> {
  // ANON key + bearer token => RLS evalueres som den brukeren
  const { url, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  return createClient<Database>(url, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
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

/** Supabase auth token bucket refills slowly; space sign-ins to avoid "Request rate limit reached". */
const MIN_MS_BETWEEN_SIGN_INS = 2000;
const LOCK_STALE_MS = 60_000;
let lastSignInAt = 0;
const tokenCache = new Map<string, string>();

function tokenCacheKey(email: string, password: string): string {
  return `${email}\n${password}`;
}

function signInLockPath(): string {
  return path.join(os.tmpdir(), "lunchportalen-rls-sign-in.lock");
}

/** Acquire a cross-process lock so only one sign-in runs at a time (avoids rate limit when test files run in parallel). */
async function withSignInLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockPath = signInLockPath();
  const pollMs = 200;
  while (true) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      break;
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err?.code !== "EEXIST" && err?.code !== "EPERM") throw e;
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) fs.unlinkSync(lockPath);
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Obtain a real access token for the user via signInWithPassword.
 * Uses anon client so RLS sees a normal user session (no createSession API).
 * Throttles consecutive sign-ins to avoid Supabase auth rate limits.
 * Reuses cached token when the same (email, password) is requested again.
 * Exported for regression tests (token reuse / no repeated sign-in).
 */
export async function createAccessToken(admin: SupabaseClient<Database>, email: string, password: string): Promise<string> {
  const key = tokenCacheKey(email, password);
  const cached = tokenCache.get(key);
  if (cached) return cached;

  await withSignInLock(async () => {
    const now = Date.now();
    const elapsed = now - lastSignInAt;
    if (lastSignInAt > 0 && elapsed < MIN_MS_BETWEEN_SIGN_INS) {
      await new Promise((r) => setTimeout(r, MIN_MS_BETWEEN_SIGN_INS - elapsed));
    }
    lastSignInAt = Date.now();

    const anon = supabaseAnon();
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
    const token = data?.session?.access_token;
    if (!token) throw new Error("signInWithPassword returned no access_token");
    tokenCache.set(key, token);

    await new Promise((r) => setTimeout(r, MIN_MS_BETWEEN_SIGN_INS));
  });

  const out = tokenCache.get(key);
  if (!out) throw new Error("createAccessToken: token not set after lock");
  return out;
}

/* =========================================================
   Orgnr generator (companies.orgnr er NOT NULL).
   Per-build unique base from rid to avoid duplicate key across parallel/test runs.
========================================================= */
function orgnrBaseFromRid(rid: string): number {
  const n = parseInt(rid.slice(0, 8), 16);
  return 100000000 + (n % 800000000);
}

/* =========================================================
   Inserts (robuste + forklarende feil)
========================================================= */

async function insertProfile(
  admin: SupabaseClient<Database>,
  args: {
    user_id: string;
    role: Role;
    email: string;
    company_id?: string | null;
    location_id?: string | null;
    full_name?: string | null;
    disabled_at?: string | null;
    is_active?: boolean | null;
  }
) {
  // Canonical profiles schema (bootstrap): id, email, full_name, role, company_id, location_id, active, disabled_at, archived_at, ...
  // No department column; use active (schema) not is_active for the insert.
  const base = {
    role: args.role,
    email: args.email,
    company_id: args.company_id ?? null,
    location_id: args.location_id ?? null,
    full_name: args.full_name ?? null,
    disabled_at: args.disabled_at ?? null,
    active: args.is_active ?? true,
  };

  // Canonical schema: profiles.id = auth.users.id (user_id column was dropped in bootstrap).
  // Use upsert in case a trigger or hook already created a profile row for the auth user.
  try {
    await fixturePgQuery(
      `INSERT INTO public.profiles (id, email, role, company_id, location_id, full_name, disabled_at, active)
       VALUES ($1, $2, $3::public.user_role, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         company_id = EXCLUDED.company_id,
         location_id = EXCLUDED.location_id,
         full_name = EXCLUDED.full_name,
         disabled_at = EXCLUDED.disabled_at,
         active = EXCLUDED.active`,
      [
        args.user_id,
        args.email,
        args.role,
        args.company_id ?? null,
        args.location_id ?? null,
        args.full_name ?? null,
        args.disabled_at ?? null,
        args.is_active ?? true,
      ],
    );
  } catch (e) {
    throw new Error(`insert profile failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * companies.status har check constraint hos dere.
 * Vi prøver:
 *  1) UPPERCASE (ACTIVE/PAUSED/CLOSED)
 *  2) lowercase (active/paused/closed) hvis status_check feiler
 */
async function insertCompany(
  admin: SupabaseClient<Database>,
  args: { id: string; name: string; status?: string | null; default_location_id?: string | null; orgnr?: string | null }
) {
  const id = safeStr(args.id);
  const name = safeStr(args.name);
  if (!id) throw new Error("insert company failed: missing id");
  if (!name) throw new Error("insert company failed: missing name");

  const orgnr = safeStr(args.orgnr);
  if (!orgnr) throw new Error("insert company failed: orgnr required (use per-build unique orgnr)");

  const raw = safeStr(args.status) || "ACTIVE";
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  const insertSql = (status: string, withDefaultLoc: boolean) =>
    withDefaultLoc
      ? `INSERT INTO public.companies (id, name, status, orgnr, provider_id, default_location_id)
         VALUES ($1, $2, $3, $4, $5::uuid, $6)`
      : `INSERT INTO public.companies (id, name, status, orgnr, provider_id)
         VALUES ($1, $2, $3, $4, $5::uuid)`;

  const runInsert = async (status: string, withDefaultLoc: boolean) => {
    const params = withDefaultLoc
      ? [id, name, status, orgnr, DEFAULT_PROVIDER_ID, args.default_location_id ?? null]
      : [id, name, status, orgnr, DEFAULT_PROVIDER_ID];
    await fixturePgQuery(insertSql(status, withDefaultLoc), params);
  };

  try {
    await runInsert(upper, true);
    return;
  } catch (e1) {
    const msg = e1 instanceof Error ? e1.message : String(e1);
    if (msg.includes("companies_status_check")) {
      try {
        await runInsert(lower, true);
        return;
      } catch (e2) {
        throw new Error(`insert company failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
      }
    }
    if (msg.includes("default_location_id")) {
      try {
        await runInsert(upper, false);
        return;
      } catch (e3) {
        throw new Error(`insert company failed: ${e3 instanceof Error ? e3.message : String(e3)}`);
      }
    }
    throw new Error(`insert company failed: ${msg}`);
  }
}

async function insertLocation(
  admin: SupabaseClient<Database>,
  args: { id: string; company_id: string; name: string; label?: string | null }
) {
  const id = safeStr(args.id);
  const company_id = safeStr(args.company_id);
  const name = safeStr(args.name);

  // ✅ Denne stopper “company_id null” med en gang, med tydelig feil
  if (!id) throw new Error("insert location failed: missing id");
  if (!company_id) throw new Error(`insert location failed: missing company_id for location "${name || id}"`);
  if (!name) throw new Error("insert location failed: missing name");

  const payload: Record<string, unknown> = { id, company_id, name };
  if (args.label != null) payload.label = args.label;

  try {
    if (args.label != null) {
      await fixturePgQuery(
        `INSERT INTO public.company_locations (id, company_id, name, label) VALUES ($1, $2, $3, $4)`,
        [id, company_id, name, args.label],
      );
    } else {
      await fixturePgQuery(
        `INSERT INTO public.company_locations (id, company_id, name) VALUES ($1, $2, $3)`,
        [id, company_id, name],
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("label")) {
      await fixturePgQuery(
        `INSERT INTO public.company_locations (id, company_id, name) VALUES ($1, $2, $3)`,
        [id, company_id, name],
      );
      return;
    }
    throw new Error(`insert location failed: ${msg}`);
  }
}

async function ensureMenuServiceDayForOrder(
  companyId: string,
  locationId: string,
  serviceDate: string,
  providerId: string = DEFAULT_PROVIDER_ID,
) {
  const menuDayId = crypto.randomUUID();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  await fixturePgQuery(
    `INSERT INTO public.menu_service_days (
       id, company_id, location_id, service_date, state, cutoff_at, provider_id, published_at
     ) VALUES ($1, $2, $3, $4::date, 'published'::public.menu_state, $5::timestamptz, $6::uuid, now())`,
    [menuDayId, companyId, locationId, serviceDate, cutoff.toISOString(), providerId],
  );
  return menuDayId;
}

async function insertOrder(
  admin: SupabaseClient<Database>,
  args: { id?: string; user_id: string; date: string; status: string; company_id: string; location_id: string; slot?: string | null; note?: string | null }
): Promise<string> {
  const menuDayId = await ensureMenuServiceDayForOrder(args.company_id, args.location_id, args.date);
  try {
    await fixturePgQuery(
      `INSERT INTO public.orders (id, user_id, date, status, company_id, location_id, provider_id, slot, note)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7::uuid, $8, $9)`,
      [
        args.id ?? crypto.randomUUID(),
        args.user_id,
        args.date,
        args.status,
        args.company_id,
        args.location_id,
        DEFAULT_PROVIDER_ID,
        args.slot ?? "default",
        args.note ?? null,
      ],
    );
  } catch (e) {
    throw new Error(`insert order failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return menuDayId;
}

/**
 * Create an ACTIVE agreement for (company, location) so order inserts are allowed.
 * Tries RPC (lp_agreement_create_pending + lp_agreement_approve_active) first;
 * if the RPC is not in the schema cache, inserts directly into agreements with status ACTIVE.
 * Fails if company is CLOSED (RPC path only; direct insert is used for fixture companies that are not CLOSED).
 */
async function ensureActiveAgreement(
  admin: SupabaseClient<Database>,
  companyId: string,
  locationId: string,
  startsAtISO: string
): Promise<void> {
  const rpcParams = {
    p_company_id: companyId,
    p_location_id: locationId,
    p_tier: "BASIS",
    p_delivery_days: ["mon", "tue", "wed", "thu", "fri"],
    p_slot_start: "11:00",
    p_slot_end: "13:00",
    p_starts_at: startsAtISO,
    p_binding_months: 12,
    p_notice_months: 3,
    p_price_per_employee: 100,
  };
  const { data, error: createErr } = await admin.rpc("lp_agreement_create_pending", rpcParams);
  if (!createErr) {
    const row = Array.isArray(data) ? data[0] : data;
    const agreementId = String((row as { agreement_id?: string })?.agreement_id ?? (row as { id?: string })?.id ?? "");
    if (!agreementId) throw new Error("lp_agreement_create_pending returned no agreement_id");
    const { error: approveErr } = await admin.rpc("lp_agreement_approve_active", {
      p_agreement_id: agreementId,
      p_actor_user_id: null,
    });
    if (!approveErr) return;
    throw new Error(`lp_agreement_approve_active failed: ${approveErr.message}`);
  }
  const msg = String(createErr.message ?? "");
  if (msg.includes("schema cache") || msg.includes("Could not find the function")) {
    try {
      await fixturePgQuery(
        `INSERT INTO public.agreements (
           company_id, location_id, provider_id, tier, status,
           delivery_days, slot_start, slot_end, starts_at
         ) VALUES ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', $4::jsonb, '11:00', '13:00', $5::timestamptz)`,
        [
          companyId,
          locationId,
          DEFAULT_PROVIDER_ID,
          JSON.stringify(["mon", "tue", "wed", "thu", "fri"]),
          startsAtISO,
        ],
      );
    } catch (insertErr) {
      throw new Error(
        `agreements insert (fallback) failed: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`,
      );
    }
    return;
  }
  throw new Error(`lp_agreement_create_pending failed: ${createErr.message}`);
}

/* =========================================================
   Builder
========================================================= */
export async function buildRlsFixtures(): Promise<Fixtures> {
  await ensureIntegrationTestTableGrants();
  const rid = crypto.randomUUID();
  const short = rid.slice(0, 6);
  const orgnrBase = orgnrBaseFromRid(rid);

  const admin = supabaseAdmin();
  const anon = supabaseAnon();

  // Base A/B
  const companyAId = crypto.randomUUID();
  const companyBId = crypto.randomUUID();

  const companyAName = `Company A ${short}`;
  const companyBName = `Company B ${short}`;

  await insertCompany(admin, { id: companyAId, name: companyAName, status: "ACTIVE", orgnr: String(orgnrBase) });
  await insertCompany(admin, { id: companyBId, name: companyBName, status: "ACTIVE", orgnr: String(orgnrBase + 1) });

  const locAId = crypto.randomUUID();
  const locBId = crypto.randomUUID();

  const locAName = `Loc A ${short}`;
  const locBName = `Loc B ${short}`;

  await insertLocation(admin, { id: locAId, company_id: companyAId, name: locAName, label: "A" });
  await insertLocation(admin, { id: locBId, company_id: companyBId, name: locBName, label: "B" });

  // Status gate companies
  const companyActiveId = crypto.randomUUID();
  const companyPausedId = crypto.randomUUID();
  const companyClosedId = crypto.randomUUID();
  const companyOtherId = crypto.randomUUID();

  await insertCompany(admin, { id: companyActiveId, name: `FX Active ${short}`, status: "ACTIVE", orgnr: String(orgnrBase + 2) });
  await insertCompany(admin, { id: companyPausedId, name: `FX Paused ${short}`, status: "PAUSED", orgnr: String(orgnrBase + 3) });
  await insertCompany(admin, { id: companyClosedId, name: `FX Closed ${short}`, status: "CLOSED", orgnr: String(orgnrBase + 4) });
  await insertCompany(admin, { id: companyOtherId, name: `FX Other ${short}`, status: "ACTIVE", orgnr: String(orgnrBase + 5) });

  const locActiveId = crypto.randomUUID();
  const locPausedId = crypto.randomUUID();
  const locClosedId = crypto.randomUUID();
  const locOtherId = crypto.randomUUID();

  await insertLocation(admin, { id: locActiveId, company_id: companyActiveId, name: `FX Loc Active ${short}`, label: "ACTIVE" });
  await insertLocation(admin, { id: locPausedId, company_id: companyPausedId, name: `FX Loc Paused ${short}`, label: "PAUSED" });
  await insertLocation(admin, { id: locClosedId, company_id: companyClosedId, name: `FX Loc Closed ${short}`, label: "CLOSED" });
  await insertLocation(admin, { id: locOtherId, company_id: companyOtherId, name: `FX Loc Other ${short}`, label: "OTHER" });

  // Users + tokens (password used only to obtain session via signInWithPassword; not stored)
  const mk = async (role: Role, company_id?: string | null, location_id?: string | null) => {
    const email = randEmail(role);
    const password = crypto.randomBytes(20).toString("hex");
    const user_id = await createAuthUser(admin, email, password);
    const accessToken = await createAccessToken(admin, email, password);
    await insertProfile(admin, { user_id, email, role, company_id: company_id ?? null, location_id: location_id ?? null });
    return { user_id, email, accessToken, access_token: accessToken } as AuthUserFx;
  };

  const employeeA = await mk("employee", companyAId, locAId);
  const adminAUser = await mk("company_admin", companyAId, locAId);
  const employeeB = await mk("employee", companyBId, locBId);
  const adminBUser = await mk("company_admin", companyBId, locBId);

  const kitchen = await mk("kitchen", null, null);
  const driver = await mk("driver", null, null);
  const superadmin = await mk("superadmin", null, null);

  const adminActive = await mk("company_admin", companyActiveId, locActiveId);
  const adminPaused = await mk("company_admin", companyPausedId, locPausedId);
  const adminClosed = await mk("company_admin", companyClosedId, locClosedId);

  const empActive = await mk("employee", companyActiveId, locActiveId);
  const empPaused = await mk("employee", companyPausedId, locPausedId);
  const empClosed = await mk("employee", companyClosedId, locClosedId);
  const empOther = await mk("employee", companyOtherId, locOtherId);

  // Minimal orders (for status-gate tests). Order insert requires ACTIVE agreement per (company, location, date).
  // Use a non-today order date to avoid production same-day cutoff (orders locked after 08:00 Oslo for "today").
  const now = new Date();
  const past = new Date(now);
  past.setUTCDate(past.getUTCDate() - 7);
  const startsAtISO = `${past.getUTCFullYear()}-${String(past.getUTCMonth() + 1).padStart(2, "0")}-${String(
    past.getUTCDate()
  ).padStart(2, "0")}`;

  const future = new Date(now);
  future.setUTCDate(future.getUTCDate() + 1);
  const orderDateISO = `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, "0")}-${String(
    future.getUTCDate()
  ).padStart(2, "0")}`;

  await ensureActiveAgreement(admin, companyActiveId, locActiveId, startsAtISO);
  await ensureActiveAgreement(admin, companyPausedId, locPausedId, startsAtISO);
  await ensureActiveAgreement(admin, companyOtherId, locOtherId, startsAtISO);
  // CLOSED company cannot have an agreement (lp_agreement_create_pending raises COMPANY_CLOSED), so no order for empClosed.
  // Order insert also requires company status ACTIVE; PAUSED companies are blocked, so no order for empPaused.

  const menuDayIds: string[] = [];
  menuDayIds.push(
    await insertOrder(admin, {
      user_id: empActive.user_id,
      date: orderDateISO,
      status: "ACTIVE",
      company_id: companyActiveId,
      location_id: locActiveId,
    }),
  );
  menuDayIds.push(
    await insertOrder(admin, {
      user_id: empOther.user_id,
      date: orderDateISO,
      status: "ACTIVE",
      company_id: companyOtherId,
      location_id: locOtherId,
    }),
  );

  const authUserIds = [
    employeeA.user_id,
    adminAUser.user_id,
    employeeB.user_id,
    adminBUser.user_id,
    kitchen.user_id,
    driver.user_id,
    superadmin.user_id,
    adminActive.user_id,
    adminPaused.user_id,
    adminClosed.user_id,
    empActive.user_id,
    empPaused.user_id,
    empClosed.user_id,
    empOther.user_id,
  ];

  // ✅ FASIT cleanup rekkefølge (orders -> agreements -> profiles -> locations -> companies -> auth)
  async function cleanup() {
    await fixturePgQuery(`DELETE FROM public.orders WHERE user_id = ANY($1::uuid[])`, [authUserIds]);
    if (menuDayIds.length > 0) {
      await fixturePgQuery(`DELETE FROM public.menu_service_days WHERE id = ANY($1::uuid[])`, [menuDayIds]);
    }
    await fixturePgQuery(`DELETE FROM public.agreements WHERE company_id = ANY($1::uuid[])`, [
      [companyAId, companyBId, companyActiveId, companyPausedId, companyClosedId, companyOtherId],
    ]);
    await fixturePgQuery(`DELETE FROM public.profiles WHERE id = ANY($1::uuid[])`, [authUserIds]);
    await fixturePgQuery(`DELETE FROM public.company_locations WHERE id = ANY($1::uuid[])`, [
      [locAId, locBId, locActiveId, locPausedId, locClosedId, locOtherId],
    ]);
    await fixturePgQuery(`DELETE FROM public.companies WHERE id = ANY($1::uuid[])`, [
      [companyAId, companyBId, companyActiveId, companyPausedId, companyClosedId, companyOtherId],
    ]);

    for (const id of authUserIds) {
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
    anon,

    companyA: { id: companyAId, name: companyAName },
    companyB: { id: companyBId, name: companyBName },
    locA: { id: locAId, company_id: companyAId, name: locAName },
    locB: { id: locBId, company_id: companyBId, name: locBName },

    companyActiveId,
    companyPausedId,
    companyClosedId,
    companyOtherId,

    adminActive,
    adminPaused,
    adminClosed,

    superadmin,

    users: {
      employeeA,
      adminA: adminAUser,
      employeeB,
      adminB: adminBUser,
      kitchen,
      driver,
    },

    supabaseAs,
    cleanup,
  };
}
