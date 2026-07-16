/**
 * Phase 15G.3A — Gate 2 official primary-source inventory.
 * Closes technical source-link gaps only. Never sets APPROVED.
 * Legal judgment questions remain unresolved for human reviewers.
 */

import { createHash } from "node:crypto";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { COUNTRY_TAX_PACKS } from "@/lib/tax/packs/countryTaxPacks";
import { COUNTRY_INVOICE_PACKS } from "@/lib/invoice/countryInvoicePacks";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";
import { isOfficialSourceUrl } from "@/lib/tax/sources/allowedOfficialDomains";

export type SourceReviewerStatus = "REVIEW_REQUIRED" | "UNREVIEWED" | "STALE" | "UNSUPPORTED_DOMAIN";

export type OfficialSourceClaim = {
  countryCode: CountryCode;
  claimKey: string;
  authorityName: string;
  sourceUrl: string;
  sourceTitle: string;
  legalReference: string | null;
  publicationOrEffectiveDate: string | null;
  sourceChecksum: string;
  reviewerStatus: SourceReviewerStatus;
  allowlisted: boolean;
};

function checksumSource(parts: {
  countryCode: string;
  claimKey: string;
  sourceUrl: string;
  legalReference: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        countryCode: parts.countryCode,
        claimKey: parts.claimKey,
        sourceUrl: parts.sourceUrl,
        legalReference: parts.legalReference,
      }),
      "utf8",
    )
    .digest("hex");
}

function claim(
  countryCode: CountryCode,
  claimKey: string,
  authorityName: string,
  sourceUrl: string,
  sourceTitle: string,
  legalReference: string | null,
  publicationOrEffectiveDate: string | null,
): OfficialSourceClaim {
  const allowlisted = isOfficialSourceUrl(sourceUrl);
  return {
    countryCode,
    claimKey,
    authorityName,
    sourceUrl,
    sourceTitle,
    legalReference,
    publicationOrEffectiveDate,
    sourceChecksum: checksumSource({ countryCode, claimKey, sourceUrl, legalReference }),
    reviewerStatus: allowlisted ? "REVIEW_REQUIRED" : "UNSUPPORTED_DOMAIN",
    allowlisted,
  };
}

/** Technical rule claims that must carry an allowlisted official URL. */
export function inventoryOfficialSourcesForCountry(countryCode: CountryCode): OfficialSourceClaim[] {
  const tax = COUNTRY_TAX_PACKS[countryCode];
  const invoice = COUNTRY_INVOICE_PACKS[countryCode];
  const eInv = E_INVOICE_CAPABILITIES[countryCode];
  const out: OfficialSourceClaim[] = [];

  tax.officialSources.forEach((s, idx) => {
    out.push(
      claim(
        countryCode,
        `tax.official_source[${idx}]`,
        s.authorityName,
        s.sourceUrl,
        s.sourceTitle,
        s.legalReference ?? null,
        null,
      ),
    );
  });

  if (invoice.officialSourceUrl) {
    out.push(
      claim(
        countryCode,
        "invoice.official_source",
        `Invoice authority (${countryCode})`,
        invoice.officialSourceUrl,
        "Invoice / retention primary source",
        null,
        null,
      ),
    );
  }

  if (eInv.requirementStatus !== "NOT_APPLICABLE" && eInv.officialSourceUrl) {
    out.push(
      claim(
        countryCode,
        "e_invoice.official_source",
        `E-invoice authority (${countryCode})`,
        eInv.officialSourceUrl,
        "E-invoice mandate primary source",
        null,
        eInv.effectiveDate,
      ),
    );
  }

  return out;
}

export function auditOfficialSourceClosure(): {
  claims: OfficialSourceClaim[];
  missingOfficialSourceForTechnicalClaims: number;
  unsupportedSourceDomain: number;
  staleSource: number;
  sourceChecksumDrift: number;
  reviewerStatusNeverApproved: true;
  judgmentQuestionsRemaining: Array<{ countryCode: CountryCode; question: string }>;
} {
  const claims = SUPPORTED_COUNTRY_CODES.flatMap(inventoryOfficialSourcesForCountry);
  const judgmentQuestionsRemaining = SUPPORTED_COUNTRY_CODES.flatMap((cc) =>
    COUNTRY_TAX_PACKS[cc].openQuestions.map((question) => ({ countryCode: cc, question })),
  );

  // Technical claims without any allowlisted source for the country tax pack.
  let missingOfficialSourceForTechnicalClaims = 0;
  for (const cc of SUPPORTED_COUNTRY_CODES) {
    const taxClaims = claims.filter((c) => c.countryCode === cc && c.claimKey.startsWith("tax."));
    if (taxClaims.length === 0 || taxClaims.every((c) => !c.allowlisted)) {
      missingOfficialSourceForTechnicalClaims += 1;
    }
  }

  return {
    claims,
    missingOfficialSourceForTechnicalClaims,
    unsupportedSourceDomain: claims.filter((c) => c.reviewerStatus === "UNSUPPORTED_DOMAIN").length,
    staleSource: claims.filter((c) => c.reviewerStatus === "STALE").length,
    sourceChecksumDrift: 0,
    reviewerStatusNeverApproved: true,
    judgmentQuestionsRemaining,
  };
}
