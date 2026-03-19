// tests/api/superadmin-system-status.test.ts
// Smoke test for GET /api/superadmin/system/status.

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

import type { NextRequest } from "next/server";

function makeReq(url: string): NextRequest {
  return { url } as any;
}

describe("GET /api/superadmin/system/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("route is defined and returns a Response", async () => {
    // We only assert that the route is wired and returns a Response object.
    const { GET } = await import("@/app/api/superadmin/system/status/route");
    const res = await GET(makeReq("http://x/api/superadmin/system/status"));
    expect(res).toBeInstanceOf(Response);
  });
});

