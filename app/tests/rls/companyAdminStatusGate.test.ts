// tests/rls/companyAdminStatusGate.test.ts
import { describe, test, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { buildRlsFixtures, type Fixtures } from "../_helpers/rlsFixtures";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(name: string, v: string | undefined) {
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
}

requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON);

function supabaseAs(accessToken: string) {
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type QueryResult<T> = { data: T[] | null; error: any };

// Supabase queries are "thenable" (PromiseLike) — TS doesn't always treat them as Promise.
// This helper accepts PromiseLike to avoid PostgrestFilterBuilder typing issues.
async function selectCountOrZero<T>(q: PromiseLike<QueryResult<T>>) {
  const { data, error } = await q;
  if (error) return { ok: false as const, count: 0, error };
  return { ok: true as const, count: (data ?? []).length, error: null };
}

async function getFixtures(): Promise<Fixtures> {
  return await buildRlsFixtures();
}

describe("RLS: company_admin status gate (active/paused/closed)", () => {
  let fx: Fixtures;

  beforeAll(async () => {
    fx = await getFixtures();
  });

  test("companies: admin ACTIVE can read own company; PAUSED/CLOSED cannot", async () => {
    const sActive = supabaseAs(fx.adminActive.access_token);
    const sPaused = supabaseAs(fx.adminPaused.access_token);
    const sClosed = supabaseAs(fx.adminClosed.access_token);

    const a = await selectCountOrZero(sActive.from("companies").select("id").eq("id", fx.companyActiveId));
    expect(a.count).toBe(1);

    const p = await selectCountOrZero(sPaused.from("companies").select("id").eq("id", fx.companyPausedId));
    expect(p.count).toBe(0);

    const c = await selectCountOrZero(sClosed.from("companies").select("id").eq("id", fx.companyClosedId));
    expect(c.count).toBe(0);
  });

  test("orders: admin ACTIVE can read company orders; PAUSED/CLOSED cannot", async () => {
    const sActive = supabaseAs(fx.adminActive.access_token);
    const sPaused = supabaseAs(fx.adminPaused.access_token);
    const sClosed = supabaseAs(fx.adminClosed.access_token);

    const a = await selectCountOrZero(
      sActive.from("orders").select("id").eq("company_id", fx.companyActiveId).limit(5)
    );
    expect(a.count).toBeGreaterThan(0);

    const p = await selectCountOrZero(
      sPaused.from("orders").select("id").eq("company_id", fx.companyPausedId).limit(5)
    );
    expect(p.count).toBe(0);

    const c = await selectCountOrZero(
      sClosed.from("orders").select("id").eq("company_id", fx.companyClosedId).limit(5)
    );
    expect(c.count).toBe(0);
  });

  test("profiles: admin ACTIVE can read employees in own company; PAUSED cannot", async () => {
    const sActive = supabaseAs(fx.adminActive.access_token);
    const sPaused = supabaseAs(fx.adminPaused.access_token);

    const a = await selectCountOrZero(
      sActive.from("profiles").select("id").eq("company_id", fx.companyActiveId).limit(5)
    );
    expect(a.count).toBeGreaterThan(0);

    const p = await selectCountOrZero(
      sPaused.from("profiles").select("id").eq("company_id", fx.companyPausedId).limit(5)
    );
    expect(p.count).toBe(0);
  });

  test("company_locations: admin ACTIVE can read own locations; PAUSED cannot", async () => {
    const sActive = supabaseAs(fx.adminActive.access_token);
    const sPaused = supabaseAs(fx.adminPaused.access_token);

    const a = await selectCountOrZero(
      sActive.from("company_locations").select("id").eq("company_id", fx.companyActiveId).limit(5)
    );
    expect(a.count).toBeGreaterThan(0);

    const p = await selectCountOrZero(
      sPaused.from("company_locations").select("id").eq("company_id", fx.companyPausedId).limit(5)
    );
    expect(p.count).toBe(0);
  });

  test("isolation: admin A can never read other company even if ACTIVE", async () => {
    const sA = supabaseAs(fx.adminActive.access_token);

    const other = await selectCountOrZero(
      sA.from("orders").select("id").eq("company_id", fx.companyOtherId).limit(5)
    );
    expect(other.count).toBe(0);
  });

  test("superadmin unaffected: can read paused/closed companies", async () => {
    const s = supabaseAs(fx.superadmin.access_token);

    const paused = await selectCountOrZero(s.from("companies").select("id").eq("id", fx.companyPausedId));
    expect(paused.count).toBe(1);

    const closed = await selectCountOrZero(s.from("companies").select("id").eq("id", fx.companyClosedId));
    expect(closed.count).toBe(1);
  });
});
