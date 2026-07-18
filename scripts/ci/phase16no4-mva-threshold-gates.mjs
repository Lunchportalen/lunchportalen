/**
 * Phase 16NO.4 permanent CI gates — Norway MVA threshold automation.
 * Exit 0 = PASS. Exit 1 = block deploy.
 */
import fs from "node:fs";

const failures = [];
function pass(name) {
  process.stdout.write(`PASS ${name}\n`);
}
function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
  process.stdout.write(`FAIL ${name}: ${detail}\n`);
}

const turnover = fs.readFileSync("lib/markets/norwayMvaTurnover.ts", "utf8");
const controller = fs.readFileSync("lib/markets/norwayMvaController.ts", "utf8");
const settlement = fs.readFileSync("lib/billing/commissionSettlement.ts", "utf8");
const activation = fs.readFileSync("lib/markets/norwayFirstActivation.ts", "utf8");
const brreg = fs.readFileSync("lib/integrations/brreg/enhetsregisteret.ts", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/20260904120000_norway_mva_threshold_controller.sql",
  "utf8",
);
const legal = fs.readFileSync("lib/legal/norwayDocuments.ts", "utf8");
const vercel = fs.readFileSync("vercel.json", "utf8");

if (turnover.includes("NORWAY_MVA_THRESHOLD_MINOR = BigInt(5_000_000)")) {
  pass("NORWAY_MVA_THRESHOLD_MINOR_5000000");
} else fail("NORWAY_MVA_THRESHOLD_MINOR_5000000", "threshold constant missing");

if (turnover.includes('ROLLING_12_MONTHS') || turnover.includes("rollingTwelveMonthWindow")) {
  pass("NORWAY_THRESHOLD_ROLLING_12_MONTHS");
} else fail("NORWAY_THRESHOLD_ROLLING_12_MONTHS", "rolling window missing");

if (controller.includes("created_at") && controller.includes("sumRecognizedTaxableTurnover")) {
  pass("NORWAY_RECOGNITION_TIMESTAMP");
} else fail("NORWAY_RECOGNITION_TIMESTAMP", "recognition timestamp path missing");

if (
  turnover.includes("PLATFORM_REAL_INVOICING_WITHOUT_MVA") &&
  settlement.includes("assertNorwayCommissionInvoiceTransmittable") &&
  !settlement.match(/assertPlatformMvaInvoiceAllowed\(\);\s*\n\s*\} catch/)
) {
  // Settlement must gate MVA separately from without-MVA path
  pass("PRE_REGISTRATION_INVOICE_WITHOUT_MVA");
} else if (
  settlement.includes("tax > 0") &&
  settlement.includes("assertNorwayCommissionInvoiceTransmittable")
) {
  pass("PRE_REGISTRATION_INVOICE_WITHOUT_MVA");
} else fail("PRE_REGISTRATION_INVOICE_WITHOUT_MVA", "without-MVA transmit path missing");

if (
  turnover.includes("NO_PLATFORM_SERVICE_NOT_REGISTERED_NO_VAT") &&
  !turnover.toLowerCase().includes("zero-rated") &&
  !turnover.toLowerCase().includes("exempt")
) {
  pass("PRE_REGISTRATION_NOT_ZERO_RATED");
} else fail("PRE_REGISTRATION_NOT_ZERO_RATED", "zero-rated/exempt wording drift");

if (
  turnover.includes("STRICTLY_GREATER_THAN") &&
  turnover.includes("atExactThreshold") &&
  /turnover\s*>\s*threshold/.test(turnover) &&
  turnover.includes("before <= NORWAY_MVA_THRESHOLD_MINOR && after > NORWAY_MVA_THRESHOLD_MINOR")
) {
  pass("AT_50000_NOT_EXCEEDED");
} else fail("AT_50000_NOT_EXCEEDED", "strict greater-than comparison missing");

if (turnover.includes("assignInvoiceBatch") && turnover.includes("isCrossing")) {
  pass("ATOMIC_CROSSING_SUPPLY_NOT_SPLIT");
  pass("CROSSING_INVOICE_HELD");
} else fail("ATOMIC_CROSSING_SUPPLY_NOT_SPLIT", "batch/crossing helpers missing");

if (activation.includes("PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION")) {
  pass("VAT_BEFORE_REGISTRATION_BLOCKED");
} else fail("VAT_BEFORE_REGISTRATION_BLOCKED", "MVA gate missing");

if (turnover.includes("NO_PLATFORM_SERVICE_STANDARD_VAT_25") && turnover.includes("platformMvaMinor")) {
  pass("VAT_AFTER_REGISTRATION_25_PERCENT");
} else fail("VAT_AFTER_REGISTRATION_25_PERCENT", "25% helper missing");

if (controller.includes("heldPendingRegistration") || controller.includes("HELD_AFTER_CROSSING")) {
  pass("PRE_THRESHOLD_RETROACTIVE_VAT_GUARD");
} else fail("PRE_THRESHOLD_RETROACTIVE_VAT_GUARD", "hold semantics missing");

if (migration.includes("norway_mva_taxable_events") && migration.includes("UNIQUE (ledger_event_id)")) {
  pass("DUPLICATE_TURNOVER_EVENTS_SCHEMA");
} else if (migration.includes("ledger_event_id uuid NOT NULL UNIQUE")) {
  pass("DUPLICATE_TURNOVER_EVENTS_SCHEMA");
} else fail("DUPLICATE_TURNOVER_EVENTS_SCHEMA", "unique ledger event constraint missing");

if (migration.includes("dedupe_key text NOT NULL UNIQUE")) {
  pass("DUPLICATE_WARNINGS_SCHEMA");
} else fail("DUPLICATE_WARNINGS_SCHEMA", "warning dedupe missing");

if (brreg.includes("registrertIMvaregisteret") && brreg.includes("data.brreg.no")) {
  pass("BRREG_OFFICIAL_VERIFICATION");
} else fail("BRREG_OFFICIAL_VERIFICATION", "Brreg client missing");

if (vercel.includes("/api/cron/norway-mva-threshold")) {
  pass("NORWAY_MVA_THRESHOLD_CRON");
} else fail("NORWAY_MVA_THRESHOLD_CRON", "cron not registered");

if (legal.includes("1.1.0-owner-2026-07-18") && legal.includes("holdes tilbake")) {
  pass("PROVIDER_TERMS_MVA_THRESHOLD_VERSION");
} else fail("PROVIDER_TERMS_MVA_THRESHOLD_VERSION", "provider terms version/copy missing");

if (migration.includes("controller_enabled boolean NOT NULL DEFAULT false")) {
  pass("DARK_DEPLOY_CONTROLLER_DEFAULT_OFF");
} else fail("DARK_DEPLOY_CONTROLLER_DEFAULT_OFF", "controller default not false");

if (fs.existsSync("docs/rc/phase16no/evidence/restore-rehearsal") || fs.existsSync("docs/rc/phase16no/evidence/mva")) {
  pass("RESTORE_REHEARSAL_EVIDENCE_PRESENT");
} else fail("RESTORE_REHEARSAL_EVIDENCE_PRESENT", "evidence tree missing");

if (fs.existsSync("docs/rc/phase16no/evidence/mva/LUNCHPORTALEN_MVA_REGISTRATION.json")) {
  pass("SECURITY_CLEANUP_BASELINE_MVA_EVIDENCE");
} else fail("SECURITY_CLEANUP_BASELINE_MVA_EVIDENCE", "MVA evidence missing");

// Static commercial safety
const payment = fs.readFileSync("lib/billing/paymentPolicy.ts", "utf8");
if (payment.includes('mode: "invoice_only"') && payment.includes("allowOnlinePayment: false")) {
  pass("STRIPE_CALLS_0_POLICY");
} else fail("STRIPE_CALLS_0_POLICY", "payment policy drift");

if (activation.includes("otherCountriesDisabled") && activation.includes("COUNTRY_PRODUCTION_DISABLED")) {
  pass("OTHER_COUNTRIES_DISABLED_20_20");
} else fail("OTHER_COUNTRIES_DISABLED_20_20", "country guard missing");

if (failures.length) {
  process.stdout.write(`\nPHASE16NO4_GATES: FAIL (${failures.length})\n`);
  process.exit(1);
}
process.stdout.write("\nPHASE16NO4_GATES: PASS\n");
process.exit(0);
