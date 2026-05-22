// K1 — Outbox claim race: SMTP worker must not claim Tripletex/invoice pipeline keys.
// @ts-nocheck — vi.mock partial factory typing for rpc-only stub
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  isOutboxKeyExcludedFromSmtpClaim,
  OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES,
} from "@/lib/outbox/eventKinds";

type Row = {
  id: string;
  event_key: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "FAILED_PERMANENT";
  attempts: number;
  created_at: string;
  last_error: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
};

const rows: Row[] = [];
const sendMailMock = vi.fn();
const claimRpcCalls = vi.hoisted(() => ({ list: [] as Record<string, unknown>[] }));

function isExcluded(eventKey: string, excludePrefixes: string[] | undefined): boolean {
  if (!excludePrefixes?.length) return false;
  return excludePrefixes.some((prefix) => eventKey.startsWith(prefix));
}

function claimFromMock(limit: number, excludePrefixes?: string[]) {
  const candidates = rows
    .filter((r) => (r.status === "PENDING" || r.status === "FAILED") && r.attempts < 10)
    .filter((r) => !isExcluded(r.event_key, excludePrefixes))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);

  for (const r of candidates) {
    r.status = "PROCESSING";
    r.attempts += 1;
    r.locked_at = new Date().toISOString();
    r.locked_by = "test-worker";
    r.last_error = null;
  }

  return candidates.map((r) => ({
    id: r.id,
    event_key: r.event_key,
    payload: r.payload,
    attempts: r.attempts,
    status: r.status,
  }));
}

function makeAdminMock() {
  return {
    from: () => ({
      update: () => ({
        eq: (col: string, val: unknown) => {
          if (col !== "id") {
            return {
              eq: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
            };
          }
          const id = String(val);
          return {
            eq: (col2: string, val2: unknown) => {
              if (col2 !== "status" || val2 !== "PROCESSING") {
                return { select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) };
              }
              return {
                select: () => ({
                  limit: () => {
                    const row = rows.find((r) => r.id === id);
                    if (row && row.status === "PROCESSING") {
                      row.status = "PENDING";
                      row.locked_at = null;
                      row.locked_by = null;
                      return Promise.resolve({ data: [{ id: row.id }], error: null });
                    }
                    return Promise.resolve({ data: [], error: null });
                  },
                }),
              };
            },
          };
        },
      }),
    }),
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === "lp_outbox_reset_stale") {
        return { data: [{ reset_count: 0 }], error: null };
      }

      if (fn === "lp_outbox_claim") {
        claimRpcCalls.list.push(params);
        const exclude = Array.isArray(params?.p_exclude_prefixes)
          ? (params.p_exclude_prefixes as string[])
          : undefined;
        return { data: claimFromMock(Number(params?.p_limit ?? 25), exclude), error: null };
      }

      if (fn === "lp_outbox_mark_sent") {
        const id = String(params?.p_id ?? params?.id ?? params?.p_outbox_id ?? "");
        const row = rows.find((r) => r.id === id);
        if (!row) return { data: [], error: null };
        row.status = "SENT";
        row.locked_at = null;
        row.locked_by = null;
        row.last_error = null;
        return { data: [{ status: row.status, attempts: row.attempts }], error: null };
      }

      if (fn === "lp_outbox_mark_failed") {
        const id = String(params?.p_id ?? params?.id ?? params?.p_outbox_id ?? "");
        const row = rows.find((r) => r.id === id);
        if (!row) return { data: [], error: null };
        row.status = row.attempts >= 10 ? "FAILED_PERMANENT" : "FAILED";
        row.last_error = String(params?.p_error ?? "unknown_error");
        row.locked_at = null;
        row.locked_by = null;
        return { data: [{ status: row.status, attempts: row.attempts }], error: null };
      }

      return { data: [], error: null };
    },
  };
}

vi.mock("@/lib/orderBackup/smtp", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: () => makeAdminMock(),
  };
});

import { processOutboxBatch } from "@/lib/orderBackup/outbox";

beforeEach(() => {
  rows.splice(0, rows.length);
  claimRpcCalls.list = [];
  sendMailMock.mockReset();
});

describe("K1 outbox claim race", () => {
  test("isOutboxKeyExcludedFromSmtpClaim covers tripletex and invoice pipeline keys", () => {
    expect(isOutboxKeyExcludedFromSmtpClaim("invoice.ready:ref-1")).toBe(true);
    expect(isOutboxKeyExcludedFromSmtpClaim("tripletex.company_customer_create_provider:c:p")).toBe(true);
    expect(isOutboxKeyExcludedFromSmtpClaim("tripletex.saas_invoice_create_lp:inv-1")).toBe(true);
    expect(isOutboxKeyExcludedFromSmtpClaim("company.approved:ag-1")).toBe(false);
    expect(isOutboxKeyExcludedFromSmtpClaim("order.set:u:d:s")).toBe(false);
  });

  test("claim RPC receives SMTP exclude prefixes", async () => {
    rows.push({
      id: "em-only",
      event_key: "company.approved:ag-1",
      payload: { from: "a@x.no", to: "b@x.no", subject: "s" },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    sendMailMock.mockResolvedValueOnce({ messageId: "m1" });
    await processOutboxBatch(25, { rid: "rid-k1-1" });

    expect(claimRpcCalls.list.length).toBeGreaterThan(0);
    expect(claimRpcCalls.list[0]?.p_exclude_prefixes).toEqual([...OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES]);
  });

  test("mixed queue: SMTP processes only email/state; tripletex rows stay PENDING", async () => {
    rows.push(
      {
        id: "ttx-1",
        event_key: "tripletex.company_customer_create_provider:co:pr",
        payload: {},
        status: "PENDING",
        attempts: 0,
        created_at: "2026-05-15T09:00:00.000Z",
        last_error: null,
      },
      {
        id: "inv-1",
        event_key: "invoice.ready:ref-abc",
        payload: {},
        status: "PENDING",
        attempts: 0,
        created_at: "2026-05-15T09:01:00.000Z",
        last_error: null,
      },
      {
        id: "em-1",
        event_key: "company.approved:ag-1",
        payload: { from: "a@x.no", to: "b@x.no", subject: "hello", bodyText: "x" },
        status: "PENDING",
        attempts: 0,
        created_at: "2026-05-15T09:02:00.000Z",
        last_error: null,
      },
    );

    sendMailMock.mockResolvedValueOnce({ messageId: "m1" });

    const res = await processOutboxBatch(25, { rid: "rid-k1-race" });

    expect(res.sent).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.releasedInvoiceReady).toBe(0);

    const ttx = rows.find((r) => r.id === "ttx-1");
    const inv = rows.find((r) => r.id === "inv-1");
    const em = rows.find((r) => r.id === "em-1");

    expect(ttx?.status).toBe("PENDING");
    expect(inv?.status).toBe("PENDING");
    expect(em?.status).toBe("SENT");
    expect(String(ttx?.last_error ?? "")).not.toContain("unknown_event_kind");
    expect(String(inv?.last_error ?? "")).not.toContain("unknown_event_kind");
  });

  test("saas invoice create lp is never marked unknown_event_kind by SMTP worker", async () => {
    rows.push({
      id: "saas-1",
      event_key: "tripletex.saas_invoice_create_lp:inv-99",
      payload: {},
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-k1-saas" });

    expect(res.failed).toBe(0);
    expect(res.processed).toBe(0);
    expect(rows[0].status).toBe("PENDING");
    expect(String(rows[0].last_error ?? "")).not.toContain("unknown_event_kind");
  });
});
