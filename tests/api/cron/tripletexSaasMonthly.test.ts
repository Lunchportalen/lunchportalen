/**
 * TPT-A-5 — /api/cron/tripletex-saas-monthly
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

import { POST as TripletexSaasMonthlyPOST } from "../../../app/api/cron/tripletex-saas-monthly/route";
import { previousMonthStartUTC } from "../../../app/api/cron/tripletex-saas-monthly/route";

beforeEach(() => {
  vi.clearAllMocks();
  auditInsertMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  if (origEnv !== undefined) process.env.CRON_SECRET = origEnv;
  else delete process.env.CRON_SECRET;
});

describe("Cron tripletex-saas-monthly — auth gate", () => {
  test("returns 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await TripletexSaasMonthlyPOST(
      mkReq("http://x/api/cron/tripletex-saas-monthly", { method: "POST" }),
    );
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("returns 403 when secret is set but header missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await TripletexSaasMonthlyPOST(
      mkReq("http://x/api/cron/tripletex-saas-monthly", { method: "POST" }),
    );
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("returns 403 when Authorization Bearer is wrong", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await TripletexSaasMonthlyPOST(
      mkReq("http://x/api/cron/tripletex-saas-monthly", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("Cron tripletex-saas-monthly — RPC", () => {
  test("returns 200 with JSON when auth valid and RPC succeeds", async () => {
    process.env.CRON_SECRET = "test-secret";
    const period = "2026-01-01";
    rpcMock.mockResolvedValueOnce({
      data: {
        ok: true,
        invoice_period: period,
        generated: 2,
        skipped_idempotent: 1,
        error_count: 0,
        errors: [],
        invoice_ids: ["a", "b", "c"],
      },
      error: null,
    });

    const res = await TripletexSaasMonthlyPOST(
      mkReq(`http://x/api/cron/tripletex-saas-monthly?period=${period}`, {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data.generated).toBe(2);
    expect(data.data.skipped_idempotent).toBe(1);
    expect(data.data.outbox_events).toBe(3);
    expect(rpcMock).toHaveBeenCalledWith("lp_generate_saas_invoices_for_period", {
      p_invoice_period: period,
      p_request_rid: expect.any(String),
    });
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "saas_invoice_cron",
        action: "saas_invoice_cron_completed",
        entity_id: period,
      }),
    );
  });

  test("idempotency: second call same period returns skipped_idempotent from RPC", async () => {
    process.env.CRON_SECRET = "test-secret";
    const period = "2026-01-01";
    const rpcResult = {
      ok: true,
      invoice_period: period,
      generated: 0,
      skipped_idempotent: 3,
      error_count: 0,
      errors: [],
      invoice_ids: ["id-1", "id-2", "id-3"],
    };

    rpcMock.mockResolvedValue({ data: rpcResult, error: null });

    for (let i = 0; i < 2; i++) {
      const res = await TripletexSaasMonthlyPOST(
        mkReq(`http://x/api/cron/tripletex-saas-monthly?period=${period}`, {
          method: "POST",
          headers: { Authorization: "Bearer test-secret" },
        }),
      );
      expect(res.status).toBe(200);
      const data = await readJson(res);
      expect(data.data.generated).toBe(0);
      expect(data.data.skipped_idempotent).toBe(3);
    }
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  test("returns 500 and writes audit when RPC fails", async () => {
    process.env.CRON_SECRET = "test-secret";
    const period = previousMonthStartUTC(new Date("2026-02-15T12:00:00Z"));
    expect(period).toBe("2026-01-01");

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "PERMISSION_DENIED", code: "42501" },
    });

    const res = await TripletexSaasMonthlyPOST(
      mkReq("http://x/api/cron/tripletex-saas-monthly", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "saas_invoice_cron_failed",
        entity_type: "saas_invoice_cron",
      }),
    );
  });
});
