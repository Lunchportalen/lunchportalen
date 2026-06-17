import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { loadSuperadminProviderDetail } from "@/lib/server/superadmin/loadSuperadminProviderDetail";
import { loadSuperadminProviderList } from "@/lib/server/superadmin/loadSuperadminProviderList";
import {
  isLunchCustomerCompanyRow,
  isProtectedSystemCompany,
  isSystemPlatformCompanyName,
  PROTECTED_SYSTEM_COMPANY_MESSAGE,
} from "@/lib/server/superadmin/superadminEntityKind";
import { evaluateCompanyRemovalEligibility } from "@/lib/server/superadmin/companyRemovalPolicy";

const ROOT = process.cwd();

const MELHUS_PROVIDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PETTERSEN_COMPANY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LUNCHPORTALEN_COMPANY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function mkAdminMock(state: {
  providers: Record<string, unknown>[];
  companies: Record<string, unknown>[];
  agreements: Record<string, unknown>[];
}) {
  return {
    from: (table: string) => {
      const b: any = {
        _filters: [] as Array<{ op: string; col: string; val: unknown }>,
        select: () => b,
        order: () => b,
        range: () => b,
        eq: (col: string, val: unknown) => {
          b._filters.push({ op: "eq", col, val });
          return b;
        },
        in: (col: string, val: unknown) => {
          b._filters.push({ op: "in", col, val });
          return b;
        },
        neq: () => b,
        is: () => b,
        or: () => b,
        maybeSingle: async () => {
          if (table !== "providers") return { data: null, error: null };
          const id = b._filters.find((f: { col: string }) => f.col === "id")?.val;
          const row = state.providers.find((p) => p.id === id) ?? null;
          return { data: row, error: null };
        },
        then: (resolve: (v: { data: unknown; error: null; count?: number }) => void) => {
          if (table === "providers") {
            resolve({ data: state.providers, error: null, count: state.providers.length });
            return;
          }
          if (table === "companies") {
            const providerEq = b._filters.find((f: { col: string; op: string }) => f.col === "provider_id" && f.op === "eq");
            const providerIn = b._filters.find((f: { col: string; op: string }) => f.col === "provider_id" && f.op === "in");
            let rows = state.companies;
            if (providerEq) {
              rows = rows.filter((c) => c.provider_id === providerEq.val);
            } else if (providerIn && Array.isArray(providerIn.val)) {
              const ids = new Set(providerIn.val as string[]);
              rows = rows.filter((c) => ids.has(String(c.provider_id)));
            }
            resolve({ data: rows, error: null });
            return;
          }
          if (table === "agreements") {
            resolve({ data: state.agreements, error: null });
            return;
          }
          resolve({ data: [], error: null });
        },
      };
      return b;
    },
  };
}

describe("superadminEntityKind", () => {
  it("identifiserer Lunchportalen som systemorganisasjon", () => {
    expect(isSystemPlatformCompanyName("Lunchportalen")).toBe(true);
    expect(isSystemPlatformCompanyName("Lunchportalen AS")).toBe(true);
    expect(isSystemPlatformCompanyName("Lunchportalen QA")).toBe(true);
    expect(isSystemPlatformCompanyName("Melhus Catering AS")).toBe(false);
    expect(isSystemPlatformCompanyName("Pettersen&Co")).toBe(false);
  });

  it("skiller lunsjkunde fra leverandør via provider_id", () => {
    expect(
      isLunchCustomerCompanyRow({
        id: PETTERSEN_COMPANY_ID,
        provider_id: MELHUS_PROVIDER_ID,
        name: "Pettersen&Co",
      })
    ).toBe(true);
    expect(
      isLunchCustomerCompanyRow({
        id: MELHUS_PROVIDER_ID,
        provider_id: null,
        name: "Melhus Catering AS",
      })
    ).toBe(false);
    expect(
      isLunchCustomerCompanyRow({
        id: LUNCHPORTALEN_COMPANY_ID,
        provider_id: MELHUS_PROVIDER_ID,
        name: "Lunchportalen QA",
      })
    ).toBe(false);
  });

  it("beskytter Lunchportalen systemorganisasjon mot sletting", () => {
    expect(isProtectedSystemCompany({ companyName: "Lunchportalen AS" })).toBe(true);
    expect(isProtectedSystemCompany({ companyName: "Pettersen&Co" })).toBe(false);
  });
});

describe("loadSuperadminProviderList", () => {
  it("returnerer kun leverandører som hovedrader med kundetelling", async () => {
    const admin = mkAdminMock({
      providers: [
        {
          id: MELHUS_PROVIDER_ID,
          name: "Melhus Catering AS",
          org_number: "123456789",
          status: "ACTIVE",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
      companies: [
        {
          id: PETTERSEN_COMPANY_ID,
          provider_id: MELHUS_PROVIDER_ID,
          name: "Pettersen&Co",
          status: "ACTIVE",
        },
        {
          id: LUNCHPORTALEN_COMPANY_ID,
          provider_id: MELHUS_PROVIDER_ID,
          name: "Lunchportalen QA",
          status: "ACTIVE",
        },
      ],
      agreements: [{ company_id: PETTERSEN_COMPANY_ID, status: "ACTIVE" }],
    });

    const result = await loadSuperadminProviderList(admin as any, {
      page: 1,
      limit: 25,
      sort: "name",
      dir: "asc",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Melhus Catering AS");
    expect(result.items[0]?.entityKind).toBe("provider");
    expect(result.items[0]?.customersCount).toBe(1);
    expect(result.items[0]?.activeAgreementsCount).toBe(1);
    expect(result.items.some((row) => row.name === "Pettersen&Co")).toBe(false);
    expect(result.items.some((row) => row.name === "Lunchportalen QA")).toBe(false);
  });
});

describe("loadSuperadminProviderDetail", () => {
  it("viser kunder under leverandør og ekskluderer systemorganisasjon", async () => {
    const admin = mkAdminMock({
      providers: [
        {
          id: MELHUS_PROVIDER_ID,
          name: "Melhus Catering AS",
          org_number: "123456789",
          status: "ACTIVE",
          contact_email: "kontakt@melhus.no",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-02-01T00:00:00Z",
        },
      ],
      companies: [
        {
          id: PETTERSEN_COMPANY_ID,
          provider_id: MELHUS_PROVIDER_ID,
          name: "Pettersen&Co",
          orgnr: "987654321",
          status: "ACTIVE",
          updated_at: "2026-03-01T00:00:00Z",
        },
        {
          id: LUNCHPORTALEN_COMPANY_ID,
          provider_id: MELHUS_PROVIDER_ID,
          name: "Lunchportalen QA",
          orgnr: "111111111",
          status: "ACTIVE",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ],
      agreements: [{ company_id: PETTERSEN_COMPANY_ID, status: "ACTIVE" }],
    });

    const detail = await loadSuperadminProviderDetail(admin as any, MELHUS_PROVIDER_ID);
    expect(detail?.entityKind).toBe("provider");
    expect(detail?.provider.name).toBe("Melhus Catering AS");
    expect(detail?.customers.map((c) => c.name)).toEqual(["Pettersen&Co"]);
    expect(detail?.customers[0]?.activeAgreement).toBe(true);
  });
});

describe("companyRemovalPolicy system org", () => {
  const ZERO = {
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

  it("blokkerer hard-delete og arkiv for Lunchportalen systemorganisasjon", () => {
    const e = evaluateCompanyRemovalEligibility({
      companyName: "Lunchportalen AS",
      orgnr: "999999999",
      deletedAt: null,
      dependencies: ZERO,
    });
    expect(e.canHardDelete).toBe(false);
    expect(e.canArchive).toBe(false);
    expect(e.archiveBlockers).toContain(PROTECTED_SYSTEM_COMPANY_MESSAGE);
  });
});

describe("Superadmin provider-first wiring", () => {
  it("GET /api/superadmin/companies bruker provider-liste", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/route.ts"), "utf8");
    expect(route).toContain("loadSuperadminProviderList");
    expect(route).toContain('list: "providers"');
    const getSection = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    expect(getSection).not.toContain('.from("companies")');
  });

  it("detalj-route prøver provider først", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/route.ts"), "utf8");
    expect(route).toContain("loadSuperadminProviderDetail");
    expect(route).toContain('entityKind: "company"');
  });

  it("rører ikke Golden Path order write-path", () => {
    const files = [
      "app/api/superadmin/companies/route.ts",
      "app/api/superadmin/companies/[companyId]/route.ts",
      "lib/server/superadmin/loadSuperadminProviderList.ts",
      "lib/server/superadmin/loadSuperadminProviderDetail.ts",
      "lib/server/superadmin/superadminEntityKind.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toContain("lp_order_advance_status");
    }
  });

  it("UI viser cateringfirma-kolonner", () => {
    const client = readFileSync(join(ROOT, "app/superadmin/companies/companies-client.tsx"), "utf8");
    expect(client).toContain("Cateringfirma og leverandører");
    expect(client).toContain("Kunder");
    expect(client).toContain("Aktive avtaler");
  });

  it("provider row open link bruker provider id og navigerer uten preventDefault", () => {
    const client = readFileSync(join(ROOT, "app/superadmin/companies/companies-client.tsx"), "utf8");
    expect(client).toContain("function providerDetailHref(id: string)");
    expect(client).toContain("openProviderDetail");
    expect(client).toContain('isProvider ? "Åpne leverandør" : "Åpne"');
    expect(client).not.toMatch(/Åpne leverandør[\s\S]{0,120}onClick=\{\(e\) => stop\(e/);
  });

  it("detail API aksepterer seed provider uuid (Melhus)", () => {
    const route = readFileSync(join(ROOT, "app/api/superadmin/companies/[companyId]/route.ts"), "utf8");
    expect(route).toContain("function isUuidLike");
    const melhusId = "11111111-1111-1111-1111-111111111111";
    const pattern = /function isUuidLike\(v: unknown\) \{[\s\S]*?return \/(.+?)\/.test\(/;
    const match = route.match(pattern);
    expect(match).not.toBeNull();
    const regex = new RegExp(match![1]!);
    expect(regex.test(melhusId)).toBe(true);
    expect(regex.test("not-a-uuid")).toBe(false);
  });
});
