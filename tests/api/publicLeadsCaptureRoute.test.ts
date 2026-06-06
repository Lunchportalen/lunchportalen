/**
 * POST /api/public/leads/capture — V-gate #C unit tests.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rpcMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const hasConfigMock = vi.hoisted(() => vi.fn());
const salesAlertMock = vi.hoisted(() => vi.fn());
const sentryFlushMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: rpcMock }),
  hasSupabaseAdminConfig: hasConfigMock,
}));

vi.mock("@/lib/public/leadsCaptureRateLimit", () => ({
  leadsCaptureRateLimitOk: rateLimitMock,
}));

vi.mock("@/lib/public/leadsSalesAlert", () => ({
  sendLeadSalesAlert: salesAlertMock,
}));

vi.mock("@sentry/nextjs", () => ({
  flush: sentryFlushMock,
}));

vi.mock("@/lib/sentry/capture", () => ({
  captureServerException: vi.fn(),
}));

function postReq(body: Record<string, unknown>) {
  return {
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
    json: () => Promise.resolve(body),
  };
}

const validBody = {
  name: "Ola Nordmann",
  email: "ola@example.com",
  company: "Test AS",
  source: "demo-direct",
  consented: true,
};

describe("POST /api/public/leads/capture", () => {
  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockClear();
    rateLimitMock.mockClear();
    hasConfigMock.mockClear();
    salesAlertMock.mockClear();
    sentryFlushMock.mockClear();
    rateLimitMock.mockResolvedValue(true);
    hasConfigMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: "550e8400-e29b-41d4-a716-446655440000", error: null });
    salesAlertMock.mockResolvedValue(undefined);
    sentryFlushMock.mockResolvedValue(true);
  });

  test("gyldig lead → 200 og RPC kalt", async () => {
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("lp_capture_lead", expect.objectContaining({
      p_name: "Ola Nordmann",
      p_email: "ola@example.com",
      p_consented: true,
    }));
    expect(salesAlertMock).toHaveBeenCalled();
  });

  test("consent=false → 422", async () => {
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq({ ...validBody, consented: false }));
    expect(res.status).toBe(422);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("ugyldig e-post → 422", async () => {
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq({ ...validBody, email: "not-an-email" }));
    expect(res.status).toBe(422);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("honeypot website fylt → stille 200 uten RPC", async () => {
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq({ ...validBody, website: "https://spam.example" }));
    expect(res.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("rate-limit → 429", async () => {
    rateLimitMock.mockResolvedValue(false);
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(429);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("manglende env/config → 503", async () => {
    hasConfigMock.mockReturnValue(false);
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("RPC consent_required → 422 med felt", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "consent_required" } });
    const { POST } = await import("@/app/api/public/leads/capture/route");
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.detail?.field).toBe("consented");
  });
});

describe("demo lead capture — klient-bundle hygiene", () => {
  const ROOT = process.cwd();
  const CLIENT_PATHS = [
    "components/demo/DemoLeadCaptureForm.tsx",
    "app/demo/page.tsx",
    "app/demo/layout.tsx",
  ];

  test("service_role / supabaseAdmin finnes ikke i demo-klientfiler", () => {
    for (const rel of CLIENT_PATHS) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(src).not.toMatch(/supabaseAdmin/);
      expect(src).not.toMatch(/service_role/);
    }
  });
});

describe("POST /api/public/demo-interest", () => {
  test("returnerer 410 Gone", async () => {
    const { POST } = await import("@/app/api/public/demo-interest/route");
    const res = await POST();
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error).toBe("DEPRECATED");
  });
});
