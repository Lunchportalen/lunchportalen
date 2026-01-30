// app/tests/_helpers/rlsFixtures.ts
import crypto from "node:crypto";
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

async function createAuthUser(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data?.user?.id) throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
  return data.user.id as string;
}

async function createAccessToken(admin: SupabaseClient, userId: string) {
  const r = await (admin.auth.admin as any).createSession({ user_id: userId });
  if (r?.error) throw new Error(`createSession failed: ${r.error.message}`);
  const token = r?.data?.session?.access_token;
  if (!token) throw new Error("createSession returned no access_token");
  return token as string;
}

/* =========================================================
   Orgnr generator (companies.orgnr er NOT NULL)
========================================================= */
let _orgnrCounter = 900000000;
function nextOrgnr() {
  _orgnrCounter += 1;
  return String(_orgnrCounter);
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
    department?: string | null;
    disabled_at?: string | null;
    is_active?: boolean | null;
  }
) {
  const base = {
    role: args.role,
    email: args.email,
    company_id: args.company_id ?? null,
    location_id: args.location_id ?? null,
    full_name: args.full_name ?? null,
    department: args.department ?? null,
    disabled_at: args.disabled_at ?? null,
    is_active: args.is_active ?? true,
  };

  // Try 1: profiles.id = auth.users.id
  const r1 = await admin.from("profiles").insert({ id: args.user_id, ...base } as any);
  if (!r1.error) return;

  // Try 2: profiles.user_id
  const r2 = await admin.from("profiles").insert({ user_id: args.user_id, ...base } as any);
  if (!r2.error) return;

  throw new Error(`insert profile failed: ${r2.error?.message ?? r1.error?.message ?? "unknown"}`);
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

  const orgnr = safeStr(args.orgnr) || nextOrgnr();

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

  const { error } = await admin.from("company_locations").insert(
    {
      id,
      company_id,
      name,
      label: args.label ?? null,
    } as any
  );

  if (error) throw new Error(`insert location failed: ${error.message}`);
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
      slot: args.slot ?? "LUNCH",
      note: args.note ?? null,
    } as any
  );
  if (error) throw new Error(`insert order failed: ${error.message}`);
}

/* =========================================================
   Builder
========================================================= */
export async function buildRlsFixtures(): Promise<Fixtures> {
  const rid = crypto.randomUUID();
  const short = rid.slice(0, 6);

  const admin = supabaseAdmin();
  const anon = supabaseAnon();

  // Base A/B
  const companyAId = crypto.randomUUID();
  const companyBId = crypto.randomUUID();

  const companyAName = `Company A ${short}`;
  const companyBName = `Company B ${short}`;

  await insertCompany(admin, { id: companyAId, name: companyAName, status: "ACTIVE" });
  await insertCompany(admin, { id: companyBId, name: companyBName, status: "ACTIVE" });

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

  await insertCompany(admin, { id: companyActiveId, name: `FX Active ${short}`, status: "ACTIVE" });
  await insertCompany(admin, { id: companyPausedId, name: `FX Paused ${short}`, status: "PAUSED" });
  await insertCompany(admin, { id: companyClosedId, name: `FX Closed ${short}`, status: "CLOSED" });
  await insertCompany(admin, { id: companyOtherId, name: `FX Other ${short}`, status: "ACTIVE" });

  const locActiveId = crypto.randomUUID();
  const locPausedId = crypto.randomUUID();
  const locClosedId = crypto.randomUUID();
  const locOtherId = crypto.randomUUID();

  await insertLocation(admin, { id: locActiveId, company_id: companyActiveId, name: `FX Loc Active ${short}`, label: "ACTIVE" });
  await insertLocation(admin, { id: locPausedId, company_id: companyPausedId, name: `FX Loc Paused ${short}`, label: "PAUSED" });
  await insertLocation(admin, { id: locClosedId, company_id: companyClosedId, name: `FX Loc Closed ${short}`, label: "CLOSED" });
  await insertLocation(admin, { id: locOtherId, company_id: companyOtherId, name: `FX Loc Other ${short}`, label: "OTHER" });

  // Users + tokens
  const mk = async (role: Role, company_id?: string | null, location_id?: string | null) => {
    const email = randEmail(role);
    const user_id = await createAuthUser(admin, email);
    const accessToken = await createAccessToken(admin, user_id);
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

  // Minimal orders (for status-gate tests)
  const today = new Date();
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayISO = `${yyyy}-${mm}-${dd}`;

  await insertOrder(admin, { user_id: empActive.user_id, date: todayISO, status: "ACTIVE", company_id: companyActiveId, location_id: locActiveId });
  await insertOrder(admin, { user_id: empPaused.user_id, date: todayISO, status: "ACTIVE", company_id: companyPausedId, location_id: locPausedId });
  await insertOrder(admin, { user_id: empClosed.user_id, date: todayISO, status: "ACTIVE", company_id: companyClosedId, location_id: locClosedId });
  await insertOrder(admin, { user_id: empOther.user_id, date: todayISO, status: "ACTIVE", company_id: companyOtherId, location_id: locOtherId });

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

  // ✅ FASIT cleanup rekkefølge (orders -> profiles -> locations -> companies -> auth)
  async function cleanup() {
    await admin.from("orders").delete().in("user_id", authUserIds).throwOnError();

    await admin.from("profiles").delete().in("user_id", authUserIds).throwOnError();
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
