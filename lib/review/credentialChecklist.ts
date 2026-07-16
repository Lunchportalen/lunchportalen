/**
 * Phase 15G.3A — live registration / credential checklist per country.
 * Never marks VERIFIED without real evidence. Mock/sandbox ≠ live.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";
import { credentialDependencies } from "@/lib/invoice/eInvoiceAdapters";

export type CredentialItemStatus = "VERIFIED" | "NOT_APPLICABLE" | "BLOCKED" | "EXPIRED";

export type CredentialItem = {
  key: string;
  label: string;
  status: CredentialItemStatus;
  blocking: boolean;
  evidenceRequired: string;
};

export type CountryCredentialChecklist = {
  countryCode: CountryCode;
  items: CredentialItem[];
  complete: boolean;
  blockedCount: number;
  expiredCount: number;
};

function item(
  key: string,
  label: string,
  status: CredentialItemStatus,
  evidenceRequired: string,
  blocking = true,
): CredentialItem {
  return { key, label, status, blocking: blocking && status === "BLOCKED", evidenceRequired };
}

export function buildCountryCredentialChecklist(countryCode: CountryCode): CountryCredentialChecklist {
  const eInv = E_INVOICE_CAPABILITIES[countryCode];
  const eNa = eInv.requirementStatus === "NOT_APPLICABLE";
  const deps = credentialDependencies().filter((d) => d.countryCode === countryCode);

  const items: CredentialItem[] = [
    item(
      "tax_registration",
      "Tax / VAT / GST / sales-tax registration",
      "BLOCKED",
      "Live registration number for launch legal entity",
    ),
    item(
      "legal_entity_or_cross_border",
      "Legal entity or approved cross-border structure",
      "BLOCKED",
      "KYB pack + entity documents linked to country",
    ),
    item(
      "invoice_issuer_readiness",
      "Invoice issuer readiness",
      "BLOCKED",
      "Issuer identity + numbering authority + accounting readiness",
    ),
    item(
      "bank_accounting_readiness",
      "Bank / accounting readiness",
      "BLOCKED",
      "Settlement account + chart of accounts mapping",
    ),
    item(
      "local_representative",
      "Local representative where required",
      countryCode === "US" || countryCode === "CA" ? "BLOCKED" : "BLOCKED",
      "Named local contact / fiscal representative if mandated",
    ),
    item("launch_owner", "Launch owner assigned", "BLOCKED", "Named human launch owner (not fabricated)"),
    item("tax_owner", "Tax owner assigned", "BLOCKED", "Named human tax owner"),
    item("legal_owner", "Legal owner assigned", "BLOCKED", "Named human legal owner"),
    item("incident_owner", "Incident owner assigned", "BLOCKED", "Named human incident owner"),
  ];

  if (eNa) {
    items.push(
      item(
        "e_invoice_mandate",
        "National e-invoice mandate",
        "NOT_APPLICABLE",
        "US: no federal B2B CTC mandate for this product scope",
        false,
      ),
      item("peppol", "Peppol registration", "NOT_APPLICABLE", "Not required for US N/A path", false),
      item("national_ctc", "National CTC registration", "NOT_APPLICABLE", "Not required for US N/A path", false),
      item("production_credentials", "E-invoice production credentials", "NOT_APPLICABLE", "N/A", false),
      item("callback_endpoints", "Callback / webhook readiness", "NOT_APPLICABLE", "N/A", false),
    );
  } else {
    const needsPeppol = deps.some((d) => d.dependency.includes(":peppol:"));
    const needsCtc = deps.some((d) => d.dependency.includes(":national_ctc:"));
    items.push(
      item(
        "e_invoice_mandate",
        "National e-invoice mandate review",
        "BLOCKED",
        "Signed e-invoice review + mandate effective date",
      ),
      item(
        "peppol",
        "Peppol registration",
        needsPeppol ? "BLOCKED" : "NOT_APPLICABLE",
        needsPeppol ? "Live Peppol AP contract + participant ID" : "Channel not required",
        needsPeppol,
      ),
      item(
        "national_ctc",
        "National CTC / e-invoice registration",
        needsCtc ? "BLOCKED" : "NOT_APPLICABLE",
        needsCtc ? "Live national CTC production registration" : "Channel not required",
        needsCtc,
      ),
      item(
        "production_credentials",
        "E-invoice production credentials",
        "BLOCKED",
        "Production credentials — sandbox/mock insufficient",
      ),
      item(
        "callback_endpoints",
        "Callback / webhook readiness",
        "BLOCKED",
        "Production callback URLs + rejection/retry workflow proof",
      ),
    );
  }

  const blockedCount = items.filter((i) => i.status === "BLOCKED").length;
  const expiredCount = items.filter((i) => i.status === "EXPIRED").length;
  const complete =
    blockedCount === 0 &&
    expiredCount === 0 &&
    items.every((i) => i.status === "VERIFIED" || i.status === "NOT_APPLICABLE");

  return { countryCode, items, complete, blockedCount, expiredCount };
}

export function auditAllCredentialChecklists(): {
  countriesComplete: number;
  countriesBlocked: number;
  missingTaxRegistrations: string[];
  missingEInvoiceRegistrations: string[];
  missingPeppol: string[];
  missingCtc: string[];
  missingLocalRepresentatives: string[];
  expired: string[];
  byCountry: CountryCredentialChecklist[];
} {
  const byCountry = SUPPORTED_COUNTRY_CODES.map(buildCountryCredentialChecklist);
  const missing = (key: string) =>
    byCountry.filter((c) => c.items.some((i) => i.key === key && i.status === "BLOCKED")).map((c) => c.countryCode);

  return {
    countriesComplete: byCountry.filter((c) => c.complete).length,
    countriesBlocked: byCountry.filter((c) => !c.complete).length,
    missingTaxRegistrations: missing("tax_registration"),
    missingEInvoiceRegistrations: missing("e_invoice_mandate"),
    missingPeppol: missing("peppol"),
    missingCtc: missing("national_ctc"),
    missingLocalRepresentatives: missing("local_representative"),
    expired: byCountry.flatMap((c) =>
      c.items.filter((i) => i.status === "EXPIRED").map((i) => `${c.countryCode}:${i.key}`),
    ),
    byCountry,
  };
}
