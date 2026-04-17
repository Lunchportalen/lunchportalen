import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseRouteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/route", () => ({
  supabaseRoute: supabaseRouteMock,
}));

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseRouteMock.mockReset();
  });

  it("returns 400 when tokens are missing", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const res = await POST(
      new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("calls setSession and returns contract-shaped 200 JSON on success", async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null });
    supabaseRouteMock.mockReturnValue({
      auth: { setSession },
    });

    const { POST } = await import("@/app/api/auth/session/route");
    const res = await POST(
      new Request("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: "atok", refresh_token: "rtok" }),
      })
    );

    expect(setSession).toHaveBeenCalledWith({ access_token: "atok", refresh_token: "rtok" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({});
    expect(typeof body.rid).toBe("string");
    expect(String(body.rid).length).toBeGreaterThan(4);
  });
});
