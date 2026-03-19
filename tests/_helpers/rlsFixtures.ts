// tests/_helpers/rlsFixtures.ts
// RLS fixture: builds companies, locations, users, and real auth tokens via signInWithPassword.
// Sign-ins are throttled and serialized (cross-process lock) to avoid Supabase "Request rate limit reached".
// When running multiple RLS test files, use: vitest run --poolOptions.forks.maxForks=1 <files>
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
}
requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON);
requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE);

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export type AuthUserFx = {
  user_id: string;
  email: string;
  access_token: string;
  accessToken: string;
};

export type Fixtures = {
  rid: string;

  admin: SupabaseClient; // service role
  anon: SupabaseClient; // anon

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

  supabaseAs: (accessToken: string) => SupabaseClient;
  cleanup: () => Promise<void>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function randEmail(prefix: string) {
  const n = crypto.randomUUID().slice(0, 8);
  return `${prefix}.${n}@test.lunchportalen.no`;
}

function supabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAnon(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function supabaseAs(accessToken: string): SupabaseClient {
  // ANON key + bearer token => RLS evalueres som den brukeren
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function createAuthUser(admin: SupabaseClient, email: string, password: string) {
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
export async function createAccessToken(admin: SupabaseClient, email: string, password: string): Promise<string> {
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
  admin: SupabaseClient,
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
  const { error } = await admin
    .from("profiles")
    .upsert({ id: args.user_id, ...base } as any, { onConflict: "id" });
  if (error) throw new Error(`insert profile failed: ${error.message}`);
}

/**
 * companies.status har check constraint hos dere.
 * Vi prøver:
 *  1) UPPERCASE (ACTIVE/PAUSED/CLOSED)
 *  2) lowercase (active/paused/closed) hvis status_check feiler
 */
async function insertCompany(
  admin: SupabaseClient,
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

  const payloadUpper = {
    id,
    name,
    status: upper,
    orgnr,
    default_location_id: args.default_location_id ?? null,
  } as any;

  const payloadLower = {
    id,
    name,
    status: lower,
    orgnr,
    default_location_id: args.default_location_id ?? null,
  } as any;

  const r1 = await admin.from("companies").insert(payloadUpper);
  if (!r1.error) return;

  const msg = String(r1.error?.message ?? "");
  if (msg.includes("companies_status_check")) {
    const r2 = await admin.from("companies").insert(payloadLower);
    if (!r2.error) return;
    throw new Error(`insert company failed: ${r2.error?.message ?? r1.error?.message ?? "unknown"}`);
  }

  // Schema cache may not know about default_location_id in some environments.
  // Retry without that column when that specific error is seen.
  if (msg.includes("default_location_id")) {
    const { error: r2err } = await admin.from("companies").insert(
      {
        id,
        name,
        status: upper,
        orgnr,
      } as any
    );
    if (!r2err) return;
    throw new Error(`insert company failed: ${r2err?.message ?? r1.error?.message ?? "unknown"}`);
  }

  throw new Error(`insert company failed: ${r1.error?.message ?? "unknown"}`);
}

async function insertLocation(
  admin: SupabaseClient,
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

  const { error } = await admin.from("company_locations").insert(payload as any);
  if (!error) return;

  const msg = String(error?.message ?? "");
  if (msg.includes("label") && msg.includes("schema")) {
    const { error: r2 } = await admin.from("company_locations").insert({ id, company_id, name } as any);
    if (!r2) return;
  }
  throw new Error(`insert location failed: ${error.message}`);
}

async function insertOrder(
  admin: SupabaseClient,
  args: { id?: string; user_id: string; date: string; status: string; company_id: string; location_id: string; slot?: string | null; note?: string | null }
) {
  const { error } = await admin.from("orders").insert(
    {
      id: args.id ?? crypto.randomUUID(),
      user_id: args.user_id,
      date: args.date,
      status: args.status,
      company_id: args.company_id,
      location_id: args.location_id,
      slot: args.slot ?? "default",
      note: args.note ?? null,
    } as any
  );
  if (error) throw new Error(`insert order failed: ${error.message}`);
}

/**
 * Create an ACTIVE agreement for (company, location) so order inserts are allowed.
 * Tries RPC (lp_agreement_create_pending + lp_agreement_approve_active) first;
 * if the RPC is not in the schema cache, inserts directly into agreements with status ACTIVE.
 * Fails if company is CLOSED (RPC path only; direct insert is used for fixture companies that are not CLOSED).
 */
async function ensureActiveAgreement(
  admin: SupabaseClient,
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
    const { error: insertErr } = await admin.from("agreements").insert({
      company_id: companyId,
      location_id: locationId,
      tier: "BASIS",
      status: "ACTIVE",
      delivery_days: ["mon", "tue", "wed", "thu", "fri"],
      slot_start: "11:00",
      slot_end: "13:00",
      starts_at: startsAtISO,
    } as any);
    if (insertErr) throw new Error(`agreements insert (fallback) failed: ${insertErr.message}`);
    return;
  }
  throw new Error(`lp_agreement_create_pending failed: ${createErr.message}`);
}

/* =========================================================
   Builder
========================================================= */
export async function buildRlsFixtures(): Promise<Fixtures> {
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

  await insertOrder(admin, {
    user_id: empActive.user_id,
    date: orderDateISO,
    status: "ACTIVE",
    company_id: companyActiveId,
    location_id: locActiveId,
  });
  await insertOrder(admin, {
    user_id: empOther.user_id,
    date: orderDateISO,
    status: "ACTIVE",
    company_id: companyOtherId,
    location_id: locOtherId,
  });

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
    await admin.from("orders").delete().in("user_id", authUserIds).throwOnError();

    await admin
      .from("agreements")
      .delete()
      .in("company_id", [companyAId, companyBId, companyActiveId, companyPausedId, companyClosedId, companyOtherId])
      .throwOnError();

    await admin.from("profiles").delete().in("id", authUserIds).throwOnError();

    await admin
      .from("company_locations")
      .delete()
      .in("id", [locAId, locBId, locActiveId, locPausedId, locClosedId, locOtherId])
      .throwOnError();

    await admin
      .from("companies")
      .delete()
      .in("id", [companyAId, companyBId, companyActiveId, companyPausedId, companyClosedId, companyOtherId])
      .throwOnError();

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
