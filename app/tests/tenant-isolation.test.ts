// app/tests/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function mustEnv() {
  if (!URL || !ANON || !SRV) {
    throw new Error(
      "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    );
  }
}

type SeedOut = {
  companyA: { id: string; orgnr: string };
  companyB: { id: string; orgnr: string };
  superadmin: { email: string; password: string; user_id: string };
  empA: { email: string; password: string; user_id: string };
  empB: { email: string; password: string; user_id: string };
  orderA: { id: string };
  orderB: { id: string };
  locA: { id: string };
  locB: { id: string };
};

type Role = "superadmin" | "employee";

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function srv(): SupabaseClient {
  return createClient(URL, SRV, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonWithToken(access_token: string): SupabaseClient {
  // RLS-test: bruker ANON + bearer token
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${access_token}` } },
  });
}

async function createAuthUser(email: string, password: string, role: Role) {
  const s = srv();
  const res = await s.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });
  if (res.error || !res.data.user) throw new Error(`createUser failed: ${res.error?.message}`);
  return res.data.user.id;
}

async function signInAccessToken(email: string, password: string) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await c.auth.signInWithPassword({ email, password });
  if (res.error || !res.data.session?.access_token) {
    throw new Error(`signIn failed for ${email}: ${res.error?.message}`);
  }
  return res.data.session.access_token;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function baseAgreement(ts: number) {
  // companies.agreement_json er NOT NULL i din DB → må alltid settes i test-seed
  return {
    level: "BASIS",
    price_per_portion_ex_vat: 90,
    binding_months: 12,
    notice_months: 3,
    delivery_days: ["mon", "tue", "wed", "thu", "fri"],
    createdBy: "tenant-test",
    createdAt: new Date(ts).toISOString(),
  };
}

/**
 * profiles.role kan ikke endres i din DB (policy/trigger).
 * Derfor:
 * 1) prøv INSERT (setter role riktig ved første opprettelse)
 * 2) hvis den finnes allerede -> safe UPDATE uten role/company_id
 */
async function ensureProfile(
  s: SupabaseClient,
  payload: {
    user_id: string;
    company_id: string | null; // superadmin kan være NULL (global)
    role: Role;
    name: string;
    phone: string;
    email: string;
    is_active: boolean;
  }
) {
  const ins = await s.from("profiles").insert({
    id: uuid(), // din DB krever id (NOT NULL)
    user_id: payload.user_id,
    company_id: payload.company_id,
    role: payload.role,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    is_active: payload.is_active,
  });

  if (!ins.error) return ins;

  const msg = String(ins.error.message ?? "").toLowerCase();
  const looksLikeConflict =
    msg.includes("duplicate") ||
    msg.includes("unique") ||
    msg.includes("already exists") ||
    msg.includes("violates");

  if (!looksLikeConflict) return ins;

  // safe update: ikke rør role eller company_id
  return await s
    .from("profiles")
    .update({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      is_active: payload.is_active,
    })
    .eq("user_id", payload.user_id);
}

async function seed(): Promise<SeedOut> {
  const s = srv();
  const ts = Date.now();
  const orgA = `99${String(ts).slice(-7)}`.slice(0, 9);
  const orgB = `98${String(ts + 1).slice(-7)}`.slice(0, 9);

  // 1) companies
  const ca = await s
    .from("companies")
    .insert({
      name: `TestCo A ${ts}`,
      orgnr: orgA,
      status: "active",
      employee_count: 25,
      agreement_json: baseAgreement(ts),
    })
    .select("id,orgnr")
    .single();
  if (ca.error) throw new Error(`insert company A failed: ${ca.error.message}`);

  const cb = await s
    .from("companies")
    .insert({
      name: `TestCo B ${ts}`,
      orgnr: orgB,
      status: "active",
      employee_count: 25,
      agreement_json: baseAgreement(ts),
    })
    .select("id,orgnr")
    .single();
  if (cb.error) throw new Error(`insert company B failed: ${cb.error.message}`);

  // 2) auth users
  const superEmail = `superadmin_${ts}@test.local`;
  const empAEmail = `empA_${ts}@test.local`;
  const empBEmail = `empB_${ts}@test.local`;
  const pw = "TestPassw0rd!";

  const superId = await createAuthUser(superEmail, pw, "superadmin");
  const empAId = await createAuthUser(empAEmail, pw, "employee");
  const empBId = await createAuthUser(empBEmail, pw, "employee");

  // 3) profiles (policy-aware)
  const pS = await ensureProfile(s, {
    user_id: superId,
    company_id: null, // global
    role: "superadmin",
    name: "Superadmin",
    phone: "90000000",
    email: superEmail,
    is_active: true,
  });
  if (pS.error) throw new Error(`profile superadmin failed: ${pS.error.message}`);

  const pA = await ensureProfile(s, {
    user_id: empAId,
    company_id: ca.data!.id,
    role: "employee",
    name: "Emp A",
    phone: "33333333",
    email: empAEmail,
    is_active: true,
  });
  if (pA.error) throw new Error(`profile empA failed: ${pA.error.message}`);

  const pB = await ensureProfile(s, {
    user_id: empBId,
    company_id: cb.data!.id,
    role: "employee",
    name: "Emp B",
    phone: "44444444",
    email: empBEmail,
    is_active: true,
  });
  if (pB.error) throw new Error(`profile empB failed: ${pB.error.message}`);

  // 4) locations — MUST satisfy NOT NULL constraints in your schema
  const tsISO = nowISO();

  const la = await s
    .from("company_locations")
    .insert({
      id: uuid(),
      company_id: ca.data!.id,
      label: "HQ A",
      name: "Hovedkontor A",
      address_line1: "Testveien 1",
      postal_code: "7037",
      city: "Trondheim",
      delivery_contact_country: "NO",
      delivery_contact_phone: "91234567",
      delivery_json: { instructions: "Leveres i resepsjon", access: "Ring på" },
      created_at: tsISO,
      updated_at: tsISO,
    })
    .select("id")
    .single();
  if (la.error) throw new Error(`insert location A failed: ${la.error.message}`);

  const lb = await s
    .from("company_locations")
    .insert({
      id: uuid(),
      company_id: cb.data!.id,
      label: "HQ B",
      name: "Hovedkontor B",
      address_line1: "Testveien 2",
      postal_code: "7037",
      city: "Trondheim",
      delivery_contact_country: "NO",
      delivery_contact_phone: "91234568",
      delivery_json: { instructions: "Leveres ved bakinngang", access: "Kode 1234" },
      created_at: tsISO,
      updated_at: tsISO,
    })
    .select("id")
    .single();
  if (lb.error) throw new Error(`insert location B failed: ${lb.error.message}`);

  // 5) orders
  const today = isoToday();

  const oa = await s
    .from("orders")
    .insert({
      user_id: empAId,
      date: today,
      status: "active",
      note: "A",
      company_id: ca.data!.id,
      location_id: la.data!.id,
      slot: "lunch",
    })
    .select("id")
    .single();
  if (oa.error) throw new Error(`insert order A failed: ${oa.error.message}`);

  const ob = await s
    .from("orders")
    .insert({
      user_id: empBId,
      date: today,
      status: "active",
      note: "B",
      company_id: cb.data!.id,
      location_id: lb.data!.id,
      slot: "lunch",
    })
    .select("id")
    .single();
  if (ob.error) throw new Error(`insert order B failed: ${ob.error.message}`);

  return {
    companyA: { id: ca.data!.id, orgnr: ca.data!.orgnr },
    companyB: { id: cb.data!.id, orgnr: cb.data!.orgnr },
    superadmin: { email: superEmail, password: pw, user_id: superId },
    empA: { email: empAEmail, password: pw, user_id: empAId },
    empB: { email: empBEmail, password: pw, user_id: empBId },
    orderA: { id: oa.data!.id },
    orderB: { id: ob.data!.id },
    locA: { id: la.data!.id },
    locB: { id: lb.data!.id },
  };
}

async function cleanup(seed: SeedOut) {
  const s = srv();

  const safe = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch {
      // cleanup skal aldri knekke test-run
    }
  };

  await safe(async () => {
    const { error } = await s.from("orders").delete().in("id", [seed.orderA.id, seed.orderB.id]);
    if (error) throw error;
  });

  await safe(async () => {
    const { error } = await s
      .from("profiles")
      .delete()
      .in("user_id", [seed.superadmin.user_id, seed.empA.user_id, seed.empB.user_id]);
    if (error) throw error;
  });

  await safe(async () => {
    const { error } = await s.from("company_locations").delete().in("id", [seed.locA.id, seed.locB.id]);
    if (error) throw error;
  });

  await safe(async () => {
    const { error } = await s.from("companies").delete().in("id", [seed.companyA.id, seed.companyB.id]);
    if (error) throw error;
  });

  await safe(() => s.auth.admin.deleteUser(seed.superadmin.user_id));
  await safe(() => s.auth.admin.deleteUser(seed.empA.user_id));
  await safe(() => s.auth.admin.deleteUser(seed.empB.user_id));
}

describe("Tenant isolation (RLS) — Lunchportalen", () => {
  let S: SeedOut | null = null;

  beforeAll(async () => {
    mustEnv();
    S = await seed();
  }, 120_000);

  afterAll(async () => {
    if (S) await cleanup(S);
  }, 120_000);

  it("employee A cannot read orders from company B", async () => {
    if (!S) throw new Error("Seed missing");

    const token = await signInAccessToken(S.empA.email, S.empA.password);
    const A = anonWithToken(token);

    const res = await A.from("orders").select("id, company_id").eq("id", S.orderB.id);
    // kan være tomt eller error, men aldri data
    expect(res.data ?? []).toHaveLength(0);
  });

  it("employee A can read own order (company A)", async () => {
    if (!S) throw new Error("Seed missing");

    const token = await signInAccessToken(S.empA.email, S.empA.password);
    const A = anonWithToken(token);

    const res = await A.from("orders").select("id, company_id, user_id").eq("id", S.orderA.id);
    expect(res.error).toBeNull();
    expect(res.data ?? []).toHaveLength(1);
    expect(res.data?.[0]?.user_id).toBe(S.empA.user_id);
    expect(res.data?.[0]?.company_id).toBe(S.companyA.id);
  });

  it("employee A cannot read profiles in company A (except own)", async () => {
    if (!S) throw new Error("Seed missing");

    const token = await signInAccessToken(S.empA.email, S.empA.password);
    const C = anonWithToken(token);

    const res1 = await C.from("profiles").select("user_id, company_id, role").eq("user_id", S.superadmin.user_id);
    expect(res1.error).toBeNull();
    expect(res1.data ?? []).toHaveLength(0);

    const res2 = await C.from("profiles").select("user_id, company_id, role").eq("user_id", S.empA.user_id);
    expect(res2.error).toBeNull();
    expect(res2.data ?? []).toHaveLength(1);
  });

  it("employee A cannot read company_locations", async () => {
    if (!S) throw new Error("Seed missing");

    const token = await signInAccessToken(S.empA.email, S.empA.password);
    const C = anonWithToken(token);

    const res = await C.from("company_locations").select("id, company_id").eq("id", S.locA.id);
    // ansatt skal ikke få data; enten tomt eller error er ok
    expect(res.data ?? []).toHaveLength(0);
  });

  it("superadmin can read orders from both companies", async () => {
    if (!S) throw new Error("Seed missing");

    const token = await signInAccessToken(S.superadmin.email, S.superadmin.password);
    const SA = anonWithToken(token);

    const a = await SA.from("orders").select("id").eq("id", S.orderA.id);
    expect(a.error).toBeNull();
    expect(a.data ?? []).toHaveLength(1);

    const b = await SA.from("orders").select("id").eq("id", S.orderB.id);
    expect(b.error).toBeNull();
    expect(b.data ?? []).toHaveLength(1);
  });
});
