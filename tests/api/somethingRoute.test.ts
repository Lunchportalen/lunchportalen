/**
 * /api/something — H1 hardening: unauthenticated POST must fail closed (401).
 */
// @ts-nocheck

import { describe, test, expect, vi } from "vitest";

import { POST as SomethingPOST } from "../../app/api/something/route";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn().mockResolvedValue({
    ok: false,
    res: new Response(JSON.stringify({ ok: false, message: "Ikke innlogget." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
    response: new Response(null, { status: 401 }),
    ctx: { rid: "rid_uauth" },
  }),
  requireRoleOr403: () => null,
  denyResponse: (s: { res?: Response }) => s?.res ?? new Response(null, { status: 401 }),
}));

describe("POST /api/something", () => {
  test("401 uten session og uten cron-headers når CRON_SECRET ikke brukes i test", async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const req = new Request("http://localhost/api/something", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "x" }),
      });
      const res = await SomethingPOST(req as any);
      expect(res.status).toBe(401);
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev;
    }
  });
});
