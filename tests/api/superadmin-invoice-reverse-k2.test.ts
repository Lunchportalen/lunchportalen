import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabaseAdmin } from "@/lib/supabase/admin";

const { scopeOr401Mock, requireRoleOr403Mock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

const LINE_ID = "aaaaaaaa-bbbb-4ccc-8000-eeeeeeeeeeee";
const RUN_ID = "bbbbbbbb-bbbb-4ccc-8000-eeeeeeeeeeee";
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

describe("K2 invoice.reverse OPTION B", () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin).mockReset();
    scopeOr401Mock.mockReset();
    requireRoleOr403Mock.mockReset();
    requireRoleOr403Mock.mockReturnValue(null);
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_test", scope: { userId: "u1", role: "superadmin" } },
    });
  });

  it("POST reverse: locked line returns 501 without outbox enqueue", async () => {
    const outboxUpsert = vi.fn();
    vi.mocked(supabaseAdmin).mockReturnValue({
      from: (table: string) => {
        if (table === "invoice_lines") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: LINE_ID, company_id: COMPANY_ID, run_id: RUN_ID, quantity: 1 },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "invoice_runs") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: RUN_ID, status: "FINALIZED" }, error: null }),
              }),
            }),
          };
        }
        if (table === "tripletex_invoices") {
          return {
            select: () => ({
              in: () => ({
                in: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "tx-1",
                        run_id: RUN_ID,
                        company_id: COMPANY_ID,
                        external_invoice_id: "TX-1",
                        status: "EXPORTED",
                        last_error: null,
                        updated_at: "2026-02-01T00:00:00Z",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "outbox") {
          return { upsert: outboxUpsert };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any);

    const { POST } = await import("@/app/api/superadmin/invoices/reverse/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(
      new NextRequest(`http://localhost/api/superadmin/invoices/reverse?reference=${LINE_ID}`, {
        method: "POST",
      }),
    );
    expect(res.status).toBe(501);
    expect(outboxUpsert).not.toHaveBeenCalled();
  });
});
