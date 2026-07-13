import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import * as webhook from "@sanity/webhook";
import { POST } from "@/app/api/webhooks/sanity/menu-day/route";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({})),
  hasSupabaseAdminConfig: vi.fn(() => false),
}));

// Fase I: route checks ops kill switch first; keep it open in these tests.
vi.mock("@/lib/system/opsKillSwitch", () => ({
  opsKillSwitchResponse: vi.fn(async () => null),
  checkOpsKillSwitch: vi.fn(async () => ({ killed: false })),
}));

const syncMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/menu-publish/syncMenuServiceDaysFromMenuDay", () => ({
  syncMenuServiceDaysForPublishedMenuDay: (...args: unknown[]) => syncMock(...args),
  deleteMenuServiceDaysForMenuDay: (...args: unknown[]) => deleteMock(...args),
}));

const resolveProviderMock = vi.fn();

vi.mock("@/lib/menu-publish/resolveMenuDayProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/menu-publish/resolveMenuDayProvider")>();
  return {
    ...actual,
    resolveMenuDayProviderScope: (...args: unknown[]) => resolveProviderMock(...args),
  };
});

const opsLogMock = vi.fn();

vi.mock("@/lib/ops/log", () => ({
  opsLog: (...args: unknown[]) => opsLogMock(...args),
}));

const PROVIDER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function providerOk(providerId: string) {
  return { ok: true as const, scope: { providerId, providerSlug: "provider-a" } };
}

function webhookRequest(opts: { body: string; signature?: string }) {
  return new Request("http://test.local/api/webhooks/sanity/menu-day", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.signature ? { [webhook.SIGNATURE_HEADER_NAME]: opts.signature } : {}),
    },
    body: opts.body,
  });
}

async function readJson(res: Response) {
  return res.json();
}

describe("POST /api/webhooks/sanity/menu-day", () => {
  const secret = "e2f4c6testsecretvalueforunittestonlyxxxxxxxx";

  beforeEach(() => {
    syncMock.mockReset();
    deleteMock.mockReset();
    resolveProviderMock.mockReset();
    opsLogMock.mockReset();
    resolveProviderMock.mockResolvedValue(providerOk(PROVIDER_A));
    process.env.SANITY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.SANITY_WEBHOOK_SECRET;
  });

  it("401 når signatur ikke kan verifiseres", async () => {
    const body = "{}";
    const res = await POST(webhookRequest({ body, signature: "t=123,v1=deadbeef" }) as any);
    expect(res.status).toBe(401);
  });

  it("hopper over når dokument ikke er menuDay", async () => {
    const body = JSON.stringify({ _type: "page" });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.reason).toBe("NOT_MENU_DAY_PAYLOAD");
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("UPSERT ved publishbar menuDay og returnerer tellere — sync får provider-scope", async () => {
    syncMock.mockResolvedValue({
      locationCount: 3,
      inserted: 1,
      updated: 2,
      unchanged: 0,
      skipped: false,
      msdiRowsUpserted: 18,
      msdiLocationsSkippedNoTier: 0,
    });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      provider: { _type: "reference", _ref: PROVIDER_A },
      customerVisible: true,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.inserted).toBe(1);
    expect(json.data.updated).toBe(2);
    expect(json.data.locations).toBe(3);
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock.mock.calls[0][1]).toEqual({
      date: "2026-05-18",
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });
    expect(json.data.msdiRowsUpserted).toBe(18);
    expect(json.data.msdiLocationsSkippedNoTier).toBe(0);
  });

  it("fail-closed: menuDay uten provider-ref → skip uten sync + kontrollert logg", async () => {
    const body = JSON.stringify({
      _type: "menuDay",
      _id: "menuDay-2026-05-18-basis",
      date: "2026-05-18",
      planTier: "BASIS",
      customerVisible: true,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data.skipped).toBe(true);
    expect(json.data.reason).toBe("MISSING_PROVIDER_SCOPE");
    expect(syncMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(opsLogMock).toHaveBeenCalledWith(
      "menu_day_sync.skipped",
      expect.objectContaining({
        reason: "missing_provider_scope",
        sanity_menu_day_id: "menuDay-2026-05-18-basis",
        date: "2026-05-18",
        plan_tier: "BASIS",
      }),
    );
  });

  it("fail-closed: ukjent provider → skip uten sync + kontrollert logg", async () => {
    resolveProviderMock.mockResolvedValue({ ok: false, reason: "PROVIDER_NOT_FOUND" });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      provider: { _type: "reference", _ref: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
      customerVisible: true,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.skipped).toBe(true);
    expect(json.data.reason).toBe("PROVIDER_NOT_FOUND");
    expect(syncMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(opsLogMock).toHaveBeenCalledWith(
      "menu_day_sync.skipped",
      expect.objectContaining({ reason: "provider_not_found" }),
    );
  });

  it("transient provider-lookup-feil → 500 (Sanity retry + reconcile self-heal)", async () => {
    resolveProviderMock.mockResolvedValue({ ok: false, reason: "LOOKUP_FAILED", detail: "connection refused" });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      provider: { _type: "reference", _ref: PROVIDER_A },
      customerVisible: true,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(500);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("synlighetsfilter=false → ingen UPSERT men provider-scoped slett forsøkes", async () => {
    deleteMock.mockResolvedValue({ deleted: 2 });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      provider: { _type: "reference", _ref: PROVIDER_A },
      customerVisible: false,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.unpublished).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock.mock.calls[0][1]).toEqual({
      date: "2026-05-18",
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("idemponens-idempotente kall gjentar UPSERT-logikk uten frontend-feil", async () => {
    syncMock.mockResolvedValue({
      locationCount: 2,
      inserted: 0,
      updated: 0,
      unchanged: 2,
      skipped: false,
    });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      provider: { _type: "reference", _ref: PROVIDER_A },
      customerVisible: true,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);

    const r1 = await POST(webhookRequest({ body, signature: sig }) as any);
    const r2 = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(syncMock).toHaveBeenCalledTimes(2);
  });
});
