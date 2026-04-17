// @ts-nocheck
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runLedgerAgreementReject, runLedgerAgreementPause } from "@/lib/server/agreements/ledgerAgreementApproval";

vi.mock("@/lib/audit/write", () => ({
  writeAuditEvent: vi.fn(async () => ({ ok: true })),
}));

const rpcSpy = vi.fn();
const agreementState = vi.hoisted(() => ({ status: "ACTIVE" as string }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from(table: string) {
      const row =
        table === "agreements"
          ? {
              id: "00000000-0000-4000-8000-0000000000aa",
              company_id: "00000000-0000-4000-8000-0000000000bb",
              location_id: null,
              status: agreementState.status,
              tier: "BASIS",
              delivery_days: ["mon"],
              slot_start: "11:00",
              slot_end: "13:00",
              starts_at: "2099-01-01",
              ends_at: null,
              binding_months: 12,
              notice_months: 3,
              price_per_employee: 100,
              created_at: null,
              updated_at: null,
              activated_at: null,
              rejection_reason: null,
            }
          : table === "companies"
            ? { name: "TestCo", agreement_json: {} }
            : null;

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: row ? null : { message: "NOT_FOUND" } }),
          }),
        }),
      };
    },
    rpc: (...args: unknown[]) => {
      rpcSpy(...args);
      return Promise.resolve({ data: null, error: { message: "RPC_SHOULD_NOT_RUN" } });
    },
  }),
}));

describe("ledger agreement reject/pause — canonical statusporter", () => {
  beforeEach(() => {
    rpcSpy.mockClear();
    agreementState.status = "ACTIVE";
  });

  it("runLedgerAgreementReject returnerer 409 uten RPC når avtale ikke er PENDING", async () => {
    agreementState.status = "ACTIVE";
    const out = await runLedgerAgreementReject({
      rid: "rid_x",
      agreementId: "00000000-0000-4000-8000-0000000000aa",
      reason: null,
      actorUserId: "00000000-0000-4000-8000-0000000000dd",
      scope: { user_id: "u", email: null, role: "superadmin" },
    });
    expect(out.ok).toBe(false);
    expect(out.code).toBe("AGREEMENT_NOT_PENDING");
    expect(out.status).toBe(409);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("runLedgerAgreementPause returnerer 409 uten RPC når avtale ikke er ACTIVE", async () => {
    agreementState.status = "PENDING";
    const out = await runLedgerAgreementPause({
      rid: "rid_y",
      agreementId: "00000000-0000-4000-8000-0000000000aa",
      actorUserId: "00000000-0000-4000-8000-0000000000dd",
      scope: { user_id: "u", email: null, role: "superadmin" },
    });
    expect(out.ok).toBe(false);
    expect(out.code).toBe("AGREEMENT_NOT_ACTIVE");
    expect(out.status).toBe(409);
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

describe("ledger agreement — migrasjonskontrakt (ingen resume-RPC)", () => {
  it("20260320193000 definerer reject + pause_ledger, ikke resume", () => {
    const p = path.join(process.cwd(), "supabase", "migrations", "20260320193000_agreements_approval_reject_pause.sql");
    const sql = fs.readFileSync(p, "utf8");
    expect(sql).toContain("lp_agreement_reject_pending");
    expect(sql).toContain("lp_agreement_pause_ledger_active");
    expect(sql).not.toMatch(/lp_agreement_resume/i);
  });
});
