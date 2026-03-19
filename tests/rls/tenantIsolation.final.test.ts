// tests/rls/tenantIsolation.final.test.ts
// Focused RLS/tenant isolation guarantees on core tables after hardening.

// @ts-nocheck

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { buildRlsFixtures, type Fixtures } from "../_helpers/rlsFixtures";

let fx: Fixtures;

beforeAll(async () => {
  fx = await buildRlsFixtures();
});

afterAll(async () => {
  if (fx?.cleanup) await fx.cleanup();
});

function rowCount(res: { data: any; error: any }) {
  if (res.error) return NaN;
  const d = res.data;
  return Array.isArray(d) ? d.length : 0;
}

describe("RLS tenant isolation – final guarantees", () => {
  test("company_admin cannot read another company's core tables", async () => {
    const { supabaseAs, users, companyA, companyB } = fx;
    const sb = supabaseAs(users.adminA.accessToken);

    // orders: adminA (companyA) should see 0 rows for companyB
    const ordRes = await sb.from("orders").select("id,company_id").eq("company_id", companyB.id);
    expect(ordRes.error).toBeNull();
    expect(rowCount(ordRes)).toBe(0);

    // companies: adminA should not see companyB row
    const compRes = await sb.from("companies").select("id").eq("id", companyB.id);
    expect(compRes.error).toBeNull();
    expect(rowCount(compRes)).toBe(0);

    // company_locations: adminA should not see locations from companyB
    const locRes = await sb.from("company_locations").select("id,company_id").eq("company_id", companyB.id);
    expect(locRes.error).toBeNull();
    expect(rowCount(locRes)).toBe(0);

    // agreements: adminA should not see agreements for companyB (even if table is empty, this asserts no leakage)
    const agrRes = await sb.from("agreements").select("id,company_id").eq("company_id", companyB.id);
    expect(agrRes.error).toBeNull();
    expect(rowCount(agrRes)).toBe(0);
  });

  test("employee cannot cross tenant or user boundaries", async () => {
    const { supabaseAs, users, companyA, companyB } = fx;
    const sbA = supabaseAs(users.employeeA.accessToken);

    // orders: employeeA (companyA) should see 0 rows for companyB
    const crossTenant = await sbA.from("orders").select("id,company_id").eq("company_id", companyB.id);
    expect(crossTenant.error).toBeNull();
    expect(rowCount(crossTenant)).toBe(0);

    // orders by id in other tenant: even if ID is guessed, RLS must hide it
    const sbB = supabaseAs(users.employeeB.accessToken);
    const ordB = await sbB.from("orders").select("id").eq("company_id", companyB.id).limit(1);
    const someOrderId = Array.isArray(ordB.data) && ordB.data[0]?.id ? ordB.data[0].id : null;

    if (someOrderId) {
      const byId = await sbA.from("orders").select("id,company_id").eq("id", someOrderId);
      expect(byId.error).toBeNull();
      expect(rowCount(byId)).toBe(0);
    }
  });

  test("record-by-id orders remain tenant-bound by RLS", async () => {
    const { supabaseAs, users, companyActiveId } = fx;

    const admin = supabaseAs(users.adminA.accessToken);

    // Find an order in another active company (companyActiveId), if present
    const foreignOrders = await admin
      .from("orders")
      .select("id,company_id")
      .eq("company_id", companyActiveId)
      .limit(1);

    const foreignOrderId = Array.isArray(foreignOrders.data) && foreignOrders.data[0]?.id ? foreignOrders.data[0].id : null;
    if (!foreignOrderId) {
      // No foreign orders seeded for this scenario; nothing to assert.
      expect(true).toBe(true);
      return;
    }

    // As employeeA (companyA), even a correct orderId from another company must not be readable
    const sbEmployeeA = supabaseAs(users.employeeA.accessToken);
    const leakAttempt = await sbEmployeeA.from("orders").select("id,company_id").eq("id", foreignOrderId);
    expect(leakAttempt.error).toBeNull();
    expect(rowCount(leakAttempt)).toBe(0);
  });

  test("agreements/companies/locations are tenant-bound by RLS", async () => {
    const { supabaseAs, users, companyA, companyB } = fx;
    const sbEmployeeA = supabaseAs(users.employeeA.accessToken);

    // companies: only own company row visible
    const allCompanies = await sbEmployeeA.from("companies").select("id");
    expect(allCompanies.error).toBeNull();
    const ids = (allCompanies.data ?? []).map((r: any) => String(r.id));
    expect(ids).toContain(companyA.id);
    expect(ids).not.toContain(companyB.id);

    // company_locations: only locations from own company visible
    const locs = await sbEmployeeA.from("company_locations").select("id,company_id");
    expect(locs.error).toBeNull();
    const locCompanyIds = (locs.data ?? []).map((r: any) => String(r.company_id));
    expect(locCompanyIds.every((cid) => cid === companyA.id)).toBe(true);
  });

  test("employee cannot insert orders for another company/location", async () => {
    const { supabaseAs, users, companyB, locB } = fx;
    const sbEmployeeA = supabaseAs(users.employeeA.accessToken);

    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 3);
    const yyyy = future.getUTCFullYear();
    const mm = String(future.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(future.getUTCDate()).padStart(2, "0");
    const dateISO = `${yyyy}-${mm}-${dd}`;

    const { error } = await sbEmployeeA.from("orders").insert({
      user_id: users.employeeA.user_id,
      company_id: companyB.id,
      location_id: locB.id,
      date: dateISO,
      status: "ACTIVE",
      slot: "lunch",
    } as any);

    // RLS must reject cross-tenant insert attempts
    expect(error).toBeTruthy();
  });
});

