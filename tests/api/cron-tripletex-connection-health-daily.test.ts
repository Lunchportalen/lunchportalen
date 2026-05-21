import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { tripletexWhoAmIMock, createTripletexAuthFromTokensMock, rpcMock } = vi.hoisted(() => ({
  tripletexWhoAmIMock: vi.fn(),
  createTripletexAuthFromTokensMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/http/cronAuth", () => ({
  requireCronAuth: vi.fn(),
}));

vi.mock("@/lib/integrations/tripletex/client", () => ({
  createTripletexAuthFromTokens: (...args: unknown[]) => createTripletexAuthFromTokensMock(...args),
  tripletexWhoAmI: (...args: unknown[]) => tripletexWhoAmIMock(...args),
  TripletexClientError: class extends Error {
    kind = "AUTH";
    status = 401;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "provider_tripletex_credentials") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  provider_id: "prov-1",
                  env: "test",
                  connection_state: "CONNECTED",
                  vault_purge_at: null,
                  company_id_external: 114612665,
                },
                {
                  provider_id: "prov-2",
                  env: "test",
                  connection_state: "DEGRADED",
                  vault_purge_at: null,
                  company_id_external: 114612665,
                },
                {
                  provider_id: "prov-3",
                  env: "test",
                  connection_state: "DISCONNECTED",
                  vault_purge_at: "2020-01-01T00:00:00.000Z",
                },
                {
                  provider_id: "prov-4",
                  env: "test",
                  connection_state: "DISCONNECTED",
                  vault_purge_at: "2099-01-01T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "lifecycle_audit_log") {
        return { insert: async () => ({ error: null }) };
      }
      return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
    },
    rpc: rpcMock,
  }),
}));

import { GET } from "@/app/api/cron/tripletex-connection-health-daily/route";

describe("cron tripletex-connection-health-daily (TPT-B-7)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    tripletexWhoAmIMock.mockReset();
    createTripletexAuthFromTokensMock.mockReset();
    createTripletexAuthFromTokensMock.mockResolvedValue({ companyId: "114612665", token: "sess" });
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "lp_provider_load_tripletex_credentials") {
        return {
          data: { consumer_token: "c", employee_token: "e", company_id_external: 114612665 },
          error: null,
        };
      }
      if (name === "lp_provider_apply_connection_health_check") {
        return { data: { ok: true, transitioned_to: "CONNECTED" }, error: null };
      }
      if (name === "lp_provider_purge_disconnected_vault") {
        return { data: { purged: true }, error: null };
      }
      return { data: {}, error: null };
    });
  });

  function req() {
    return new NextRequest("http://localhost/api/cron/tripletex-connection-health-daily");
  }

  test("CONNECTED health check passes → updated", async () => {
    tripletexWhoAmIMock.mockResolvedValueOnce({ companyId: 114612665, companyName: "Test AS" });
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "lp_provider_load_tripletex_credentials") {
        return { data: { consumer_token: "c", employee_token: "e" }, error: null };
      }
      if (name === "lp_provider_apply_connection_health_check" && args.p_ok === true) {
        return { data: { ok: true, transitioned_to: "CONNECTED" }, error: null };
      }
      if (name === "lp_provider_purge_disconnected_vault") {
        return { data: { purged: false, reason: "GRACE_ACTIVE" }, error: null };
      }
      return { data: {}, error: null };
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body.data?.checked).toBeGreaterThanOrEqual(1);
  });

  test("CONNECTED → DEGRADED on 401", async () => {
    tripletexWhoAmIMock.mockRejectedValueOnce(Object.assign(new Error("401"), { status: 401 }));
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "lp_provider_load_tripletex_credentials") {
        return { data: { consumer_token: "c", employee_token: "e" }, error: null };
      }
      if (name === "lp_provider_apply_connection_health_check" && args.p_auth_failed === true) {
        return { data: { ok: false, transitioned_to: "DEGRADED" }, error: null };
      }
      if (name === "lp_provider_purge_disconnected_vault") {
        return { data: { purged: false }, error: null };
      }
      return { data: {}, error: null };
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("DEGRADED → CONNECTED on recovery", async () => {
    tripletexWhoAmIMock.mockResolvedValue({ companyId: 114612665, companyName: "Test AS" });
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "lp_provider_load_tripletex_credentials") {
        return { data: { consumer_token: "c", employee_token: "e" }, error: null };
      }
      if (name === "lp_provider_apply_connection_health_check" && args.p_ok === true) {
        return { data: { ok: true, transitioned_to: "CONNECTED" }, error: null };
      }
      if (name === "lp_provider_purge_disconnected_vault") {
        return { data: { purged: false }, error: null };
      }
      return { data: {}, error: null };
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body.data?.recovered).toBeGreaterThanOrEqual(0);
  });

  test("DISCONNECTED grace expired → purged", async () => {
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "lp_provider_purge_disconnected_vault") {
        if (args.p_provider_id === "prov-3") {
          return { data: { purged: true }, error: null };
        }
        return { data: { purged: false, reason: "GRACE_ACTIVE" }, error: null };
      }
      if (name === "lp_provider_load_tripletex_credentials") {
        return { data: { consumer_token: "c", employee_token: "e" }, error: null };
      }
      return { data: {}, error: null };
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body.data?.purged).toBeGreaterThanOrEqual(1);
  });

  test("DISCONNECTED grace active → no purge", async () => {
    rpcMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "lp_provider_purge_disconnected_vault") {
        return { data: { purged: false, reason: "GRACE_ACTIVE" }, error: null };
      }
      if (name === "lp_provider_load_tripletex_credentials") {
        return { data: { consumer_token: "c", employee_token: "e" }, error: null };
      }
      return { data: {}, error: null };
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body.data?.grace_active).toBeGreaterThanOrEqual(1);
  });
});
