import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

import { GET } from "@/app/api/cron/menu-week-rollout/route";

vi.mock("@/lib/menu-publish/runMenuWeekRollout", () => ({
  runMenuWeekRollout: vi.fn(),
}));

vi.mock("@/lib/sanity/client", () => ({
  requireSanityWrite: vi.fn(() => ({})),
}));

import { runMenuWeekRollout } from "@/lib/menu-publish/runMenuWeekRollout";

function cronRequest(): NextRequest {
  return new Request("http://test.local/api/cron/menu-week-rollout", {
    method: "GET",
    headers: { Authorization: "Bearer cron-test-secret-value" },
  }) as unknown as NextRequest;
}

describe("GET /api/cron/menu-week-rollout", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret-value";
    vi.mocked(runMenuWeekRollout).mockResolvedValue({
      targetWeek: "2026-06-01",
      tiersProcessed: ["BASIS"],
      menuDaysCreated: 1,
      menuDaysSkipped: 4,
      errors: [],
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  it("200 og låst respons-kontrakt når cron + sanity write ok", async () => {
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.rid).toMatch(/^cron_mwr_/);
    expect(json.data.menuDaysCreated).toBe(1);
    expect(json.data.errors).toEqual([]);
  });

  it("403 uten gyldig secret", async () => {
    const res = await GET(
      new Request("http://test.local/api/cron/menu-week-rollout", { method: "GET" }) as unknown as NextRequest,
    );
    expect(res.status).toBe(403);
  });
});
