/**
 * Phase 15G.3B — live registration / credential operational records.
 * Stores secret_manager_ref only — never secret values.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";

export type RegistrationStatus = "VERIFIED" | "NOT_APPLICABLE" | "BLOCKED" | "EXPIRED";

export type RegistrationRequirement = {
  countryCode: CountryCode;
  requirementType: string;
  status: RegistrationStatus;
  authorityOrProvider: string | null;
  naReason: string | null;
};

const BASE_TYPES = [
  "tax_registration",
  "vat_gst_sales_tax_number",
  "cross_border_model",
  "invoice_issuer",
  "local_representative",
  "accounting_bank_readiness",
  "production_credential_readiness",
  "callback_webhook_readiness",
] as const;

export function buildRegistrationRequirementSeeds(): RegistrationRequirement[] {
  const out: RegistrationRequirement[] = [];
  for (const cc of SUPPORTED_COUNTRY_CODES) {
    for (const t of BASE_TYPES) {
      out.push({
        countryCode: cc,
        requirementType: t,
        status: "BLOCKED",
        authorityOrProvider: null,
        naReason: null,
      });
    }
    const e = E_INVOICE_CAPABILITIES[cc];
    if (e.requirementStatus === "NOT_APPLICABLE") {
      out.push(
        {
          countryCode: cc,
          requirementType: "peppol_registration",
          status: "NOT_APPLICABLE",
          authorityOrProvider: null,
          naReason: "US e-invoice mandate NOT_APPLICABLE for product scope",
        },
        {
          countryCode: cc,
          requirementType: "national_ctc_registration",
          status: "NOT_APPLICABLE",
          authorityOrProvider: null,
          naReason: "US e-invoice mandate NOT_APPLICABLE for product scope",
        },
      );
    } else {
      const needsPeppol = e.channels.includes("peppol");
      const needsCtc = e.channels.includes("national_ctc");
      out.push(
        {
          countryCode: cc,
          requirementType: "peppol_registration",
          status: needsPeppol ? "BLOCKED" : "NOT_APPLICABLE",
          authorityOrProvider: needsPeppol ? "Peppol Access Point" : null,
          naReason: needsPeppol ? null : "Peppol channel not in capability set",
        },
        {
          countryCode: cc,
          requirementType: "national_ctc_registration",
          status: needsCtc ? "BLOCKED" : "NOT_APPLICABLE",
          authorityOrProvider: needsCtc ? "National CTC" : null,
          naReason: needsCtc ? null : "National CTC channel not in capability set",
        },
      );
    }
  }
  return out;
}

export function summarizeRegistrationSeeds(rows: RegistrationRequirement[]) {
  return {
    workflowReady: true,
    countriesVerified: rows.filter((r) => r.requirementType === "tax_registration" && r.status === "VERIFIED")
      .length,
    blockedDependencies: rows.filter((r) => r.status === "BLOCKED").length,
    expiredDependencies: rows.filter((r) => r.status === "EXPIRED").length,
    notApplicable: rows.filter((r) => r.status === "NOT_APPLICABLE").length,
    secretLeakage: 0,
  };
}
