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

export type TripletexTokenVerificationResult = {
  auth: TripletexTokenVerificationStep;
  company_match: TripletexTokenVerificationStep;
  scope: TripletexTokenVerificationStep;
  all_passed: boolean;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
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

  if (!employeeToken) {
    authStep.error = "Employee token is required";
    return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed: false };
  }

  if (!Number.isFinite(expectedCompanyId) || expectedCompanyId <= 0) {
    authStep.error = "Invalid Tripletex company id";
    return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed: false };
  }

  let auth;
  try {
    auth = await createTripletexAuthFromTokens({
      tripletexCompanyId: expectedCompanyId,
      consumerToken,
      employeeToken,
    });
  } catch (error: unknown) {
    const status =
      error instanceof TripletexClientError ? error.status : null;
    authStep.error =
      status === 401 || status === 403
        ? "Token avvist av Tripletex"
        : safeStr((error as Error)?.message ?? error) || "Autentisering feilet";
    return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed: false };
  }

  try {
    const who = await tripletexWhoAmI({ auth });
    authStep.ok = true;
    authStep.company_id = who.companyId;
    authStep.company_name = who.companyName;

    if (who.companyId !== expectedCompanyId) {
      companyStep.error = `Token tilhører company ${who.companyId}, forventet ${expectedCompanyId}`;
      companyStep.company_id = who.companyId;
    } else {
      companyStep.ok = true;
      companyStep.company_id = who.companyId;
      companyStep.company_name = who.companyName;
    }
  } catch (error: unknown) {
    const status = error instanceof TripletexClientError ? error.status : null;
    authStep.ok = false;
    authStep.error =
      status === 401
        ? "Token avvist av Tripletex"
        : status === 403
          ? "Kontoen har ikke API-tilgang"
          : safeStr((error as Error)?.message ?? error) || "whoAmI feilet";
    return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed: false };
  }

  if (!companyStep.ok) {
    return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed: false };
  }

  const scope = await tripletexVerifyProductAccess({ auth });
  if (scope.ok) {
    scopeStep.ok = true;
  } else {
    scopeStep.error =
      scope.status === 403
        ? "Token mangler tilgang til produktkatalogen"
        : scope.error || "Scope-sjekk feilet";
  }

  const all_passed = authStep.ok && companyStep.ok && scopeStep.ok;
  return { auth: authStep, company_match: companyStep, scope: scopeStep, all_passed };
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
