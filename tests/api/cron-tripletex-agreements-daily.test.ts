/**
 * TPT-B-5 — /api/cron/tripletex-agreements-daily
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

const rpcMock = vi.hoisted(() => vi.fn());
const auditInsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) => {
      if (table !== "lifecycle_audit_log") {
        throw new Error(`unexpected table ${table}`);
      }
      return { insert: (...args: unknown[]) => auditInsertMock(...args) };
    },
  }),
}));

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => "2026-06-15",
  isIsoDate: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")),
}));

import { GET as TripletexAgreementsDailyGET } from "../../app/api/cron/tripletex-agreements-daily/route";

beforeEach(() => {
  vi.clearAllMocks();
  auditInsertMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  if (origEnv !== undefined) process.env.CRON_SECRET = origEnv;
  else delete process.env.CRON_SECRET;
});

describe("Cron tripletex-agreements-daily — auth gate", () => {
  test("returns 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await TripletexAgreementsDailyGET(
      mkReq("http://x/api/cron/tripletex-agreements-daily", { method: "GET" }),
    );
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("returns 403 when secret is set but header missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await TripletexAgreementsDailyGET(
      mkReq("http://x/api/cron/tripletex-agreements-daily", { method: "GET" }),
    );
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("returns 403 when Authorization Bearer is wrong", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await TripletexAgreementsDailyGET(
      mkReq("http://x/api/cron/tripletex-agreements-daily", {
        method: "GET",
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("Cron tripletex-agreements-daily — RPC", () => {
  test("returns 200 with JSON when auth valid and RPC succeeds", async () => {
    process.env.CRON_SECRET = "test-secret";
    const today = "2026-06-15";
    rpcMock.mockResolvedValueOnce({
      data: {
        ok: true,
        run_id: "run-1",
        today,
        candidates_count: 3,
        generated_count: 2,
        skipped_count: 1,
        failed_count: 0,
        invoice_ids: ["inv-1", "inv-2"],
        errors: [],
      },
      error: null,
    });

    const res = await TripletexAgreementsDailyGET(
      mkReq(`http://x/api/cron/tripletex-agreements-daily?today=${today}`, {
        method: "GET",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data.generated_count).toBe(2);
    expect(data.data.skipped_count).toBe(1);
    expect(rpcMock).toHaveBeenCalledWith("lp_run_daily_agreement_billing", {
      p_today: today,
      p_request_rid: expect.any(String),
    });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "agreement_billing_cron",
        action: "agreement_billing_cron_completed",
        metadata: expect.objectContaining({ today }),
      }),
    );
  });

  test("returns 500 and writes audit when RPC fails", async () => {
    process.env.CRON_SECRET = "test-secret";
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "PERMISSION_DENIED", code: "42501" },
    });

    const res = await TripletexAgreementsDailyGET(
      mkReq("http://x/api/cron/tripletex-agreements-daily", {
        method: "GET",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agreement_billing_cron_failed",
        entity_type: "agreement_billing_cron",
      }),
    );
  });
});
