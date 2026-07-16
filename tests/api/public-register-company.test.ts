// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const registeredCompanyId = "11111111-1111-4111-8111-111111111111";
const persistedRegistrationRow = {
  company_id: registeredCompanyId,
  created_at: "2026-01-01T00:00:00Z",
};

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
      data: { company_id: registeredCompanyId, status: "PENDING", receipt: "2026-01-01T00:00:00Z" },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "companies") {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          not: () => builder,
          gt: async () => ({ count: 0, error: null }),
          then: (resolve: any) => resolve({ count: 0, error: null }),
        };
        return builder;
      }
      if (table !== "company_registrations") {
        return {};
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: persistedRegistrationRow,
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
    expect(j?.registrationId).toBe(registeredCompanyId);
    expect(j?.companyId).toBe(registeredCompanyId);
    expect(j?.registrationId).toBe(persistedRegistrationRow.company_id);
    expect(j?.receipt?.createdAt).toBe(persistedRegistrationRow.created_at);
    expect(rpcMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("company_registrations");
  });

  test("422 PROVIDER_NOT_FOUND når ingen leverandør dekker postnummeret (fail-closed)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "PROVIDER_NOT_FOUND" } });

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
        postal_code: "9999",
        postal_city: "Utenfor",
        consent_accepted: true,
        weekday_meal_tiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
      }),
    );
    expect(res.status).toBe(422);
    const j = await readJson(res);
    expect(j?.ok).toBe(false);
    expect(String(j?.error?.code ?? "")).toBe("PROVIDER_NOT_FOUND");
    // Ingen registrering skal verifiseres/oppdateres når RPC feiler fail-closed.
    expect(fromMock).not.toHaveBeenCalledWith("company_registrations");
  });

  // Fase 5 (kontrollert leverandørvalg): et gyldig UUID-provider_id VIDERESENDES
  // som p_provider_id, men RPC-en håndhever fail-closed at valget ligger innenfor
  // faktisk dekning (PROVIDER_NOT_ELIGIBLE ellers). Klienten kan aldri tvinge
  // gjennom en vilkårlig leverandør — serveren/RPC-en er fortsatt sannhet.
  test("provider_id videresendes kun som validert valg (RPC håndhever dekning)", async () => {
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
        provider_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        weekday_meal_tiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
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
      "p_provider_id",
    ]);
    expect(rpcArgs.p_provider_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  test("ikke-UUID provider_id slippes ALDRI gjennom (p_provider_id = null)", async () => {
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
        provider_id: "'; drop table providers; --",
        weekday_meal_tiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
        delivery_window_from: "11:00",
        delivery_window_to: "13:00",
        terms_binding_months: 12,
        terms_notice_months: 3,
      }),
    );
    expect(res.status).toBe(200);
    const [, rpcArgs] = rpcMock.mock.calls[0];
    expect(rpcArgs.p_provider_id).toBeNull();
  });

  test("alias-rutene /api/register og /api/public/register delegerer til canonical POST", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "PROVIDER_NOT_FOUND" } });
    const aliasA = await import("@/app/api/register/route");
    const aliasB = await import("@/app/api/public/register/route");

    const body = {
      orgnr: "123456789",
      company_name: "Test AS",
      employee_count: 22,
      contact_name: "Ola",
      contact_email: "ola@test.no",
      contact_phone: "41234567",
      address_line: "Gate 1",
      postal_code: "9999",
      postal_city: "Utenfor",
      consent_accepted: true,
      weekday_meal_tiers: { mon: "BASIS", tue: "BASIS", wed: "BASIS", thu: "BASIS", fri: "BASIS" },
      delivery_window_from: "11:00",
      delivery_window_to: "13:00",
      terms_binding_months: 12,
      terms_notice_months: 3,
    };

    const resA = await aliasA.POST(mkReq(body));
    expect(resA.status).toBe(422);
    expect(String((await readJson(resA))?.error?.code ?? "")).toBe("PROVIDER_NOT_FOUND");

    const resB = await aliasB.POST(mkReq(body));
    expect(resB.status).toBe(422);
    expect(String((await readJson(resB))?.error?.code ?? "")).toBe("PROVIDER_NOT_FOUND");
  });

  test("500 REGISTER_PERSISTENCE_FAILED når company_registrations mangler etter RPC", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "companies") {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          not: () => builder,
          gt: async () => ({ count: 0, error: null }),
          then: (resolve: any) => resolve({ count: 0, error: null }),
        };
        return builder;
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    });
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
