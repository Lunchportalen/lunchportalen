/**
 * POST /api/public/coverage/check — geography gate unit tests.
 */
// @ts-nocheck

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

function postReq(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
  };
}

describe("POST /api/public/coverage/check", () => {
  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockClear();
    fromMock.mockClear();
    hasConfigMock.mockClear();
    hasConfigMock.mockReturnValue(true);
  });

  test("MVP forward when no service areas", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ count: 0, error: null }),
      }),
    });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "0150", city: "Oslo" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.covered).toBe(true);
    expect(json.data.mvpForward).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("covered when provider matches postal code", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ count: 2, error: null }),
      }),
    });
    rpcMock.mockResolvedValue({ data: "550e8400-e29b-41d4-a716-446655440000", error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "0150", city: "Oslo" }));
    const json = await res.json();
    expect(json.data.covered).toBe(true);
    expect(json.data.hasServiceAreas).toBe(true);
  });

  test("not covered when areas exist but no match", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ count: 1, error: null }),
      }),
    });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "9999", city: "Testby" }));
    const json = await res.json();
    expect(json.data.covered).toBe(false);
  });

  test("invalid postal → 422", async () => {
    const { POST } = await import("@/app/api/public/coverage/check/route");
    const res = await POST(postReq({ postal_code: "12", city: "Oslo" }));
    expect(res.status).toBe(422);
  });
});
