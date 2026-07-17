#!/usr/bin/env node
/**
 * Phase 16NO — record written accountant confirmation as evidence.
 * Fail-closed: does not enable production flags or migrate anything.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const evidenceIdx = args.indexOf("--evidence");
const evidenceRel =
  evidenceIdx >= 0 && args[evidenceIdx + 1]
    ? args[evidenceIdx + 1]
    : "docs/evidence/accountant/ACCOUNTANT_NORWAY_TAX_CONFIRMATION.md";

const evidencePath = path.resolve(root, evidenceRel);
const statusPath = path.resolve(root, "docs/rc/phase16no/accountant-confirmation-status.json");
const shaPath = path.resolve(root, "docs/evidence/accountant/ACCOUNTANT_NORWAY_TAX_CONFIRMATION.sha256");

const REQUIRED_AFFIRMATIONS = [
  { id: "provider_seller", re: /catering|provider|leverand[oø]r|selger/i },
  { id: "food_mva_15", re: /15\s*%/i },
  { id: "commission_5", re: /5\s*%/i },
  { id: "platform_mva_25", re: /25\s*%/i },
  { id: "no_end_customer_invoice", re: /ikke\s+fakturerer\s+sluttkunden|does\s+not\s+invoice|ikke\s+mottar\s+betaling|does\s+not\s+collect/i },
  { id: "confirmed_marker", re: /\bCONFIRMED\b|bekreftet|godkjent|confirmed/i },
];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!existsSync(evidencePath)) {
  fail(`Evidence file missing: ${evidenceRel}`);
}

const base = path.basename(evidencePath);
if (/PENDING/i.test(base)) {
  fail("Refusing PENDING placeholder. Store real accountant evidence first.");
}

const text = readFileSync(evidencePath, "utf8");
if (text.trim().length < 80) {
  fail("Evidence file too short to be a written confirmation.");
}
if (/PENDING|REQUIRED \(not confirmed\)|Do not rename this file/i.test(text) && /placeholder/i.test(text)) {
  fail("Evidence still looks like the PENDING placeholder.");
}

const missing = REQUIRED_AFFIRMATIONS.filter((a) => !a.re.test(text)).map((a) => a.id);
if (missing.length) {
  fail(`Evidence does not clearly affirm required points: ${missing.join(", ")}`);
}

const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
mkdirSync(path.dirname(shaPath), { recursive: true });
writeFileSync(shaPath, `${sha256}  ${path.relative(root, evidencePath).replace(/\\/g, "/")}\n`, "utf8");

const status = {
  ACCOUNTANT_NORWAY_TAX_CONFIRMATION: "CONFIRMED",
  OWNER_NORWAY_TAX_MODEL_CONFIRMATION: "CONFIRMED",
  recordedAt: new Date().toISOString(),
  evidenceFound: true,
  evidencePath: path.relative(root, evidencePath).replace(/\\/g, "/"),
  sha256,
  packet: "docs/rc/PHASE16NO-ACCOUNTANT-CONFIRMATION-PACKET.md",
  note:
    "Evidence recorded only. Production env flags and DB accountant_tax_confirmation must still be set by authorised operator after review. No ordering/commission auto-enabled.",
  blocks_until_operator_enable: [
    "COUNTRY_NO_ORDERING_ENABLED",
    "COUNTRY_NO_PLATFORM_COMMISSION_ENABLED",
    "COUNTRY_NO_INVOICE_ONLY_ENABLED",
    "NORWAY_LIVE",
  ],
};

mkdirSync(path.dirname(statusPath), { recursive: true });
writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");

console.log("PASS: accountant evidence recorded");
console.log(`evidence=${status.evidencePath}`);
console.log(`sha256=${sha256}`);
console.log("NEXT: authorised operator may set ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED in env/DB after review.");
console.log("STILL BLOCKED: production ordering / commission until flags explicitly enabled.");
