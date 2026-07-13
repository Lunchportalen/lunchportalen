/**
 * SEC-004: superadmin-only setCompanyStatus server action.
 * - Explicit superadmin gate (not UI/RLS alone)
 * - Strict input validation (no silent PENDING fallback)
 * - Transition matrix enforced
 * - Audit on state change
 */
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

let authUser: { id: string; email: string } | null = { id: "sa-1", email: "sa@lunchportalen.no" };
let profileRole: string | null = "superadmin";
let companyRow: { id: string; name: string; status: string } | null = {
  id: "c1",
  name: "Acme AS",
  status: "ACTIVE",
};
let updateError: { message: string } | null = null;
const updateCalls: any[] = [];
const auditCalls: any[] = [];

function makeQuery(table: string) {
  const q: any = {
    _table: table,
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    maybeSingle: vi.fn(async () => {
      if (table === "companies") return { data: companyRow, error: null };
      if (table === "profiles") return { data: profileRole == null ? null : { role: profileRole }, error: null };
      return { data: null, error: null };
    }),
    single: vi.fn(async () => {
      if (table === "companies") {
        return companyRow
          ? { data: companyRow, error: null }
          : { data: null, error: { message: "not found" } };
      }
      return { data: null, error: { message: "not found" } };
    }),
    update: vi.fn((patch: any) => {
      updateCalls.push({ table, patch });
      const uq: any = { eq: vi.fn(async () => ({ error: updateError })) };
      return uq;
    }),
    insert: vi.fn(async (row: any) => {
      auditCalls.push({ table, row });
      return { error: null };
    }),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () =>
        authUser ? { data: { user: authUser }, error: null } : { data: { user: null }, error: { message: "no session" } }
      ),
    },
    from: (table: string) => makeQuery(table),
  })),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, getAll: () => [], set: () => undefined, setAll: () => undefined }),
}));

async function callAction(companyId: string, status: any) {
  const mod = await import("../../app/superadmin/firms/[companyId]/actions");
  return mod.setCompanyStatus(companyId, status);
}

describe("SEC-004: setCompanyStatus server action", () => {
  beforeEach(() => {
    vi.resetModules();
    authUser = { id: "sa-1", email: "sa@lunchportalen.no" };
    profileRole = "superadmin";
    companyRow = { id: "c1", name: "Acme AS", status: "ACTIVE" };
    updateError = null;
    updateCalls.length = 0;
    auditCalls.length = 0;
  });

  test("rejects unauthenticated caller with 401 and writes nothing", async () => {
    authUser = null;
    const res = await callAction("c1", "PAUSED");
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.status).toBe(401);
    expect(updateCalls).toEqual([]);
  });

  test("rejects company_admin with 403 and writes nothing (negative role test)", async () => {
    profileRole = "company_admin";
    const res = await callAction("c1", "ACTIVE");
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.status).toBe(403);
      expect(res.error).toBe("FORBIDDEN");
    }
    expect(updateCalls).toEqual([]);
  });

  test("rejects employee with 403 and writes nothing (negative role test)", async () => {
    profileRole = "employee";
    const res = await callAction("c1", "ACTIVE");
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.status).toBe(403);
    expect(updateCalls).toEqual([]);
  });

  test("company_admin cannot activate a PENDING company (superadmin approval required)", async () => {
    profileRole = "company_admin";
    companyRow = { id: "c1", name: "Acme AS", status: "PENDING" };
    const res = await callAction("c1", "ACTIVE");
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.status).toBe(403);
    expect(updateCalls).toEqual([]);
  });

  test("rejects unknown status with 400 (no silent PENDING fallback)", async () => {
    const res = await callAction("c1", "BOGUS");
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.status).toBe(400);
      expect(res.error).toBe("VALIDATION");
    }
    expect(updateCalls).toEqual([]);
  });

  test("rejects invalid transition CLOSED -> PAUSED with 409", async () => {
    companyRow = { id: "c1", name: "Acme AS", status: "CLOSED" };
    const res = await callAction("c1", "PAUSED");
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.status).toBe(409);
      expect(res.error).toBe("INVALID_TRANSITION");
    }
    expect(updateCalls).toEqual([]);
  });

  test("same-status call is idempotent (already=true, no write, no audit)", async () => {
    companyRow = { id: "c1", name: "Acme AS", status: "PAUSED" };
    const res = await callAction("c1", "PAUSED");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.already).toBe(true);
    expect(updateCalls).toEqual([]);
    expect(auditCalls).toEqual([]);
  });

  test("valid transition ACTIVE -> PAUSED writes update and audit with actor + before/after", async () => {
    const res = await callAction("c1", "PAUSED");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe("PAUSED");
      expect(res.already).toBe(false);
    }

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].table).toBe("companies");
    expect(updateCalls[0].patch.status).toBe("PAUSED");

    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const audit = auditCalls[0].row;
    expect(audit.action).toBe("COMPANY_STATUS_CHANGED");
    expect(audit.actor_user_id).toBe("sa-1");
    expect(audit.entity_id).toBe("c1");
    expect(audit.detail.from).toBe("ACTIVE");
    expect(audit.detail.to).toBe("PAUSED");
    expect(audit.detail.at).toBeTruthy();
  });

  test("missing companyId is rejected with 400", async () => {
    const res = await callAction("", "ACTIVE");
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.status).toBe(400);
  });
});
