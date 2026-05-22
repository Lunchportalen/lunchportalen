import "server-only";

import {
  createTripletexAuthFromTokens,
  tripletexVerifyProductAccess,
  tripletexWhoAmI,
  TripletexClientError,
} from "@/lib/integrations/tripletex/client";

export type TripletexTokenVerificationStep = {
  ok: boolean;
  error: string | null;
  company_id?: number;
  company_name?: string | null;
};

export type TripletexVerifyStepHttpDiagnostic = {
  http_status: number | null;
  path: string;
  error: string | null;
};

export type TripletexVerifyCompanyMatchDiagnostic = {
  tripletex_company_id: number | null;
  expected_company_id: number;
  matched: boolean;
};

export type TripletexVerifyAuditDiag = {
  auth_ok: boolean;
  company_match_ok: boolean | null;
  scope_ok: boolean | null;
  step_failed: "session_create" | "whoAmI" | "company_match" | "scope" | "none";
  steps: {
    session_create: TripletexVerifyStepHttpDiagnostic | null;
    whoAmI: TripletexVerifyStepHttpDiagnostic | null;
    company_match: TripletexVerifyCompanyMatchDiagnostic | null;
    scope: TripletexVerifyStepHttpDiagnostic | null;
  };
  expected_company_id: number;
  actual_company_id: number | null;
  hotfix_version: string;
};

export type TripletexTokenVerificationResult = {
  auth: TripletexTokenVerificationStep;
  company_match: TripletexTokenVerificationStep;
  scope: TripletexTokenVerificationStep;
  all_passed: boolean;
  audit_diag?: TripletexVerifyAuditDiag;
};

const PATH_SESSION_CREATE = "/token/session/:create";
const PATH_WHO_AM_I = "/token/session/>whoAmI";
const PATH_PRODUCT = "/product";
const VERIFY_HOTFIX_VERSION = "b7-h5";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function extractTripletexDeveloperMessage(error: unknown): string | null {
  if (!(error instanceof TripletexClientError)) {
    return safeStr((error as Error)?.message) || null;
  }
  const detail = error.detail as Record<string, unknown> | null;
  if (detail) {
    const dev = safeStr(detail.developerMessage);
    if (dev) return dev;
  }
  return error.message || null;
}

function extractTripletexHttpStatus(error: unknown): number | null {
  if (error instanceof TripletexClientError) return error.status;
  return null;
}

function createAuditDiag(expectedCompanyId: number): TripletexVerifyAuditDiag {
  return {
    auth_ok: false,
    company_match_ok: null,
    scope_ok: null,
    step_failed: "session_create",
    steps: {
      session_create: null,
      whoAmI: null,
      company_match: null,
      scope: null,
    },
    expected_company_id: expectedCompanyId,
    actual_company_id: null,
    hotfix_version: VERIFY_HOTFIX_VERSION,
  };
}

function finalizeAuditDiag(
  auditDiag: TripletexVerifyAuditDiag,
  input: {
    authOk: boolean;
    companyMatchOk: boolean | null;
    scopeOk: boolean | null;
    stepFailed: TripletexVerifyAuditDiag["step_failed"];
    actualCompanyId: number | null;
  },
): TripletexVerifyAuditDiag {
  auditDiag.auth_ok = input.authOk;
  auditDiag.company_match_ok = input.companyMatchOk;
  auditDiag.scope_ok = input.scopeOk;
  auditDiag.step_failed = input.stepFailed;
  auditDiag.actual_company_id = input.actualCompanyId;
  return auditDiag;
}

function resolveLpConsumerToken(): string {
  const token = safeStr(process.env.TRIPLETEX_CONSUMER_TOKEN);
  if (!token) {
    throw new TripletexClientError({
      message: "TRIPLETEX_CONSUMER_TOKEN missing",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_CONFIG_MISSING",
    });
  }
  return token;
}

/**
 * TPT-B-7 — Three-step Employee Token verification (Node-side HTTP).
 * Tokens are never persisted here; caller records via lp_provider_test_tripletex_token RPC.
 */
export async function verifyTripletexEmployeeToken(input: {
  employeeToken: string;
  expectedCompanyId: number;
  consumerToken?: string;
}): Promise<TripletexTokenVerificationResult> {
  const employeeToken = safeStr(input.employeeToken);
  const expectedCompanyId = Number(input.expectedCompanyId);
  const consumerToken = safeStr(input.consumerToken) || resolveLpConsumerToken();

  const authStep: TripletexTokenVerificationStep = { ok: false, error: null };
  const companyStep: TripletexTokenVerificationStep = { ok: false, error: null };
  const scopeStep: TripletexTokenVerificationStep = { ok: false, error: null };
  const auditDiag = createAuditDiag(expectedCompanyId);

  if (!employeeToken) {
    authStep.error = "Employee token is required";
    return {
      auth: authStep,
      company_match: companyStep,
      scope: scopeStep,
      all_passed: false,
      audit_diag: finalizeAuditDiag(auditDiag, {
        authOk: false,
        companyMatchOk: null,
        scopeOk: null,
        stepFailed: "session_create",
        actualCompanyId: null,
      }),
    };
  }

  if (!Number.isFinite(expectedCompanyId) || expectedCompanyId <= 0) {
    authStep.error = "Invalid Tripletex company id";
    return {
      auth: authStep,
      company_match: companyStep,
      scope: scopeStep,
      all_passed: false,
      audit_diag: finalizeAuditDiag(auditDiag, {
        authOk: false,
        companyMatchOk: null,
        scopeOk: null,
        stepFailed: "session_create",
        actualCompanyId: null,
      }),
    };
  }

  let auth;
  try {
    auth = await createTripletexAuthFromTokens({
      tripletexCompanyId: expectedCompanyId,
      consumerToken,
      employeeToken,
    });
    auditDiag.steps.session_create = {
      http_status: 200,
      path: PATH_SESSION_CREATE,
      error: null,
    };
  } catch (error: unknown) {
    const status = extractTripletexHttpStatus(error);
    auditDiag.steps.session_create = {
      http_status: status,
      path: PATH_SESSION_CREATE,
      error: extractTripletexDeveloperMessage(error),
    };
    authStep.error =
      status === 401 || status === 403
        ? "Token avvist av Tripletex"
        : safeStr((error as Error)?.message ?? error) || "Autentisering feilet";
    return {
      auth: authStep,
      company_match: companyStep,
      scope: scopeStep,
      all_passed: false,
      audit_diag: finalizeAuditDiag(auditDiag, {
        authOk: false,
        companyMatchOk: null,
        scopeOk: null,
        stepFailed: "session_create",
        actualCompanyId: null,
      }),
    };
  }

  try {
    const who = await tripletexWhoAmI({ auth });
    auditDiag.steps.whoAmI = {
      http_status: 200,
      path: PATH_WHO_AM_I,
      error: null,
    };
    authStep.ok = true;
    authStep.company_id = who.companyId;
    authStep.company_name = who.companyName;

    const matched = who.companyId === expectedCompanyId;
    auditDiag.steps.company_match = {
      tripletex_company_id: who.companyId,
      expected_company_id: expectedCompanyId,
      matched,
    };

    if (!matched) {
      companyStep.error = `Token tilhører company ${who.companyId}, forventet ${expectedCompanyId}`;
      companyStep.company_id = who.companyId;
      return {
        auth: authStep,
        company_match: companyStep,
        scope: scopeStep,
        all_passed: false,
        audit_diag: finalizeAuditDiag(auditDiag, {
          authOk: true,
          companyMatchOk: false,
          scopeOk: null,
          stepFailed: "company_match",
          actualCompanyId: who.companyId,
        }),
      };
    }

    companyStep.ok = true;
    companyStep.company_id = who.companyId;
    companyStep.company_name = who.companyName;
  } catch (error: unknown) {
    const status = extractTripletexHttpStatus(error);
    auditDiag.steps.whoAmI = {
      http_status: status,
      path: PATH_WHO_AM_I,
      error: extractTripletexDeveloperMessage(error),
    };
    authStep.ok = false;
    authStep.error =
      status === 401
        ? "Token avvist av Tripletex"
        : status === 403
          ? "Kontoen har ikke API-tilgang"
          : safeStr((error as Error)?.message ?? error) || "whoAmI feilet";
    return {
      auth: authStep,
      company_match: companyStep,
      scope: scopeStep,
      all_passed: false,
      audit_diag: finalizeAuditDiag(auditDiag, {
        authOk: false,
        companyMatchOk: null,
        scopeOk: null,
        stepFailed: "whoAmI",
        actualCompanyId: null,
      }),
    };
  }

  const scope = await tripletexVerifyProductAccess({ auth });
  if (scope.ok) {
    auditDiag.steps.scope = {
      http_status: scope.status ?? 200,
      path: PATH_PRODUCT,
      error: null,
    };
    scopeStep.ok = true;
  } else {
    auditDiag.steps.scope = {
      http_status: scope.status,
      path: PATH_PRODUCT,
      error: scope.developerMessage ?? scope.error,
    };
    scopeStep.error =
      scope.status === 403
        ? "Token mangler tilgang til produktkatalogen"
        : scope.error || "Scope-sjekk feilet";
  }

  const all_passed = authStep.ok && companyStep.ok && scopeStep.ok;
  return {
    auth: authStep,
    company_match: companyStep,
    scope: scopeStep,
    all_passed,
    audit_diag: finalizeAuditDiag(auditDiag, {
      authOk: authStep.ok,
      companyMatchOk: companyStep.ok,
      scopeOk: scopeStep.ok,
      stepFailed: all_passed ? "none" : "scope",
      actualCompanyId: authStep.company_id ?? null,
    }),
  };
}

/** Run verify + record audit via service_role RPC. */
export async function testAndRecordTripletexToken(
  admin: any,
  input: {
    providerId: string;
    env: "test" | "prod";
    tripletexCompanyId: number;
    employeeToken: string;
    requestRid?: string;
  },
): Promise<TripletexTokenVerificationResult> {
  const result = await verifyTripletexEmployeeToken({
    employeeToken: input.employeeToken,
    expectedCompanyId: input.tripletexCompanyId,
  });

  const payload = {
    ...result,
    auth: {
      ...result.auth,
      company_name: result.auth.company_name ?? result.company_match.company_name ?? null,
    },
    request_rid: input.requestRid ?? null,
  };

  const { error } = await admin.rpc("lp_provider_test_tripletex_token", {
    p_provider_id: input.providerId,
    p_env: input.env,
    p_tripletex_company_id: input.tripletexCompanyId,
    p_employee_token: input.employeeToken,
    p_verification_result: payload,
  });

  if (error) {
    throw new TripletexClientError({
      message: safeStr(error.message) || "lp_provider_test_tripletex_token failed",
      kind: "PERMANENT",
      code: "TRIPLETEX_RPC_TEST_TOKEN_FAILED",
      detail: error,
    });
  }

  return result;
}

/** Complete connection after successful verification (service_role RPC). */
export async function completeTripletexConnectionAfterVerify(
  admin: any,
  input: {
    providerId: string;
    env: "test" | "prod";
    tripletexCompanyId: number;
    employeeToken: string;
    verificationResult: TripletexTokenVerificationResult;
    requestRid?: string;
  },
) {
  const consumerToken = resolveLpConsumerToken();
  const verificationPayload = {
    ...input.verificationResult,
    request_rid: input.requestRid ?? null,
  };

  const { data, error } = await admin.rpc("lp_provider_complete_tripletex_connection", {
    p_provider_id: input.providerId,
    p_env: input.env,
    p_tripletex_company_id: input.tripletexCompanyId,
    p_employee_token: input.employeeToken,
    p_consumer_token: consumerToken,
    p_verification_result: verificationPayload,
  });

  if (error) {
    throw new TripletexClientError({
      message: safeStr(error.message) || "lp_provider_complete_tripletex_connection failed",
      kind: "PERMANENT",
      code: "TRIPLETEX_RPC_COMPLETE_CONNECTION_FAILED",
      detail: error,
    });
  }

  return data;
}
