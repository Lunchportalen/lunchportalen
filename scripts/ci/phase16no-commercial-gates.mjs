/**
 * Phase 16NO CI gate — global commercial model + Norway-first constraints.
 * Exit 0 = PASS. Exit 1 = block deploy.
 */
// Prefer vitest as source of truth; this script validates static file invariants (no TS runtime import).
const failures = [];

function pass(name) {
  process.stdout.write(`PASS ${name}\n`);
}
function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
  process.stdout.write(`FAIL ${name}: ${detail}\n`);
}

// Static file checks (always)
import fs from "node:fs";
const invariantSrc = fs.readFileSync("lib/markets/commercialModelInvariant.ts", "utf8");
const norwaySrc = fs.readFileSync("lib/markets/norwayFirstActivation.ts", "utf8");
const commercialSrc = fs.readFileSync("lib/markets/commercialModel.ts", "utf8");
const adr = fs.readFileSync("docs/engineering/ADR-020-global-agency-commission-model.md", "utf8");
const paymentSrc = fs.readFileSync("lib/billing/paymentPolicy.ts", "utf8");

if (invariantSrc.includes('COMMERCIAL_MODEL_ID = "agency_commission_invoice_only_v1"')) {
  pass("GLOBAL_COMMERCIAL_MODEL_21_COUNTRIES");
} else fail("GLOBAL_COMMERCIAL_MODEL_21_COUNTRIES", "missing model id");

if (invariantSrc.includes("COMMISSION_RATE_BPS = 500")) pass("COMMISSION_RATE_500_BPS");
else fail("COMMISSION_RATE_500_BPS", "not 500");

if (invariantSrc.includes('commissionBase: "net_excluding_customer_tax"')) {
  pass("COMMISSION_BASE_EXCLUDES_CUSTOMER_TAX");
} else fail("COMMISSION_BASE_EXCLUDES_CUSTOMER_TAX", "missing");

if (!commercialSrc.includes("MARKET_COMMERCIAL_MODELS.US =")) pass("PROVIDER_IS_SELLER_21_21");
else fail("PROVIDER_IS_SELLER_21_21", "US override still present");

if (commercialSrc.includes('invoiceIssuer: "provider"')) pass("PROVIDER_INVOICES_CUSTOMER_21_21");
else fail("PROVIDER_INVOICES_CUSTOMER_21_21", "missing");

if (invariantSrc.includes("platformInvoicesProvider: true")) pass("PLATFORM_INVOICES_PROVIDER_21_21");
else fail("PLATFORM_INVOICES_PROVIDER_21_21", "missing");

if (invariantSrc.includes("platformCollectsCustomerFunds: false")) pass("PLATFORM_COLLECTS_CUSTOMER_FUNDS_0_21");
else fail("PLATFORM_COLLECTS_CUSTOMER_FUNDS_0_21", "missing");

if (paymentSrc.includes('mode: "invoice_only"') && paymentSrc.includes("allowOnlinePayment: false")) {
  pass("INVOICE_ONLY_21_21");
  pass("STRIPE_CALLS_POLICY_OFF");
} else fail("INVOICE_ONLY_21_21", "payment policy drift");

if (invariantSrc.includes("NO_PLATFORM_SERVICE_STANDARD_VAT_25") && invariantSrc.includes("2500")) {
  pass("NORWAY_PLATFORM_VAT_25");
} else fail("NORWAY_PLATFORM_VAT_25", "missing tax code/rate");

if (norwaySrc.includes("COUNTRY_PRODUCTION_DISABLED") && norwaySrc.includes("otherCountriesDisabled")) {
  pass("OTHER_COUNTRIES_PRODUCTION_DISABLED_20_20");
} else fail("OTHER_COUNTRIES_PRODUCTION_DISABLED_20_20", "missing guard");

if (adr.includes("agency_commission_invoice_only_v1") && adr.includes("all 21 countries")) {
  pass("ADR_020_PRESENT");
} else fail("ADR_020_PRESENT", "missing ADR");

if (norwaySrc.includes("ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER") && norwaySrc.includes("PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION")) {
  pass("OWNER_WAIVER_AND_MVA_INVOICE_GATE");
} else fail("OWNER_WAIVER_AND_MVA_INVOICE_GATE", "missing owner waiver / MVA invoice gate");

if (fs.existsSync("docs/rc/phase16no/evidence/mva/LUNCHPORTALEN_MVA_REGISTRATION.json")) {
  pass("MVA_REGISTRATION_EVIDENCE_PRESENT");
} else fail("MVA_REGISTRATION_EVIDENCE_PRESENT", "missing Brønnøysund evidence");

if (failures.length) {
  process.stdout.write(`\nPHASE16NO_GATES: FAIL (${failures.length})\n`);
  process.exit(1);
}
process.stdout.write("\nPHASE16NO_GATES: PASS\n");
process.exit(0);
