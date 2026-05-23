// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const B8_ROUTES = [
  { path: "/api/ai/analyze", file: "app/api/ai/analyze/route.ts", method: "POST" },
  { path: "/api/ai/continue", file: "app/api/ai/continue/route.ts", method: "POST" },
  { path: "/api/ai/copilot", file: "app/api/ai/copilot/route.ts", method: "POST" },
  { path: "/api/ai/dashboard", file: "app/api/ai/dashboard/route.ts", method: "GET" },
  { path: "/api/ai/decision", file: "app/api/ai/decision/route.ts", method: "POST" },
  { path: "/api/ai/design/analyze", file: "app/api/ai/design/analyze/route.ts", method: "POST" },
  { path: "/api/ai/design/generate", file: "app/api/ai/design/generate/route.ts", method: "POST" },
  { path: "/api/ai/growth/ads", file: "app/api/ai/growth/ads/route.ts", method: "POST" },
  { path: "/api/ai/growth/funnel", file: "app/api/ai/growth/funnel/route.ts", method: "POST" },
  { path: "/api/ai/growth/seo", file: "app/api/ai/growth/seo/route.ts", method: "POST" },
  { path: "/api/ai/inline", file: "app/api/ai/inline/route.ts", method: "POST" },
  { path: "/api/ai/insights", file: "app/api/ai/insights/route.ts", method: "GET" },
  { path: "/api/ai/learn", file: "app/api/ai/learn/route.ts", method: "POST" },
  { path: "/api/ai/page/audit", file: "app/api/ai/page/audit/route.ts", method: "POST" },
  { path: "/api/ai/rewrite", file: "app/api/ai/rewrite/route.ts", method: "POST" },
  { path: "/api/backoffice/experiments/event", file: "app/api/backoffice/experiments/event/route.ts", method: "POST" },
  { path: "/api/public/track-event", file: "app/api/public/track-event/route.ts", method: "POST" },
];

const scopeOr401Mock = vi.fn();

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: () => null,
  denyResponse: (gate: { res?: Response }) => gate.res ?? new Response(null, { status: 401 }),
}));

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as any;
}

describe("B8 AI routes — session gate (DC-027)", () => {
  beforeEach(() => {
    scopeOr401Mock.mockReset();
  });

  for (const route of B8_ROUTES) {
    test(`${route.path} source prepends denyUnlessSession outside withApiAiEntrypoint`, () => {
      const src = fs.readFileSync(route.file, "utf8");
      expect(src).toContain("denyUnlessSession");
      const denyIdx = src.indexOf("denyUnlessSession");
      const wrapIdx = src.indexOf("withApiAiEntrypoint");
      expect(denyIdx).toBeGreaterThan(-1);
      expect(wrapIdx).toBeGreaterThan(-1);
      expect(denyIdx).toBeLessThan(wrapIdx);
    });
  }

  test("POST /api/ai/analyze returns 401 without session", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, status: 401 }), { status: 401 }),
      ctx: { rid: "r1", scope: {} },
    });
    const { POST } = await import("@/app/api/ai/analyze/route");
    const res = await POST(mkReq("http://localhost/api/ai/analyze", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  test("POST /api/ai/analyze proceeds when session ok", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "r1",
        scope: { userId: "u1", role: "employee", companyId: null, locationId: null, email: null, sub: null },
      },
    });
    const { POST } = await import("@/app/api/ai/analyze/route");
    const res = await POST(
      mkReq("http://localhost/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "hello" }),
      }),
    );
    expect(res.status).not.toBe(401);
  });
});
