// tests/outbox-policy.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

type Row = {
  id: string;
  event_key: string;
  payload: any;
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
  sendMail: (...args: any[]) => sendMailMock(...args),
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
    rpc: async (fn: string, params: any) => {
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

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => makeAdminMock(),
}));

import { processOutboxBatch } from "@/lib/orderBackup/outbox";

beforeEach(() => {
  rows.splice(0, rows.length);
  sendMailMock.mockReset();
});

describe("outbox retry policy", () => {
  test("marks FAILED_PERMANENT when attempts reaches 10", async () => {
    rows.push({
      id: "1",
      event_key: "ev-1",
      payload: { from: "a@x.no", to: "b@x.no", subject: "s", bodyText: "x" },
      status: "FAILED",
      attempts: 9,
      created_at: "2026-02-01T00:00:00.000Z",
      last_error: "prev",
    });

    sendMailMock.mockRejectedValueOnce(new Error("smtp_down"));

    const res = await processOutboxBatch(25, { rid: "rid-test" });

    expect(res.ok).toBe(true);
    expect(res.failedPermanent).toBe(1);
    expect(rows[0].status).toBe("FAILED_PERMANENT");
    expect(rows[0].attempts).toBe(10);
  });

  test("does not claim FAILED_PERMANENT rows", async () => {
    rows.push({
      id: "2",
      event_key: "ev-2",
      payload: { from: "a@x.no", to: "b@x.no", subject: "s", bodyText: "x" },
      status: "FAILED_PERMANENT",
      attempts: 10,
      created_at: "2026-02-01T00:00:00.000Z",
      last_error: "perm",
    });
    rows.push({
      id: "3",
      event_key: "ev-3",
      payload: { from: "a@x.no", to: "b@x.no", subject: "s", bodyText: "x" },
      status: "PENDING",
      attempts: 0,
      created_at: "2026-02-01T00:01:00.000Z",
      last_error: null,
    });

    sendMailMock.mockResolvedValueOnce({ messageId: "m1" });

    const res = await processOutboxBatch(25, { rid: "rid-test" });

    expect(res.ok).toBe(true);
    expect(res.sent).toBe(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe("FAILED_PERMANENT");
    expect(rows[1].status).toBe("SENT");
  });
});
