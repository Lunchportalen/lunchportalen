import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

import { GET } from "@/app/api/cron/menu-service-day-reconcile/route";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({})),
}));

const fetchMock = vi.fn();

vi.mock("@/lib/sanity/server", () => ({
  sanityServer: {
    fetch: (...args: unknown[]) => fetchMock(...args),
  },
}));

const syncMock = vi.fn();

vi.mock("@/lib/menu-publish/syncMenuServiceDaysFromMenuDay", () => ({
  syncMenuServiceDaysForPublishedMenuDay: (...args: unknown[]) => syncMock(...args),
}));

function cronRequest(): NextRequest {
  return new Request("http://test.local/api/cron/menu-service-day-reconcile", {
    method: "GET",
    headers: { Authorization: "Bearer cron-test-secret-value" },
  }) as unknown as NextRequest;
}

describe("GET /api/cron/menu-service-day-reconcile", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret-value";
    fetchMock.mockReset();
    syncMock.mockReset();
    syncMock.mockResolvedValue({
      locationCount: 1,
      inserted: 0,
      updated: 1,
      unchanged: 0,
      skipped: false,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("5 distinkte dager → sync kalles fem ganger og tellere aggregeres", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS" },
      { date: "2026-06-03", planTier: "BASIS" },
      { date: "2026-06-04", planTier: "BASIS" },
      { date: "2026-06-05", planTier: "BASIS" },
      { date: "2026-06-06", planTier: "LUXUS" },
    ]);

    syncMock.mockResolvedValue({
      locationCount: 1,
      inserted: 0,
      updated: 0,
      unchanged: 1,
      skipped: false,
    });

    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(syncMock).toHaveBeenCalledTimes(5);
    expect(json.data.inserted).toBe(0);
    expect(json.data.updated).toBe(0);
    expect(json.data.unchanged).toBe(5);
  });

  it("duplicate date+tier dokumenter dedupliseres til én sync", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS" },
      { date: "2026-06-02", planTier: "BASIS" },
      { date: "2026-06-02", planTier: "BASIS" },
    ]);

    syncMock.mockResolvedValue({
      locationCount: 2,
      inserted: 0,
      updated: 1,
      unchanged: 0,
      skipped: false,
    });

    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    await res.json();
    expect(syncMock).toHaveBeenCalledTimes(1);
  });
});
