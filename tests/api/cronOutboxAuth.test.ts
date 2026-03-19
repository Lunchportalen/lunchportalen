/**
 * tests/api/cronOutboxAuth.test.ts
 * Cron outbox: auth gate returns 403/500; never proceeds without valid CRON_SECRET.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers: headers as HeadersInit }) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const origEnv = process.env.CRON_SECRET;
const origBatchSize = process.env.OUTBOX_BATCH_SIZE;
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  if (origEnv !== undefined) process.env.CRON_SECRET = origEnv;
  else delete process.env.CRON_SECRET;
  if (origBatchSize !== undefined) process.env.OUTBOX_BATCH_SIZE = origBatchSize;
  else delete process.env.OUTBOX_BATCH_SIZE;
});

const processOutboxBatchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/orderBackup/outbox", () => ({
  processOutboxBatch: (...args: unknown[]) => processOutboxBatchMock(...args),
}));

import { POST as CronOutboxPOST } from "../../app/api/cron/outbox/route";

describe("Cron outbox API — auth gate", () => {
  test("returns 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await CronOutboxPOST(mkReq("http://x/api/cron/outbox", { method: "POST" }));
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("misconfigured");
    expect(processOutboxBatchMock).not.toHaveBeenCalled();
  });

  test("returns 403 when secret is set but header missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await CronOutboxPOST(mkReq("http://x/api/cron/outbox", { method: "POST" }));
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("forbidden");
    expect(processOutboxBatchMock).not.toHaveBeenCalled();
  });

  test("returns 403 when Authorization Bearer is wrong", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await CronOutboxPOST(
      mkReq("http://x/api/cron/outbox", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret" },
      })
    );
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("forbidden");
    expect(processOutboxBatchMock).not.toHaveBeenCalled();
  });

  test("returns 200 with outbox result when auth valid", async () => {
    process.env.CRON_SECRET = "test-secret";
    processOutboxBatchMock.mockResolvedValueOnce({
      processed: 0,
      sent: 0,
      failed: 0,
      failedPermanent: 0,
      timedOut: 0,
      resetStale: 0,
      maxAttempts: 5,
    });
    const res = await CronOutboxPOST(
      mkReq("http://x/api/cron/outbox", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(typeof data.data.processed).toBe("number");
    expect(typeof data.data.sent).toBe("number");
    expect(typeof data.data.failed).toBe("number");
    expect(processOutboxBatchMock).toHaveBeenCalled();
  });

  test("clamps OUTBOX_BATCH_SIZE to max 200 (route helper correctness)", async () => {
    process.env.CRON_SECRET = "test-secret";
    process.env.OUTBOX_BATCH_SIZE = "500";
    processOutboxBatchMock.mockResolvedValueOnce({
      processed: 0,
      sent: 0,
      failed: 0,
      failedPermanent: 0,
      timedOut: 0,
      resetStale: 0,
      maxAttempts: 5,
    });
    const res = await CronOutboxPOST(
      mkReq("http://x/api/cron/outbox", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      })
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data.batchSize).toBe(200);
    expect(processOutboxBatchMock).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ rid: expect.any(String), worker: expect.any(String) })
    );
  });
});
