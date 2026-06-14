import { beforeEach, describe, expect, it, vi } from "vitest";

const PROVIDER_A = "22222222-2222-4222-8222-222222222222";
const PROVIDER_B = "33333333-3333-4333-8333-333333333333";
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const AGREEMENT_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

vi.mock("@/lib/audit/write", () => ({
  writeAuditEvent: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "agreement_change_requests") {
            return {
              data: {
                id: REQUEST_ID,
                provider_id: PROVIDER_A,
                company_id: COMPANY_ID,
                agreement_id: AGREEMENT_ID,
                status: "PENDING_PROVIDER_APPROVAL",
                change_type: "PACKAGE_BY_DAY",
                effective_from: "2026-06-01",
                effective_to: null,
                requested_change: { day_overrides: { fri: { package: "ENTERPRISE" } } },
              },
              error: null,
            };
          }
          if (table === "agreements") {
            return {
              data: {
                id: AGREEMENT_ID,
                company_id: COMPANY_ID,
                provider_id: PROVIDER_A,
                status: "ACTIVE",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        update: () => chain,
        in: () => chain,
      };
      return chain;
    },
  }),
}));

import { approveAgreementChangeRequest } from "@/lib/agreements/changeRequestService";

describe("approveAgreementChangeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks cross-provider approval", async () => {
    const result = await approveAgreementChangeRequest({
      rid: "test_rid",
      requestId: REQUEST_ID,
      actorUserId: null,
      scope: { user_id: null, email: null, role: "provider_admin" },
      expectedProviderId: PROVIDER_B,
    });

    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.code).toBe("PROVIDER_SCOPE_MISMATCH");
  });
});
