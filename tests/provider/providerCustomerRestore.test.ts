import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { executeProviderCustomerRestore } from "@/lib/server/provider/providerCustomerRestore";
import { loadProviderScopedCustomer } from "@/lib/server/provider/providerCustomerRemoval";

const ROOT = process.cwd();

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mkAdmin(state: {
  companies: Record<string, unknown>[];
  providers?: Record<string, unknown>[];
  agreements?: Record<string, unknown>[];
}) {
  return {
    from: (table: string) => {
      const b: any = {
        _eq: [] as Array<{ col: string; val: unknown }>,
        _update: null as Record<string, unknown> | null,
        select: () => b,
        eq: (col: string, val: unknown) => {
          b._eq.push({ col, val });
          return b;
        },
        update: (payload: Record<string, unknown>) => {
          b._update = payload;
          return b;
        },
        limit: () => b,
        maybeSingle: async () => {
          if (table === "companies") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.companies.find((c) => c.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "providers") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = (state.providers ?? []).find((p) => p.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "agreements") {
            const companyEq = b._eq.find((f: { col: string }) => f.col === "company_id");
            const row =
              (state.agreements ?? []).find((a) => a.company_id === companyEq?.val && a.status === "ACTIVE") ?? null;
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) => {
          if (table === "companies" && b._update) {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.companies.find((c) => c.id === idEq?.val);
            if (row) Object.assign(row, b._update);
          }
          resolve({ data: null, error: null });
        },
      };
      return b;
    },
  };
}

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => undefined),
}));

vi.mock("@/lib/observability/incident", () => ({
  logIncident: vi.fn(async () => undefined),
}));

describe("provider customer restore", () => {
  it("blokkerer self-customer", async () => {
    const admin = mkAdmin({
      providers: [{ id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "123456789" }],
      companies: [
        {
          id: MELHUS_PROVIDER_ID,
          name: "Melhus Catering AS",
          orgnr: "123456789",
          provider_id: MELHUS_PROVIDER_ID,
          deleted_at: "2026-06-01T00:00:00Z",
          status: "CLOSED",
        },
      ],
    });

    const scoped = await loadProviderScopedCustomer(admin as any, MELHUS_PROVIDER_ID, MELHUS_PROVIDER_ID);
    expect(scoped).toMatchObject({ code: "SELF_CUSTOMER" });
  });

  it("blokkerer cross-provider restore", async () => {
    const admin = mkAdmin({
      providers: [{ id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "123456789" }],
      companies: [
        {
          id: PETTERSEN_ID,
          name: "Pettersen&Co",
          orgnr: "987654321",
          provider_id: OTHER_PROVIDER_ID,
          deleted_at: "2026-06-01T00:00:00Z",
          status: "CLOSED",
        },
      ],
    });

    const scoped = await loadProviderScopedCustomer(admin as any, MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(scoped).toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("gjenoppretter arkivert kunde uten å opprette duplikat", async () => {
    const companies = [
      {
        id: PETTERSEN_ID,
        name: "Pettersen&Co",
        orgnr: "987654321",
        provider_id: MELHUS_PROVIDER_ID,
        deleted_at: "2026-06-01T00:00:00Z",
        status: "CLOSED",
      },
    ];
    const admin = mkAdmin({
      providers: [{ id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "123456789" }],
      companies,
      agreements: [],
    });

    const result = await executeProviderCustomerRestore(
      admin as any,
      { rid: "rid_restore", userId: "u1", email: "a@b.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: PETTERSEN_ID,
        confirmation: "Pettersen&Co",
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.companyId).toBe(PETTERSEN_ID);
      expect(result.message).toContain("Avtale må aktiveres");
    }
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      id: PETTERSEN_ID,
      status: "ACTIVE",
      deleted_at: null,
      provider_id: MELHUS_PROVIDER_ID,
    });
  });

  it("UI og API har restore uten order write-path", () => {
    const list = readFileSync(join(ROOT, "components/providers/CustomerList.tsx"), "utf8");
    const route = readFileSync(join(ROOT, "app/api/provider/customers/[companyId]/restore/route.ts"), "utf8");
    const loader = readFileSync(join(ROOT, "lib/providers/loadProviderCustomers.ts"), "utf8");

    expect(list).toContain('tActions("restoreCustomer")');
    expect(list).toContain("ProviderCustomerRestoreDialog");
    expect(loader).toContain("isProviderSelfCustomer");
    expect(route).not.toContain("lp_order_set");
    expect(route).not.toContain("lp_order_advance_status");
  });
});
