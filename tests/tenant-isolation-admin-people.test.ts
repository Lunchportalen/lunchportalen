// tests/tenant-isolation-admin-people.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
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

function safeStr(v: any) {
  return String(v ?? "").trim();
}

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async (req: any) => {
    const h = (k: string) => safeStr(req?.headers?.get?.(k) ?? req?.headers?.[k]);
    return {
      userId: h("x-mock-user") || "u_test",
      role: h("x-mock-role") || null,
      companyId: h("x-mock-company") || null,
      locationId: h("x-mock-location") || null,
      email: h("x-mock-email") || "test@lunchportalen.no",
    };
  }),
}));

vi.mock("@/lib/http/respond", async () => {
  return {
    makeRid: () => "rid_test",
    jsonErr: (rid: string, message: string, status = 400, error?: any) =>
      new Response(JSON.stringify({ ok: false, rid, message, status, error }), { status }),
    jsonOk: (rid: string, data: any, status = 200) =>
      new Response(JSON.stringify({ ok: true, rid, data }), { status }),
  };
});

let companyEqProfiles: string | null = null;
let companyEqInvites: string | null = null;
let companyEqCompany: string | null = null;

function makeAdminDb() {
  return {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          if (k === "company_id") {
            if (table === "profiles") companyEqProfiles = String(v ?? "");
            if (table === "employee_invites") companyEqInvites = String(v ?? "");
          }
          if (table === "companies" && k === "id") companyEqCompany = String(v ?? "");
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === "companies") {
            return { data: { id: "cA", name: "Acme", status: "ACTIVE", updated_at: "2026-02-01T00:00:00Z" }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (table === "profiles") {
            resolve({
              data: [
                {
                  id: "p1",
                  email: "a@acme.no",
                  full_name: "A",
                  name: "A",
                  role: "employee",
                  department: null,
                  location_id: null,
                  disabled_at: null,
                  is_active: true,
                  phone: null,
                  created_at: "2026-02-01T00:00:00Z",
                  updated_at: "2026-02-01T00:00:00Z",
                },
              ],
              error: null,
            });
            return;
          }
          if (table === "employee_invites") {
            resolve({ data: [], error: null });
            return;
          }
          resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => makeAdminDb(),
}));

import { GET as adminPeopleGET } from "../app/api/admin/people/route";

beforeEach(() => {
  companyEqProfiles = null;
  companyEqInvites = null;
  companyEqCompany = null;
});

describe("tenant isolation – admin/people", () => {
  test("company_admin scope locks company_id in queries", async () => {
    const req = mkReq("http://localhost/api/admin/people", {
      method: "GET",
      headers: {
        "x-mock-role": "company_admin",
        "x-mock-company": "cA",
        "x-mock-user": "u_adminA",
      },
    });

    const res = await adminPeopleGET(req);
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(companyEqProfiles).toBe("cA");
    expect(companyEqInvites).toBe("cA");
    expect(companyEqCompany).toBe("cA");
  });
});

