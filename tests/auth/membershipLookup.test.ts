// @ts-nocheck
import { describe, expect, test, vi } from "vitest";

import { lookupMembership } from "@/lib/auth/membershipLookup";

describe("lookupMembership", () => {
  test("loads membership by profiles.id, not legacy profiles.user_id", async () => {
    vi.stubEnv("LP_AUTH_MEMBERSHIP_SOURCE", "profiles");

    const eqCalls: Array<{ table: string; key: string; value: string }> = [];
    const selectCalls: Array<{ table: string; columns: string }> = [];
    const userId = "11111111-1111-4111-8111-111111111111";
    const companyId = "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7";

    const sb = {
      from: (table: string) => {
        const q: any = {
          select: (columns: string) => {
            selectCalls.push({ table, columns });
            return q;
          },
          eq: (key: string, value: string) => {
            eqCalls.push({ table, key, value });
            return q;
          },
          maybeSingle: async () => ({
            data: {
              id: userId,
              role: "company_admin",
              company_id: companyId,
              location_id: null,
            },
            error: null,
          }),
        };
        return q;
      },
    };

    const result = await lookupMembership(sb, userId);

    expect(result.ok).toBe(true);
    expect(result.company_id).toBe(companyId);
    expect(selectCalls).toContainEqual({
      table: "profiles",
      columns: "id, role, company_id, location_id",
    });
    expect(eqCalls).toContainEqual({ table: "profiles", key: "id", value: userId });
    expect(eqCalls.some((call) => call.key === "user_id")).toBe(false);

    vi.unstubAllEnvs();
  });
});
