// @ts-nocheck
// Wrapper-rute /api/public/onboarding/register kaller samme canonical RPC
// (lp_company_register) og skal arve samme provider-fail-closed-oppførsel.
import { describe, test, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}));

function mkReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/public/onboarding/register", {
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

const VALID_BODY = {
  orgnr: "123456789",
  company_name: "Test AS",
  employee_count: 22,
  contact_name: "Ola",
  contact_email: "ola@test.no",
  contact_phone: "41234567",
  address_line: "Gate 1",
  postal_code: "9999",
  postal_city: "Utenfor",
};

describe("POST /api/public/onboarding/register — provider-scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({
      data: { company_id: "11111111-1111-4111-8111-111111111111", status: "PENDING" },
      error: null,
    });
  });

  test("422 PROVIDER_NOT_FOUND når ingen leverandør dekker postnummeret (fail-closed)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "PROVIDER_NOT_FOUND" } });

    const { POST } = await import("@/app/api/public/onboarding/register/route");
    const res = await POST(mkReq(VALID_BODY));

    expect(res.status).toBe(422);
    const j = await readJson(res);
    expect(j?.ok).toBe(false);
    expect(String(j?.error?.code ?? "")).toBe("PROVIDER_NOT_FOUND");
  });

  test("klientstyrt provider_id sendes ALDRI videre til RPC", async () => {
    const { POST } = await import("@/app/api/public/onboarding/register/route");
    const res = await POST(
      mkReq({
        ...VALID_BODY,
        postal_code: "5000",
        postal_city: "Bergen",
        provider_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        providerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );

    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [rpcName, rpcArgs] = rpcMock.mock.calls[0];
    expect(rpcName).toBe("lp_company_register");
    expect(Object.keys(rpcArgs).sort()).toEqual([
      "p_address_line",
      "p_company_name",
      "p_contact_email",
      "p_contact_name",
      "p_contact_phone",
      "p_employee_count",
      "p_orgnr",
      "p_postal_city",
      "p_postal_code",
    ]);
    expect(JSON.stringify(rpcArgs)).not.toContain("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  test("409 ORGNR_ALREADY_REGISTERED mappes kontrollert (uendret kontrakt for kjente feil)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "ORGNR_ALREADY_REGISTERED" } });

    const { POST } = await import("@/app/api/public/onboarding/register/route");
    const res = await POST(mkReq(VALID_BODY));

    expect(res.status).toBe(409);
    const j = await readJson(res);
    expect(String(j?.error?.code ?? "")).toBe("ORGNR_ALREADY_REGISTERED");
  });
});
