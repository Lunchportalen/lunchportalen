import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import * as webhook from "@sanity/webhook";
import { POST } from "@/app/api/webhooks/sanity/menu-day/route";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(() => ({})),
}));

const syncMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/menu-publish/syncMenuServiceDaysFromMenuDay", () => ({
  syncMenuServiceDaysForPublishedMenuDay: (...args: unknown[]) => syncMock(...args),
  deleteMenuServiceDaysForMenuDay: (...args: unknown[]) => deleteMock(...args),
}));

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

  it("UPSERT ved publishbar menuDay og returnerer tellere", async () => {
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
    expect(syncMock.mock.calls[0][1]).toEqual({ date: "2026-05-18", planTier: "BASIS" });
    expect(json.data.msdiRowsUpserted).toBe(18);
    expect(json.data.msdiLocationsSkippedNoTier).toBe(0);
  });

  it("synlighetsfilter=false → ingen UPSERT men slett forsøkes", async () => {
    deleteMock.mockResolvedValue({ deleted: 2 });
    const body = JSON.stringify({
      _type: "menuDay",
      date: "2026-05-18",
      planTier: "BASIS",
      customerVisible: false,
      approvedForPublish: true,
    });
    const sig = await webhook.encodeSignatureHeader(body, Date.now(), secret);
    const res = await POST(webhookRequest({ body, signature: sig }) as any);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data.unpublished).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
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
