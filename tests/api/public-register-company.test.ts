// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

function mkReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/public/register-company", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

describe("POST /api/public/register-company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: { company_id: "11111111-1111-1111-1111-111111111111", status: "PENDING", receipt: "2026-01-01T00:00:00Z" },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table !== "company_registrations") {
        return {};
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { company_id: "11111111-1111-1111-1111-111111111111", created_at: "2026-01-01T00:00:00Z" },
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    });
  });

  test("400 CONSENT_REQUIRED når samtykke mangler", async () => {
    const { POST } = await import("@/app/api/public/register-company/route");
    const res = await POST(
      mkReq({
        orgnr: "123456789",
        company_name: "Test AS",
        employee_count: 25,
        contact_name: "Ola",
        contact_email: "ola@test.no",
        contact_phone: "41234567",
        address_line: "Gate 1",
        postal_code: "5000",
        postal_city: "Bergen",
      }),
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(j?.ok).toBe(false);
    expect(String(j?.error?.code ?? "")).toBe("CONSENT_REQUIRED");
  });

  test("400 EMPLOYEE_COUNT_MIN_20 når under 20", async () => {
    const { POST } = await import("@/app/api/public/register-company/route");
    const res = await POST(
      mkReq({
        orgnr: "123456789",
        company_name: "Test AS",
        employee_count: 19,
        contact_name: "Ola",
        contact_email: "ola@test.no",
        contact_phone: "41234567",
        address_line: "Gate 1",
        postal_code: "5000",
        postal_city: "Bergen",
        consent_accepted: true,
      }),
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(String(j?.error?.code ?? "")).toBe("EMPLOYEE_COUNT_MIN_20");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("400 WEEKDAY_MEAL_TIERS_REQUIRED når ukedagsplan mangler", async () => {
    const { POST } = await import("@/app/api/public/register-company/route");
    const res = await POST(
      mkReq({
        orgnr: "123456789",
        company_name: "Test AS",
        employee_count: 22,
        contact_name: "Ola",
        contact_email: "ola@test.no",
        contact_phone: "41234567",
        address_line: "Gate 1",
        postal_code: "5000",
        postal_city: "Bergen",
        consent_accepted: true,
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
      }),
    );
    expect(res.status).toBe(400);
    const j = await readJson(res);
    expect(String(j?.error?.code ?? "")).toBe("WEEKDAY_MEAL_TIERS_REQUIRED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test("200 med persisted + registrationId etter RPC og DB-verifisering", async () => {
    const { POST } = await import("@/app/api/public/register-company/route");
    const res = await POST(
      mkReq({
        orgnr: "123456789",
        company_name: "Test AS",
        employee_count: 22,
        contact_name: "Ola",
        contact_email: "ola@test.no",
        contact_phone: "41234567",
        address_line: "Gate 1",
        postal_code: "5000",
        postal_city: "Bergen",
        consent_accepted: true,
        weekday_meal_tiers: {
          mon: "BASIS",
          tue: "BASIS",
          wed: "BASIS",
          thu: "LUXUS",
          fri: "BASIS",
        },
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
      }),
    );
    expect(res.status).toBe(200);
    const j = await readJson(res);
    expect(j?.ok).toBe(true);
    expect(j?.persisted).toBe(true);
    expect(j?.registrationId).toBe("11111111-1111-1111-1111-111111111111");
    expect(j?.companyId).toBe("11111111-1111-1111-1111-111111111111");
    expect(rpcMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("company_registrations");
  });

  test("500 REGISTER_PERSISTENCE_FAILED når company_registrations mangler etter RPC", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }));
    const { POST } = await import("@/app/api/public/register-company/route");
    const res = await POST(
      mkReq({
        orgnr: "123456789",
        company_name: "Test AS",
        employee_count: 22,
        contact_name: "Ola",
        contact_email: "ola@test.no",
        contact_phone: "41234567",
        address_line: "Gate 1",
        postal_code: "5000",
        postal_city: "Bergen",
        accept: true,
        weekday_meal_tiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
      }),
    );
    expect(res.status).toBe(500);
    const j = await readJson(res);
    expect(String(j?.error?.code ?? "")).toBe("REGISTER_PERSISTENCE_FAILED");
  });
});
