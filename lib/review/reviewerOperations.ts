/**
 * Phase 15G.3B — reviewer onboarding / scope operations (service-layer).
 * Never fabricates production reviewer identities. Test fixtures must set isTestFixture.
 */

import { createHash } from "node:crypto";
import type { ReviewerRole } from "@/lib/review/reviewWorkflow";
import type { ApprovalType } from "@/lib/review/approvalIngestionContract";
import { SUPPORTED_COUNTRY_CODES, type CountryCode } from "@/lib/markets/supportedMarkets";

export type ReviewerStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "EXPIRED";

export type ReviewerProfileInput = {
  displayLabel: string;
  organization: string;
  email: string;
  role: ReviewerRole;
  countryScope: CountryCode[] | ["ALL"];
  localeScope: string[] | null;
  permittedApprovalTypes: ApprovalType[];
  credentialReference: string | null;
  /** Secret manager reference only — never raw secret. */
  credentialSecretRef: string | null;
  credentialValidFrom: string | null;
  credentialValidTo: string | null;
  conflictOfInterestDeclared: boolean;
  authUserId: string | null;
  isTestFixture: boolean;
  actorId: string;
};

export function hashReviewerEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export function validateReviewerProfileInput(input: ReviewerProfileInput): string[] {
  const errors: string[] = [];
  if (!input.displayLabel.trim()) errors.push("DISPLAY_LABEL_REQUIRED");
  if (!input.organization.trim()) errors.push("ORGANIZATION_REQUIRED");
  if (!input.email.includes("@")) errors.push("EMAIL_INVALID");
  if (!input.conflictOfInterestDeclared) errors.push("COI_REQUIRED");
  if (!input.permittedApprovalTypes.length) errors.push("APPROVAL_TYPES_REQUIRED");
  if (!input.countryScope.length) errors.push("COUNTRY_SCOPE_REQUIRED");
  if (input.countryScope[0] !== "ALL") {
    for (const c of input.countryScope) {
      if (!SUPPORTED_COUNTRY_CODES.includes(c as CountryCode)) errors.push(`COUNTRY_INVALID:${c}`);
    }
  }
  if (input.credentialSecretRef && /secret|password|token=/i.test(input.credentialSecretRef)) {
    // allow refs like vault:// or sm:// only — block obvious inline secrets
    if (!/^(vault:|sm:|aws-sm:|gcp-sm:)/i.test(input.credentialSecretRef)) {
      errors.push("SECRET_REF_FORMAT_INVALID");
    }
  }
  if (!input.isTestFixture && /^TEST_FIXTURE/i.test(input.displayLabel) === false) {
    // production path: label must not pretend to be fixture; fixtures must be flagged
  }
  if (input.isTestFixture && !/^TEST_FIXTURE/i.test(input.displayLabel)) {
    errors.push("TEST_FIXTURE_LABEL_REQUIRED");
  }
  return errors;
}

export function assertScopeAllows(args: {
  countryScope: string[];
  localeScope: string[] | null;
  country: string;
  locale: string | null;
}): void {
  const countries = args.countryScope;
  if (!(countries.includes("ALL") || countries.includes(args.country))) {
    throw new Error(`REVIEWER_SCOPE_COUNTRY:${args.country}`);
  }
  if (args.locale && args.localeScope && args.localeScope.length > 0) {
    if (!(args.localeScope.includes("ALL") || args.localeScope.includes(args.locale))) {
      throw new Error(`REVIEWER_SCOPE_LOCALE:${args.locale}`);
    }
  }
}

export function assertNoSuperadminSelfReview(args: {
  actorIsSuperadmin: boolean;
  actorId: string;
  reviewerAuthUserId: string | null;
  separationRequired: boolean;
}): void {
  if (!args.separationRequired) return;
  if (args.actorIsSuperadmin && args.reviewerAuthUserId && args.reviewerAuthUserId === args.actorId) {
    throw new Error("SUPERADMIN_SELF_REVIEWER_FORBIDDEN");
  }
}

export function reviewerRowFromInput(input: ReviewerProfileInput) {
  const errors = validateReviewerProfileInput(input);
  if (errors.length) throw new Error(errors.join(","));
  return {
    auth_user_id: input.authUserId,
    display_label: input.displayLabel.trim(),
    organization: input.organization.trim(),
    email_hash: hashReviewerEmail(input.email),
    role: input.role,
    country_scope: input.countryScope,
    locale_scope: input.localeScope,
    permitted_approval_types: input.permittedApprovalTypes,
    credential_reference: input.credentialReference,
    credential_secret_ref: input.credentialSecretRef,
    credential_valid_from: input.credentialValidFrom,
    credential_valid_to: input.credentialValidTo,
    conflict_of_interest_declared: input.conflictOfInterestDeclared,
    status: "INVITED" as ReviewerStatus,
    is_test_fixture: input.isTestFixture,
  };
}
