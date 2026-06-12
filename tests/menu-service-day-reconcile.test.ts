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

const resolveProviderMock = vi.fn();

vi.mock("@/lib/menu-publish/resolveMenuDayProvider", () => ({
  resolveMenuDayProviderScope: (...args: unknown[]) => resolveProviderMock(...args),
}));

const opsLogMock = vi.fn();

vi.mock("@/lib/ops/log", () => ({
  opsLog: (...args: unknown[]) => opsLogMock(...args),
}));

const PROVIDER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROVIDER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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
    resolveProviderMock.mockReset();
    opsLogMock.mockReset();
    syncMock.mockResolvedValue({
      locationCount: 1,
      inserted: 0,
      updated: 1,
      unchanged: 0,
      skipped: false,
    });
    resolveProviderMock.mockImplementation(async (_db: unknown, ref: string) => {
      if (ref === PROVIDER_A || ref === PROVIDER_B) {
        return { ok: true, scope: { providerId: ref, providerSlug: null } };
      }
      return { ok: false, reason: "PROVIDER_NOT_FOUND" };
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("5 distinkte dager → sync kalles fem ganger med provider-scope og tellere aggregeres", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-03", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-04", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-05", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-06", planTier: "LUXUS", providerRef: PROVIDER_A },
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
    for (const call of syncMock.mock.calls) {
      expect((call[1] as { providerId: string }).providerId).toBe(PROVIDER_A);
    }
    expect(json.data.inserted).toBe(0);
    expect(json.data.updated).toBe(0);
    expect(json.data.unchanged).toBe(5);
    expect(json.data.skippedNoProvider).toBe(0);
  });

  it("duplicate provider+date+tier dokumenter dedupliseres til én sync", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_A },
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

  it("samme date+tier hos to providere synces separat per provider (ingen kryssdeduplisering)", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_A },
      { date: "2026-06-02", planTier: "BASIS", providerRef: PROVIDER_B },
    ]);

    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    await res.json();
    expect(syncMock).toHaveBeenCalledTimes(2);
    const providerIds = syncMock.mock.calls.map((c) => (c[1] as { providerId: string }).providerId);
    expect(providerIds).toEqual([PROVIDER_A, PROVIDER_B]);
  });

  it("fail-closed: menuDay uten provider-ref skippes uten sync + kontrollert logg", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS" },
      { date: "2026-06-03", planTier: "BASIS", providerRef: PROVIDER_A },
    ]);

    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect((syncMock.mock.calls[0][1] as { providerId: string }).providerId).toBe(PROVIDER_A);
    expect(json.data.skippedNoProvider).toBe(1);
    expect(opsLogMock).toHaveBeenCalledWith(
      "menu_day_sync.skipped",
      expect.objectContaining({ reason: "missing_provider_scope", source: "reconcile", skipped_docs: 1 }),
    );
  });

  it("fail-closed: ukjent provider skippes uten sync + kontrollert logg", async () => {
    fetchMock.mockResolvedValue([
      { date: "2026-06-02", planTier: "BASIS", providerRef: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
    ]);

    const res = await GET(cronRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(syncMock).not.toHaveBeenCalled();
    expect(json.data.skippedNoProvider).toBe(1);
    expect(opsLogMock).toHaveBeenCalledWith(
      "menu_day_sync.skipped",
      expect.objectContaining({ reason: "provider_not_found", source: "reconcile", skipped_docs: 1 }),
    );
  });
});
