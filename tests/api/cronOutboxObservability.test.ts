/**
 * tests/api/cronOutboxObservability.test.ts
 * Cron outbox: writes cron_runs rows for both success and failure.
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (origEnv !== undefined) process.env.CRON_SECRET = origEnv;
  else delete process.env.CRON_SECRET;
});

const processOutboxBatchMock = vi.hoisted(() => vi.fn());
const cronRunsInsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/orderBackup/outbox", () => ({
  processOutboxBatch: (...args: unknown[]) => processOutboxBatchMock(...args),
}));

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from(table: string) {
      if (table === "cron_runs") {
        return {
          insert: (row: any) => {
            cronRunsInsertMock(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        insert: () => Promise.resolve({ error: null }),
      };
    },
  }),
  };
});

import { POST as CronOutboxPOST } from "../../app/api/cron/outbox/route";

describe("Cron outbox API — observability", () => {
  test("logs cron_runs row with status=ok on successful run", async () => {
    process.env.CRON_SECRET = "test-secret";
    processOutboxBatchMock.mockResolvedValueOnce({
      processed: 3,
      sent: 2,
      failed: 1,
      failedPermanent: 0,
      timedOut: 0,
      resetStale: 0,
      maxAttempts: 10,
    });

    const res = await CronOutboxPOST(
      mkReq("http://localhost/api/cron/outbox", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(true);

    // Allow async logCronRun microtask to flush.
    await Promise.resolve();

    expect(cronRunsInsertMock).toHaveBeenCalledTimes(1);
    const row = cronRunsInsertMock.mock.calls[0][0];
    expect(row.job).toBe("outbox");
    expect(row.status).toBe("ok");
    expect(typeof row.rid).toBe("string");
    expect(row.meta.processed).toBe(3);
    expect(row.meta.sent).toBe(2);
    expect(row.meta.failed).toBe(1);
  });

  test("logs cron_runs row with status=error on failure", async () => {
    process.env.CRON_SECRET = "test-secret";
    processOutboxBatchMock.mockRejectedValueOnce(new Error("smtp_down"));

    const res = await CronOutboxPOST(
      mkReq("http://localhost/api/cron/outbox", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("outbox_failed");

    await Promise.resolve();

    expect(cronRunsInsertMock).toHaveBeenCalledTimes(1);
    const row = cronRunsInsertMock.mock.calls[0][0];
    expect(row.job).toBe("outbox");
    expect(row.status).toBe("error");
    expect(typeof row.rid).toBe("string");
    expect(typeof row.detail).toBe("string");
    expect(row.detail).toContain("smtp_down");
  });
}
);

