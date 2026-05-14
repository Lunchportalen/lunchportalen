import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/lib/audit/actions", () => ({
  auditSuperadmin: vi.fn(),
}));

const RUN_ID = "aaaaaaaa-bbbb-4ccc-8000-eeeeeeeeeeee";
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

const minimalLine = {
  id: "line-1",
  company_id: COMPANY_ID,
  company_name: "Test AS",
  plan_tier: "BASIS",
  price_ex_vat: 100,
  billable_qty: 1,
  cancelled_qty: 0,
  cancelled_before_0800_qty: 0,
  amount_ex_vat: 100,
  flags: null,
};

describe("superadmin company_billing_accounts fail-soft", () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin).mockReset();
    vi.mocked(supabaseServer).mockReset();
  });

  it("GET invoices/runs/[runId]: manglende tabell → 200, tripletex_mapping_available false", async () => {
    vi.mocked(supabaseServer).mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "u1", user_metadata: { role: "superadmin" } } },
          error: null,
        }),
      },
    } as any);

    vi.mocked(supabaseAdmin).mockImplementation(
      () =>
        ({
          from: (table: string) => {
        if (table === "invoice_runs") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: RUN_ID,
                      period_from: "2026-01-01",
                      period_to: "2026-01-31",
                      status: "closed",
                      created_at: "2026-02-01T00:00:00Z",
                      note: null,
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "invoice_lines") {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [minimalLine], error: null }),
              }),
            }),
          };
        }
        if (table === "company_billing_accounts") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: null,
                  error: { code: "42P01", message: 'relation "public.company_billing_accounts" does not exist' },
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    }) as any,
    );

    const { GET } = await import("@/app/api/superadmin/invoices/runs/[runId]/route");
    const res = await GET(new Request("http://localhost"), { params: { runId: RUN_ID } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tripletex_mapping_available).toBe(false);
    expect(body.data.billing_mapping).toBeNull();
    expect(body.data.rows.length).toBe(1);
    expect(body.data.rows[0].export_status).toBe("MISSING_CUSTOMER_ID");
  });

  it("POST invoices/mapping/bulk: manglende tabell → 200 med tom mappings", async () => {
    vi.mocked(supabaseServer).mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "u1", user_metadata: { role: "superadmin" } } },
          error: null,
        }),
      },
    } as any);

    vi.mocked(supabaseAdmin).mockImplementation(
      () =>
        ({
          from: () => ({
            upsert: () =>
              Promise.resolve({
                data: null,
                error: { code: "42P01", message: 'relation "public.company_billing_accounts" does not exist' },
              }),
          }),
        }) as any,
    );

    const { POST } = await import("@/app/api/superadmin/invoices/mapping/bulk/route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ company_id: COMPANY_ID, tripletex_customer_id: "99" }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tripletex_mapping_available).toBe(false);
    expect(body.data.mappings).toEqual([]);
    expect(body.data.upserted).toBe(0);
  });

  it("POST billing-accounts: manglende tabell → 503 FEATURE_NOT_CONFIGURED", async () => {
    vi.mocked(supabaseServer).mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "admin-uuid" } },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "admin-uuid", role: "superadmin", company_id: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as any);

    vi.mocked(supabaseAdmin).mockImplementation(
      () =>
        ({
          from: () => ({
            upsert: async () => ({
              error: { code: "42P01", message: 'relation "public.company_billing_accounts" does not exist' },
            }),
          }),
        }) as any,
    );

    const { POST } = await import("@/app/api/superadmin/billing-accounts/route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company_id: COMPANY_ID, tripletex_customer_id: "123" }),
      }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.message ?? "")).toContain("ikke konfigurert");
  });
});
