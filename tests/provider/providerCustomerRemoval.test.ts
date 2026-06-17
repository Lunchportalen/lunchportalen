import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  evaluateCompanyRemovalEligibility,
  type CompanyDependencyCounts,
} from "@/lib/server/superadmin/companyRemovalPolicy";
import {
  executeProviderCustomerRemoval,
  getProviderCustomerRemovalEligibility,
  loadProviderScopedCustomer,
} from "@/lib/server/provider/providerCustomerRemoval";

const ROOT = process.cwd();
const ZERO: CompanyDependencyCounts = {
  orders: 0,
  agreements: 0,
  profiles: 0,
  tripletexCustomers: 0,
  billingAccounts: 0,
  auditEvents: 0,
  companyRegistrations: 0,
  companyLocations: 0,
  invoiceLines: 0,
  deliveries: 0,
  dayChoices: 0,
  menuServiceDays: 0,
  agreementRequests: 0,
  productionManifests: 0,
  tripletexInvoices: 0,
  agreementInvoices: 0,
};

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mkAdmin(state: {
  companies: Record<string, unknown>[];
}) {
  return {
    from: (table: string) => {
      const b: any = {
        _eq: [] as Array<{ col: string; val: unknown }>,
        select: () => b,
        eq: (col: string, val: unknown) => {
          b._eq.push({ col, val });
          return b;
        },
        maybeSingle: async () => {
          if (table !== "companies") return { data: null, error: null };
          const idEq = b._eq.find((f: { col: string }) => f.col === "id");
          const row = state.companies.find((c) => c.id === idEq?.val) ?? null;
          return { data: row, error: null };
        },
        then: (resolve: (v: { data: unknown; error: null; count?: number }) => void) => {
          if (table === "companies") {
            resolve({ data: state.companies, error: null });
          } else {
            resolve({ data: [], error: null, count: 0 });
          }
        },
      };
      return b;
    },
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
  };
}

vi.mock("@/lib/server/superadmin/companyRemovalPolicy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/superadmin/companyRemovalPolicy")>();
  return {
    ...actual,
    loadCompanyDependencyCounts: vi.fn(async () => ZERO),
  };
});

vi.mock("@/lib/server/superadmin/executeCompanyRemoval", () => ({
  executeCompanyRemoval: vi.fn(async () => ({ ok: true, mode: "archive", companyId: PETTERSEN_ID })),
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => undefined),
}));

vi.mock("@/lib/observability/incident", () => ({
  logIncident: vi.fn(async () => undefined),
}));

describe("providerCustomerRemoval scope", () => {
  it("tillater kun egen provider-kunde", async () => {
    const admin = mkAdmin({
      companies: [
        { id: PETTERSEN_ID, name: "Pettersen&Co", orgnr: "123", provider_id: MELHUS_PROVIDER_ID, deleted_at: null },
      ],
    });

    const scoped = await loadProviderScopedCustomer(admin as any, MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(scoped).toMatchObject({ id: PETTERSEN_ID, providerId: MELHUS_PROVIDER_ID });
  });

  it("blokkerer kunde fra annen provider", async () => {
    const admin = mkAdmin({
      companies: [
        { id: PETTERSEN_ID, name: "Pettersen&Co", orgnr: "123", provider_id: MELHUS_PROVIDER_ID, deleted_at: null },
      ],
    });

    const scoped = await loadProviderScopedCustomer(admin as any, OTHER_PROVIDER_ID, PETTERSEN_ID);
    expect(scoped).toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("blokkerer Lunchportalen systemorg", async () => {
    const admin = mkAdmin({
      companies: [
        {
          id: "lp-qa",
          name: "Lunchportalen QA",
          orgnr: "999",
          provider_id: MELHUS_PROVIDER_ID,
          deleted_at: null,
        },
      ],
    });

    const scoped = await loadProviderScopedCustomer(admin as any, MELHUS_PROVIDER_ID, "lp-qa");
    expect(scoped).toMatchObject({ code: "PROTECTED_SYSTEM" });
  });
});

describe("providerCustomerRemoval eligibility", () => {
  it("hard-delete blokkeres ved ordrehistorikk", async () => {
    const deps = { ...ZERO, orders: 2 };
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Test AS",
      orgnr: "123456789",
      deletedAt: null,
      dependencies: deps,
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.blockers).toContain("Ordrehistorikk finnes.");
  });

  it("getProviderCustomerRemovalEligibility returnerer eligibility for egen kunde", async () => {
    const admin = mkAdmin({
      companies: [
        { id: PETTERSEN_ID, name: "Test Utkast", orgnr: "123456789", provider_id: MELHUS_PROVIDER_ID, deleted_at: null },
      ],
    });

    const payload = await getProviderCustomerRemovalEligibility(admin as any, MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.eligibility.canHardDelete).toBe(true);
    }
  });
});

describe("providerCustomerRemoval execution", () => {
  it("videresender til executeCompanyRemoval med provider scope", async () => {
    const { executeCompanyRemoval } = await import("@/lib/server/superadmin/executeCompanyRemoval");
    const admin = mkAdmin({
      companies: [
        { id: PETTERSEN_ID, name: "Test Utkast", orgnr: "123456789", provider_id: MELHUS_PROVIDER_ID, deleted_at: null },
      ],
    });

    const result = await executeProviderCustomerRemoval(
      admin as any,
      { rid: "rid_test", userId: "user-1", email: "a@b.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: PETTERSEN_ID,
        mode: "archive",
        confirmation: "123456789 ARKIVER",
      }
    );

    expect(result.ok).toBe(true);
    expect(executeCompanyRemoval).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ rid: "rid_test" }),
      expect.objectContaining({
        companyId: PETTERSEN_ID,
        requiredProviderId: MELHUS_PROVIDER_ID,
        actorRole: "provider_admin",
      })
    );
  });
});

describe("provider customer removal wiring", () => {
  it("API route finnes og bruker provider scope helpers", () => {
    const route = readFileSync(join(ROOT, "app/api/provider/customers/[companyId]/remove/route.ts"), "utf8");
    expect(route).toContain("getProviderCustomerRemovalEligibility");
    expect(route).toContain("executeProviderCustomerRemoval");
    expect(route).toContain("hasProviderRole");
    expect(route).not.toContain("lp_order_set");
    expect(route).not.toContain("lp_order_advance_status");
  });

  it("ProviderDetailClient har staff-level seksjoner og Fjern kunde", () => {
    const client = readFileSync(join(ROOT, "app/superadmin/companies/[companyId]/ProviderDetailClient.tsx"), "utf8");
    expect(client).toContain("SuperadminHero");
    expect(client).toContain("SuperadminMetricRow");
    expect(client).toContain("Lunsjkunder");
    expect(client).toContain("Fjern kunde");
    expect(client).toContain("Åpne kunde");
  });

  it("CustomerList viser Fjern kunde for provider admin", () => {
    const list = readFileSync(join(ROOT, "components/providers/CustomerList.tsx"), "utf8");
    expect(list).toContain("Fjern kunde");
    expect(list).toContain("ProviderCustomerRemovalDialog");
  });
});
