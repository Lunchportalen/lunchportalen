import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { loadProviderCustomerDetail } from "@/lib/providers/loadProviderCustomerDetail";

const ROOT = process.cwd();

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const PETTERSEN_ID = "907c0624-101d-49af-8ce3-44f1830172b0";
const MELHUS_COMPANY_ID = "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7";

vi.mock("@/lib/kitchen/kitchenMealNote", () => ({
  buildVariantTitleLookup: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/providers/providerOrderEnrichment", () => ({
  buildAllowedDayChoiceKeys: vi.fn(() => new Set()),
  fetchProviderOrderEnrichment: vi.fn(async () => ({
    profileById: new Map([
      ["user-1", { full_name: "Thomas Johansen", email: "thomas@pettersenco.no" }],
    ]),
    locationById: new Map(),
    dayChoiceMap: new Map(),
    itemsByOrder: new Map([
      ["order-1", [{ productNameSnapshot: "Paasmurt", quantity: 1, allergens: [] }]],
    ]),
  })),
}));

function mkSb(state: {
  company: Record<string, unknown> | null;
  provider?: Record<string, unknown> | null;
  agreements?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  orders?: Record<string, unknown>[];
  ordersOpenCount?: number;
  ordersMonth?: Record<string, unknown>[];
}) {
  const chain = (table: string) => {
    const b: any = {
      _eq: [] as Array<{ col: string; val: unknown }>,
      _head: false,
      _gte: false,
      select: (cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) b._head = true;
        b._cols = cols;
        return b;
      },
      eq: (col: string, val: unknown) => {
        b._eq.push({ col, val });
        return b;
      },
      in: () => b,
      gte: () => {
        b._gte = true;
        return b;
      },
      lte: () => b,
      is: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => {
        if (table === "companies") return { data: state.company, error: null };
        if (table === "providers") return { data: state.provider ?? null, error: null };
        return { data: null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: null; count?: number }) => void) => {
        if (table === "agreements") resolve({ data: state.agreements ?? [], error: null });
        else if (table === "company_locations") resolve({ data: state.locations ?? [], error: null });
        else if (table === "orders" && b._head) resolve({ data: null, error: null, count: state.ordersOpenCount ?? 0 });
        else if (table === "orders" && b._gte) resolve({ data: state.ordersMonth ?? [], error: null });
        else if (table === "orders") resolve({ data: state.orders ?? [], error: null });
        else resolve({ data: [], error: null });
      },
    };
    return b;
  };
  return { from: chain };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

describe("loadProviderCustomerDetail", () => {
  it("returnerer null for cross-provider kunde", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(supabaseServer).mockResolvedValue(
      mkSb({
        company: { id: PETTERSEN_ID, name: "Pettersen&Co", provider_id: OTHER_PROVIDER_ID },
      }) as any,
    );

    const detail = await loadProviderCustomerDetail(MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(detail).toBeNull();
  });

  it("blokkerer self-customer (Melhus som egen kunde)", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    vi.mocked(supabaseServer).mockResolvedValue(
      mkSb({
        company: {
          id: MELHUS_COMPANY_ID,
          name: "Melhus Catering AS",
          orgnr: "123456789",
          provider_id: MELHUS_PROVIDER_ID,
        },
        provider: { id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "123456789" },
      }) as any,
    );

    const detail = await loadProviderCustomerDetail(MELHUS_PROVIDER_ID, MELHUS_COMPANY_ID);
    expect(detail).toBeNull();
  });

  it("returnerer ansatte, historiske ordre og linjer for scoped kunde", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");

    vi.mocked(supabaseServer).mockResolvedValue(
      mkSb({
        company: {
          id: PETTERSEN_ID,
          name: "Pettersen&Co",
          orgnr: "928038777",
          provider_id: MELHUS_PROVIDER_ID,
        },
        provider: { id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "999999999" },
        agreements: [
          {
            id: "agr-1",
            status: "ACTIVE",
            created_at: "2026-05-01",
            delivery_days: ["mon"],
            location_id: "loc-1",
          },
        ],
        orders: [
          {
            id: "order-1",
            date: "2026-06-16",
            status: "DELIVERED",
            gross_cents_inc_vat: 10350,
            subtotal_cents_ex_vat: 8280,
            vat_cents: 2070,
            user_id: "user-1",
            location_id: null,
            slot: "lunch",
          },
        ],
        ordersMonth: [
          {
            gross_cents_inc_vat: 10350,
            subtotal_cents_ex_vat: 8280,
            vat_cents: 2070,
          },
        ],
        ordersOpenCount: 0,
      }) as any,
    );

    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        const b: any = {
          _in: null as { col: string; vals: unknown[] } | null,
          select: () => b,
          eq: () => b,
          in: (col: string, vals: unknown[]) => {
            b._in = { col, vals };
            return b;
          },
          gte: () => b,
          lt: () => b,
          is: () => b,
          or: () => b,
          order: () => b,
          limit: () => b,
          then: (resolve: (v: { data: unknown; error: null }) => void) => {
            if (table === "profiles") {
              resolve({
                data: [
                  {
                    company_id: PETTERSEN_ID,
                    id: "p1",
                    full_name: "Thomas Johansen",
                    email: "thomas@pettersenco.no",
                    role: "employee",
                  },
                  {
                    company_id: PETTERSEN_ID,
                    id: "p2",
                    full_name: "Thomas",
                    email: "hei@pettersenco.no",
                    role: "company_admin",
                  },
                ],
                error: null,
              });
            } else if (table === "orders") {
              resolve({
                data: [{ company_id: PETTERSEN_ID }],
                error: null,
              });
            } else if (table === "audit_events") {
              resolve({
                data: [
                  {
                    id: "ev-1",
                    created_at: "2026-05-11T19:40:26Z",
                    action: "company_registration_submitted",
                    summary: "Firma registrerte avtaleforespørsel.",
                  },
                ],
                error: null,
              });
            } else if (table === "company_locations") {
              resolve({
                data: [
                  {
                    id: "loc-1",
                    name: "Hovedlokasjon",
                    address: "Sluppenvegen 25, 7037 Trondheim",
                  },
                ],
                error: null,
              });
            } else resolve({ data: [], error: null });
          },
        };
        return b;
      },
    } as any);

    const detail = await loadProviderCustomerDetail(MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.stats.employeesCount).toBe(2);
    expect(detail.stats.historicalOrdersCount).toBe(1);
    expect(detail.billingBasis.confidence).toBe("complete");
    expect(detail.billingBasis.commissionBaseLabel).toBe("eks. mva");
    expect(detail.employees).toHaveLength(2);
    expect(detail.orders).toHaveLength(1);
    expect(detail.orders[0]?.status).toBe("DELIVERED");
    expect(detail.orders[0]?.lines[0]?.productName).toBe("Paasmurt");
    expect(detail.activity[0]?.eventKey).toBe("company_registration_submitted");
    expect(detail.agreements).toHaveLength(1);
    expect(detail.locations).toHaveLength(1);
    expect(detail.locations[0]?.name).toBe("Hovedlokasjon");
    expect(detail.primaryLocationName).toBe("Hovedlokasjon");
    expect(detail.primaryLocationAddress).toBe("Sluppenvegen 25, 7037 Trondheim");
  });

  it("bruker ikke line_total eller lifecycle_audit_log", () => {
    const loader = readFileSync(join(ROOT, "lib/providers/loadProviderCustomerDetail.ts"), "utf8");
    const client = readFileSync(join(ROOT, "components/providers/CustomerDetailClient.tsx"), "utf8");

    expect(loader).not.toContain("line_total");
    expect(loader).not.toContain("lifecycle_audit_log");
    expect(loader).toContain("gross_cents_inc_vat");
    expect(loader).toContain("audit_events");
    expect(loader).not.toContain("lp_order_set");
    expect(loader).not.toContain("lp_order_advance_status");
    expect(loader).toContain("loadScopedCompanyLocations");
    expect(client).toContain("ProviderDetailAccordionSection");
    expect(client).not.toContain("Oversikt over ansatte er ikke tilgjengelig ennå");
    expect(client).not.toContain("Ingen ordrer.");
  });
});
