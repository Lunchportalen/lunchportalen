// @ts-nocheck
/**
 * Verifiserer at canonical ledger reject/pause-API er superadmin-only:
 * scopeOr401 (mock) + ekte requireRoleOr403 — company_admin/employee/driver/kitchen får 403 før mutasjon.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { AuthedCtx } from "@/lib/http/routeGuard";

const AID = "00000000-0000-4000-8000-0000000000c1";

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const runLedgerAgreementRejectMock = vi.hoisted(() => vi.fn());
const runLedgerAgreementPauseMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  };
});

vi.mock("@/lib/server/agreements/ledgerAgreementApproval", () => ({
  runLedgerAgreementReject: (...args: unknown[]) => runLedgerAgreementRejectMock(...args),
  runLedgerAgreementPause: (...args: unknown[]) => runLedgerAgreementPauseMock(...args),
}));

function authedOk(role: string): { ok: true; ctx: AuthedCtx } {
  return {
    ok: true,
    ctx: {
      rid: "rid_route_agreement",
      route: "/api/superadmin/agreements",
      method: "POST",
      scope: {
        userId: "user-1",
        role,
        companyId: role === "company_admin" ? "00000000-0000-4000-8000-0000000000cc" : null,
        locationId: null,
        email: "t@test.no",
        sub: "sub-1",
      },
    },
  };
}

async function readJson(res: Response) {
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

describe("superadmin agreements API — reject & pause-ledger gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runLedgerAgreementRejectMock.mockResolvedValue({
      ok: true,
      rid: "rid_mut",
      data: { agreementId: AID, status: "REJECTED", message: "ok" },
    });
    runLedgerAgreementPauseMock.mockResolvedValue({
      ok: true,
      rid: "rid_mut",
      data: { agreementId: AID, status: "PAUSED", message: "ok" },
    });
  });

  describe("POST …/reject", () => {
    it("403 for company_admin before runLedgerAgreementReject", async () => {
      scopeOr401Mock.mockResolvedValue(authedOk("company_admin"));
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/reject/route");
      const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "x" }),
      });
      const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
      expect(res.status).toBe(403);
      expect(runLedgerAgreementRejectMock).not.toHaveBeenCalled();
    });

    it("403 for employee, driver, kitchen before runLedgerAgreementReject", async () => {
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/reject/route");
      for (const role of ["employee", "driver", "kitchen"]) {
        vi.clearAllMocks();
        scopeOr401Mock.mockResolvedValue(authedOk(role));
        const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/reject`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
        expect(res.status, role).toBe(403);
        expect(runLedgerAgreementRejectMock).not.toHaveBeenCalled();
      }
    });

    it("401 when scopeOr401 fails closed", async () => {
      const r401 = new Response(JSON.stringify({ ok: false }), { status: 401 });
      scopeOr401Mock.mockResolvedValue({
        ok: false,
        res: r401,
        response: r401,
        ctx: authedOk("superadmin").ctx,
      });
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/reject/route");
      const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/reject`, { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
      expect(res.status).toBe(401);
      expect(runLedgerAgreementRejectMock).not.toHaveBeenCalled();
    });

    it("200 for superadmin and invokes runLedgerAgreementReject", async () => {
      scopeOr401Mock.mockResolvedValue(authedOk("superadmin"));
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/reject/route");
      const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "test" }),
      });
      const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body?.ok).toBe(true);
      expect(runLedgerAgreementRejectMock).toHaveBeenCalledTimes(1);
      const arg0 = runLedgerAgreementRejectMock.mock.calls[0][0];
      expect(arg0.agreementId).toBe(AID);
      expect(arg0.reason).toBe("test");
    });
  });

  describe("POST …/pause-ledger", () => {
    it("403 for company_admin before runLedgerAgreementPause", async () => {
      scopeOr401Mock.mockResolvedValue(authedOk("company_admin"));
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/pause-ledger/route");
      const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/pause-ledger`, { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
      expect(res.status).toBe(403);
      expect(runLedgerAgreementPauseMock).not.toHaveBeenCalled();
    });

    it("200 for superadmin and invokes runLedgerAgreementPause", async () => {
      scopeOr401Mock.mockResolvedValue(authedOk("superadmin"));
      const { POST } = await import("@/app/api/superadmin/agreements/[agreementId]/pause-ledger/route");
      const req = new NextRequest(`http://localhost/api/superadmin/agreements/${AID}/pause-ledger`, { method: "POST" });
      const res = await POST(req, { params: Promise.resolve({ agreementId: AID }) });
      expect(res.status).toBe(200);
      expect(runLedgerAgreementPauseMock).toHaveBeenCalledTimes(1);
    });
  });
});
