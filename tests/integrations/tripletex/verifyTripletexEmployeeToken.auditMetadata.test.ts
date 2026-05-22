import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { verifyTripletexEmployeeToken } from "@/lib/integrations/tripletex/onboardingVerify";

describe("verifyTripletexEmployeeToken — audit metadata (TPT-B-7b-hotfix-5)", () => {
  const fetchMock = vi.fn();
  let savedEnv: Record<string, string | undefined> = {};

  const COMPANY_ID = 93310337;
  const WHO_AMI_401_MESSAGE =
    "Could not log in. Check login info in Authorization header.";

  beforeEach(() => {
    savedEnv = {};
    for (const key of [
      "TRIPLETEX_COMPANY_ID",
      "TRIPLETEX_TOKEN",
      "TRIPLETEX_SESSION_TOKEN",
      "TRIPLETEX_EMPLOYEE_TOKEN",
    ] as const) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.TRIPLETEX_CONSUMER_TOKEN = "lp-consumer-token";

    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete process.env.TRIPLETEX_CONSUMER_TOKEN;
    vi.unstubAllGlobals();
  });

  test("audit_diag fanger HTTP-status og developerMessage ved whoAmI 401", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: { token: "session-from-sandbox" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 401,
            code: 401,
            message: "Unauthorized",
            developerMessage: WHO_AMI_401_MESSAGE,
          }),
          { status: 401 },
        ),
      );

    const result = await verifyTripletexEmployeeToken({
      employeeToken: "employee-token-smoke",
      expectedCompanyId: COMPANY_ID,
      consumerToken: "provider-consumer",
    });

    expect(result.auth.ok).toBe(false);
    expect(result.audit_diag?.hotfix_version).toBe("b7-h5");
    expect(result.audit_diag?.step_failed).toBe("whoAmI");
    expect(result.audit_diag?.steps?.session_create).toMatchObject({
      http_status: 200,
      path: "/token/session/:create",
      error: null,
    });
    expect(result.audit_diag?.steps?.whoAmI).toMatchObject({
      http_status: 401,
      path: "/token/session/>whoAmI",
    });
    expect(result.audit_diag?.steps?.whoAmI?.error).toContain(WHO_AMI_401_MESSAGE);
    expect(result.audit_diag?.steps?.company_match).toBeNull();
    expect(result.audit_diag?.steps?.scope).toBeNull();
    expect(result.audit_diag?.expected_company_id).toBe(COMPANY_ID);
    expect(result.audit_diag?.actual_company_id).toBeNull();
  });

  test("audit_diag fanger session_create 401", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 401,
          developerMessage: "Invalid employee token",
        }),
        { status: 401 },
      ),
    );

    const result = await verifyTripletexEmployeeToken({
      employeeToken: "bad-token",
      expectedCompanyId: COMPANY_ID,
    });

    expect(result.audit_diag?.step_failed).toBe("session_create");
    expect(result.audit_diag?.steps?.session_create).toMatchObject({
      http_status: 401,
      path: "/token/session/:create",
      error: "Invalid employee token",
    });
    expect(result.audit_diag?.steps?.whoAmI).toBeNull();
  });
});
