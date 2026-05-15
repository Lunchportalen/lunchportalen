// tests/lib/orderBackup/outbox.test.ts — routing: state noop vs SMTP vs unknown
// @ts-nocheck — vi.mock partial factory + importOriginal typing for rpc-only stub
import { beforeEach, describe, expect, test, vi } from "vitest";

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

vi.mock("@/lib/orderBackup/smtp", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

function claim(limit: number) {
  const candidates = rows
    .filter((r) => (r.status === "PENDING" || r.status === "FAILED") && r.attempts < 10)
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
        return { data: claim(Number(params?.p_limit ?? 25)), error: null };
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
  sendMailMock.mockReset();
});

describe("processOutboxBatch routing", () => {
  test("order.set state event closes as SENT without SMTP", async () => {
    rows.push({
      id: "st-1",
      event_key: "order.set:abc:user1:2026-05-20:default",
      payload: {},
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-r1" });

    expect(res.ok).toBe(true);
    expect(res.stateNoop).toBe(1);
    expect(res.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("SENT");
  });

  test("rollup.rebuild state event closes as SENT without SMTP", async () => {
    rows.push({
      id: "st-2",
      event_key: "rollup.rebuild:2026-05-21",
      payload: {},
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-r2" });

    expect(res.stateNoop).toBe(1);
    expect(res.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("SENT");
  });

  test("email row with full payload sends mail and marks SENT", async () => {
    rows.push({
      id: "em-1",
      event_key: "smoke:test:key",
      payload: {
        from: "a@x.no",
        to: "b@x.no",
        subject: "hello",
        bodyText: "body",
      },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    sendMailMock.mockResolvedValueOnce({ messageId: "m1" });

    const res = await processOutboxBatch(25, { rid: "rid-r3" });

    expect(res.sent).toBe(1);
    expect(res.stateNoop).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe("SENT");
  });

  test("declared email prefix with missing from/to marks FAILED payload_missing_fields", async () => {
    rows.push({
      id: "em-2",
      event_key: "company.approved:agreement-1",
      payload: { subject: "only subject" },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-r4" });

    expect(res.failed).toBe(1);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("FAILED");
    expect(String(rows[0].last_error)).toContain("payload_missing_fields");
  });

  test("unknown event_key (no triplet, no declared prefix) marks FAILED unknown_event_kind", async () => {
    rows.push({
      id: "uk-1",
      event_key: "totally.unknown:payload",
      payload: { foo: 1 },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-r5" });

    expect(res.failed).toBe(1);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("FAILED");
    expect(String(rows[0].last_error)).toContain("unknown_event_kind:");
  });

  test("invoice.ready releases PROCESSING row back to PENDING without SMTP", async () => {
    rows.push({
      id: "inv-1",
      event_key: "invoice.ready:ref-abc",
      payload: { event: "invoice.ready" },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-05-15T10:00:00.000Z",
      last_error: null,
    });

    const res = await processOutboxBatch(25, { rid: "rid-r6" });

    expect(res.releasedInvoiceReady).toBe(1);
    expect(res.sent).toBe(0);
    expect(res.stateNoop).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].locked_at).toBeNull();
    expect(rows[0].locked_by).toBeNull();
  });
});
