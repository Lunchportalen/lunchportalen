import type { AgreementPayload } from "@/lib/onboarding/types";
import { validateAgreementPayload, type AgreementAllowlists } from "@/lib/onboarding/validateAgreementPayload";

export type SubmitAgreementResult =
  | { ok: true; payload: AgreementPayload }
  | { ok: false; message: string; issues: string[] };

/**
 * UI-lagets innsendingspunkt: validerer mot CMS-allowlister når de er tilgjengelige.
 */
export async function submitAgreement(
  payload: AgreementPayload,
  allowlists?: AgreementAllowlists | null
): Promise<SubmitAgreementResult> {
  const issues = validateAgreementPayload(payload, allowlists ?? null);
  if (issues.length) {
    return { ok: false, message: "Skjemaet kan ikke sendes.", issues };
  }
  return { ok: true, payload };
}
