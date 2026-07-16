/**
 * Country-aware invoice / credit / payment / commission dry-run flow (Phase 15G.2B).
 * Never issues legally binding staging invoices. Stripe calls: 0.
 */

import { COUNTRY_INVOICE_PACKS, buildCreditNoteDraft } from "@/lib/invoice/countryInvoicePacks";
import { buildCommissionSnapshot } from "@/lib/billing/commissionTaxSnapshot";
import { allTechnicallyConfiguredRules } from "@/lib/tax/rules/technicallyConfiguredRules";
import { resolveTax } from "@/lib/tax/engine/resolver";
import { getTaxJurisdictionProvider } from "@/lib/tax/providers/registry";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { platformCommissionMinor } from "@/lib/money/minorUnits";

export type InvoiceDryRunResult = {
  ok: boolean;
  countryCode: CountryCode;
  currencyCode: string;
  legalIssuance: false;
  taxResolveStatus: "OK" | "FAIL_CLOSED" | "PROVIDER_FIXTURE";
  taxAmountMinor: bigint | null;
  commissionMinor: bigint;
  commissionTaxStatus: "OK" | "FAIL_CLOSED";
  creditNoteLinked: boolean;
  stripeCalls: 0;
  errors: string[];
};

/**
 * Dry-run billing for a country. Tax engine remains fail-closed on APPROVED rules;
 * US/CA may attach provider fixture snapshots for technical verification.
 */
export function runInvoiceDryRun(args: {
  countryCode: CountryCode;
  subdivisionCode?: string | null;
  netMinor: bigint;
  taxPointDate: string;
  capturedAt: string;
}): InvoiceDryRunResult {
  const pack = COUNTRY_INVOICE_PACKS[args.countryCode];
  const errors: string[] = [];
  if (pack.reviewStatus === "APPROVED") {
    errors.push("UNEXPECTED_INVOICE_APPROVAL");
  }

  let taxResolveStatus: InvoiceDryRunResult["taxResolveStatus"] = "FAIL_CLOSED";
  let taxAmountMinor: bigint | null = null;

  if (args.countryCode === "US" || args.countryCode === "CA") {
    const provider = getTaxJurisdictionProvider();
    const addr = provider.resolveAddress(
      { countryCode: args.countryCode, subdivisionCode: args.subdivisionCode },
      args.capturedAt,
    );
    if (addr.ok === false) {
      errors.push(`JURISDICTION:${addr.code}`);
    } else if (addr.ok === true) {
      const rates = provider.resolveRates({
        jurisdictionPath: addr.jurisdictionPath,
        category: "prepared_food",
        requestedAt: args.capturedAt,
      });
      if (rates.ok === true) {
        taxResolveStatus = "PROVIDER_FIXTURE";
        let sum = BigInt(0);
        for (const line of rates.rateLines) {
          if (line.rateScale === "deci_bps_1e5") {
            sum += (args.netMinor * BigInt(line.rateBps) + BigInt(50_000)) / BigInt(100_000);
          } else {
            sum += (args.netMinor * BigInt(line.rateBps) + BigInt(5_000)) / BigInt(10_000);
          }
        }
        taxAmountMinor = sum;
      } else if (rates.ok === false) {
        errors.push(`RATES:${rates.code}`);
      }
    }
  } else {
    const tax = resolveTax({
      countryCode: args.countryCode,
      currencyCode: pack.currencyCode,
      taxCategory: "prepared_food",
      customerType: "B2B",
      fulfillmentType: "delivery",
      taxableBaseMinor: args.netMinor,
      taxPointDate: args.taxPointDate,
      rules: allTechnicallyConfiguredRules(),
    });
    // Expected fail-closed until APPROVED — technical config still present.
    taxResolveStatus = tax.ok ? "OK" : "FAIL_CLOSED";
    taxAmountMinor = tax.ok ? tax.taxAmountMinor : null;
  }

  const commission = platformCommissionMinor(args.netMinor, pack.currencyCode);
  const commissionSnap = buildCommissionSnapshot({
    countryCode: args.countryCode,
    currencyCode: pack.currencyCode,
    orderNetMinor: args.netMinor,
    taxPointDate: args.taxPointDate,
    rules: allTechnicallyConfiguredRules(),
    subdivisionCode: args.subdivisionCode,
    capturedAt: args.capturedAt,
  });

  const credit = buildCreditNoteDraft({
    countryCode: args.countryCode,
    originalInvoiceId: `DRY-${args.countryCode}-1`,
    currencyCode: pack.currencyCode,
    amountMinor: args.netMinor,
    taxAmountMinor: taxAmountMinor ?? BigInt(0),
    reason: "staging_dry_run_cancel",
  });

  return {
    ok: errors.length === 0 && commission.amountMinor === commissionSnap.commissionMinor,
    countryCode: args.countryCode,
    currencyCode: pack.currencyCode,
    legalIssuance: false,
    taxResolveStatus,
    taxAmountMinor,
    commissionMinor: commission.amountMinor,
    commissionTaxStatus: commissionSnap.commissionTax.status,
    creditNoteLinked: Boolean(credit.originalInvoiceId),
    stripeCalls: 0,
    errors,
  };
}

export function runAllCountryInvoiceDryRuns(capturedAt: string): {
  passed: number;
  failed: number;
  stripeCalls: number;
  results: InvoiceDryRunResult[];
} {
  const countries: CountryCode[] = [
    "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
    "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
  ];
  const results = countries.map((c) =>
    runInvoiceDryRun({
      countryCode: c,
      subdivisionCode: c === "US" ? "TX" : c === "CA" ? "ON" : null,
      netMinor: BigInt(20_000),
      taxPointDate: "2026-07-16",
      capturedAt,
    }),
  );
  return {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    stripeCalls: results.reduce((a, r) => a + r.stripeCalls, 0),
    results,
  };
}
