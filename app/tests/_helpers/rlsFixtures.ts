// tests/_helpers/rlsFixtures.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "TestPass!12345";

function requireEnv(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
}

requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON);
requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SessionLike = { access_token: string };

export type Fixtures = {
  adminActive: SessionLike;
  adminPaused: SessionLike;
  adminClosed: SessionLike;
  adminOtherCompany: SessionLike;
  superadmin: SessionLike;

  companyActiveId: string;
  companyPausedId: string;
  companyClosedId: string;
  companyOtherId: string;
};

function rand(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

async function ensureUser(email: string, role: string) {
  // create or get user
  const created = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role },
  });

  if (!created.error && created.data?.user) return created.data.user;

  // If already exists, fetch by list (simple fallback)
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 });
  if (list.error) throw new Error(list.error.message);
  const u = (list.data?.users ?? []).find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) throw new Error(`Could not create or find user: ${email}`);

  // Ensure role metadata
  await admin.auth.admin.updateUserById(u.id, { user_metadata: { role } });
  return u;
}

async function signIn(email: string): Promise<SessionLike> {
  const res = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (res.error || !res.data.session) throw new Error(res.error?.message ?? `No session for ${email}`);
  return { access_token: res.data.session.access_token };
}

async function upsertProfile(userId: string, companyId: string, role: string, fullName: string) {
  // Your profiles schema might have different columns; adjust if needed.
  // Minimum we rely on: user_id, company_id.
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        company_id: companyId,
        role,
        full_name: fullName,
      } as any,
      { onConflict: "user_id" }
    );

  if (error) {
    // If your profiles table doesn't have role/full_name, retry minimal upsert.
    const retry = await admin
      .from("profiles")
      .upsert({ user_id: userId, company_id: companyId } as any, { onConflict: "user_id" });
    if (retry.error) throw new Error(retry.error.message);
  }
}

async function createCompany(status: "active" | "paused" | "closed", name: string) {
  const ins = await admin
    .from("companies")
    .insert({ name, status } as any)
    .select("id")
    .single();

  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id as string;
}

async function createLocation(companyId: string, name: string) {
  const ins = await admin
    .from("company_locations")
    .insert({ company_id: companyId, name } as any)
    .select("id")
    .single();

  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id as string;
}

async function createOrder(companyId: string, locationId: string | null, userId: string, dateISO: string) {
  // Uses your known orders schema: id,user_id,date,status,note,created_at,updated_at,company_id,location_id,slot
  const ins = await admin
    .from("orders")
    .insert({
      user_id: userId,
      company_id: companyId,
      location_id: locationId,
      date: dateISO,
      status: "active",
      note: "seed",
      slot: "11:00-11:30",
    } as any)
    .select("id")
    .single();

  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id as string;
}

export async function buildRlsFixtures(): Promise<Fixtures> {
  const tag = `rls_${Date.now()}_${rand()}`;

  // --- Create companies
  const companyActiveId = await createCompany("active", `Active Co ${tag}`);
  const companyPausedId = await createCompany("paused", `Paused Co ${tag}`);
  const companyClosedId = await createCompany("closed", `Closed Co ${tag}`);
  const companyOtherId = await createCompany("active", `Other Co ${tag}`);

  // --- Create users
  const superEmail = `superadmin+${tag}@test.local`;
  const aAdminEmail = `admin_active+${tag}@test.local`;
  const pAdminEmail = `admin_paused+${tag}@test.local`;
  const cAdminEmail = `admin_closed+${tag}@test.local`;
  const oAdminEmail = `admin_other+${tag}@test.local`;

  const aEmpEmail = `emp_active+${tag}@test.local`;
  const pEmpEmail = `emp_paused+${tag}@test.local`;
  const cEmpEmail = `emp_closed+${tag}@test.local`;
  const oEmpEmail = `emp_other+${tag}@test.local`;

  const superU = await ensureUser(superEmail, "superadmin");
  const aAdminU = await ensureUser(aAdminEmail, "company_admin");
  const pAdminU = await ensureUser(pAdminEmail, "company_admin");
  const cAdminU = await ensureUser(cAdminEmail, "company_admin");
  const oAdminU = await ensureUser(oAdminEmail, "company_admin");

  const aEmpU = await ensureUser(aEmpEmail, "employee");
  const pEmpU = await ensureUser(pEmpEmail, "employee");
  const cEmpU = await ensureUser(cEmpEmail, "employee");
  const oEmpU = await ensureUser(oEmpEmail, "employee");

  // --- Upsert profiles linking users to companies
  await upsertProfile(aAdminU.id, companyActiveId, "company_admin", "Admin Active");
  await upsertProfile(pAdminU.id, companyPausedId, "company_admin", "Admin Paused");
  await upsertProfile(cAdminU.id, companyClosedId, "company_admin", "Admin Closed");
  await upsertProfile(oAdminU.id, companyOtherId, "company_admin", "Admin Other");

  await upsertProfile(aEmpU.id, companyActiveId, "employee", "Emp Active");
  await upsertProfile(pEmpU.id, companyPausedId, "employee", "Emp Paused");
  await upsertProfile(cEmpU.id, companyClosedId, "employee", "Emp Closed");
  await upsertProfile(oEmpU.id, companyOtherId, "employee", "Emp Other");

  // --- Locations
  const locA = await createLocation(companyActiveId, `HQ ${tag}`);
  const locP = await createLocation(companyPausedId, `HQ ${tag}`);
  const locC = await createLocation(companyClosedId, `HQ ${tag}`);
  const locO = await createLocation(companyOtherId, `HQ ${tag}`);

  // --- Orders (one per company)
  const todayISO = new Date().toISOString().slice(0, 10);
  await createOrder(companyActiveId, locA, aEmpU.id, todayISO);
  await createOrder(companyPausedId, locP, pEmpU.id, todayISO);
  await createOrder(companyClosedId, locC, cEmpU.id, todayISO);
  await createOrder(companyOtherId, locO, oEmpU.id, todayISO);

  // --- Sessions
  const superadmin = await signIn(superEmail);
  const adminActive = await signIn(aAdminEmail);
  const adminPaused = await signIn(pAdminEmail);
  const adminClosed = await signIn(cAdminEmail);
  const adminOtherCompany = await signIn(oAdminEmail);

  return {
    superadmin,
    adminActive,
    adminPaused,
    adminClosed,
    adminOtherCompany,
    companyActiveId,
    companyPausedId,
    companyClosedId,
    companyOtherId,
  };
}
