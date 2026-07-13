/**
 * POST /api/public/coverage/check — geography gate unit tests.
 */

import type { NextRequest } from "next/server";
import { describe, test, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const hasConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
  hasSupabaseAdminConfig: hasConfigMock,
}));

function postReq(body: Record<string, unknown>): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function mockServiceAreaCount(count: number) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => Promise.resolve({ count, error: null }),
    }),
  });
}

describe("POST /api/public/coverage/check", () => {
  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockClear();
    fromMock.mockClear();
    hasConfigMock.mockClear();
    hasConfigMock.mockReturnValue(true);
  });

  test("empty service area table returns covered: false (not MVP-forward)", async () => {
    mockServiceAreaCount(0);
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "0150", city: "Oslo" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.covered).toBe(false);
    expect(json.data.hasServiceAreas).toBe(false);
    expect(json.data.mvpForward).toBe(false);
    expect(json.data.reason).toBe("service_areas_empty");
    expect(rpcMock).toHaveBeenCalledWith("lp_match_provider_by_postal_code", {
      p_postal_code: "0150",
    });
  });

  test("covered when provider matches postal code (Melhus-style match)", async () => {
    mockServiceAreaCount(2);
    const melhusProviderId = "550e8400-e29b-41d4-a716-446655440000";
    rpcMock.mockResolvedValue({ data: melhusProviderId, error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "7228", city: "Kyrksæterøra" }));
    const json = await res.json();
    expect(json.data.covered).toBe(true);
    expect(json.data.hasServiceAreas).toBe(true);
    expect(json.data.mvpForward).toBe(false);
    expect(json.data.reason).toBe("provider_matched");
    expect(rpcMock).toHaveBeenCalledWith("lp_match_provider_by_postal_code", {
      p_postal_code: "7228",
    });
  });

  test("not covered when areas exist but no provider match", async () => {
    mockServiceAreaCount(1);
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "9999", city: "Testby" }));
    const json = await res.json();
    expect(json.data.covered).toBe(false);
    expect(json.data.hasServiceAreas).toBe(true);
    expect(json.data.mvpForward).toBe(false);
    expect(json.data.reason).toBe("not_covered");
  });

  test("mvpForward is always false — cannot force covered without provider match", async () => {
    mockServiceAreaCount(0);
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "0150", city: "Oslo" }));
    const json = await res.json();
    expect(json.data.covered).toBe(false);
    expect(json.data.mvpForward).toBe(false);
    // Simulerer at klienten ikke lenger behandler mvpForward som dekning.
    const uiWouldTreatAsCovered = json.data.covered === true || json.data.mvpForward === true;
    expect(uiWouldTreatAsCovered).toBe(false);
  });

  test("no write-path RPCs are called — kun match-RPC-er for lesing", async () => {
    mockServiceAreaCount(1);
    rpcMock.mockResolvedValue({ data: "prov-1", error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    await POST(postReq({ postal_code: "0150", city: "Oslo" }));

    // Fase 5: ved dekning kalles også lp_match_providers_by_postal_code (flertall)
    // for kontrollert valg — begge er STABLE/read-only match-RPC-er.
    const allowed = new Set(["lp_match_provider_by_postal_code", "lp_match_providers_by_postal_code"]);
    expect(rpcMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const c of rpcMock.mock.calls) {
      expect(allowed.has(String(c[0]))).toBe(true);
    }
    expect(rpcMock.mock.calls.some((c) => String(c[0]).includes("register"))).toBe(false);
  });

  test("invalid postal → 422", async () => {
    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "12", city: "Oslo" }));
    expect(res.status).toBe(422);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
