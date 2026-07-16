#!/usr/bin/env node
/**
 * Export reviewer-ready evidence pack skeletons per country.
 * Does NOT create or imply human APPROVED statuses.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];

function shaOf(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const headSha = process.env.GITHUB_SHA || process.env.GIT_SHA || "LOCAL";
const outDir = join(root, "docs/rc/evidence/phase15g1");
mkdirSync(outDir, { recursive: true });

const migFoundation = join(root, "supabase/migrations/20260828120000_global_21_tax_legal_foundation.sql");
const mig15g1 = join(root, "supabase/migrations/20260829120000_global_15g1_evidence_jurisdictions_review.sql");

const index = {
  phase: "15G.1",
  releaseSha: headSha,
  generatedAt: new Date().toISOString(),
  migrationChecksums: {
    "20260828120000_global_21_tax_legal_foundation.sql": shaOf(migFoundation),
    "20260829120000_global_15g1_evidence_jurisdictions_review.sql": shaOf(mig15g1),
  },
  approvalCounts: {
    TAX_APPROVED: 0,
    LEGAL_APPROVED: 0,
    INVOICE_APPROVED: 0,
    E_INVOICE_APPROVED_OR_NOT_APPLICABLE: 1, // US N/A only in registry
    PRIVACY_APPROVED: 0,
    LOCALIZATION_APPROVED: 0,
  },
  note: "Counts are honest zeros except US e-invoice NOT_APPLICABLE. RESEARCHED ≠ APPROVED.",
  countries: [],
};

for (const country of COUNTRIES) {
  const pack = {
    country_code: country,
    release_sha: headSha,
    official_source_inventory: "See lib/tax/packs/countryTaxPacks.ts + tax_source_records seeds",
    tax_matrix: "RESEARCHED candidates only — resolver fail-closed until APPROVED",
    jurisdiction_coverage:
      country === "US"
        ? "51/51 classified BLOCKED_MISSING_EVIDENCE"
        : country === "CA"
          ? "13/13 classified BLOCKED_MISSING_EVIDENCE (GST/HST bps researched from CRA)"
          : "country-level scaffold",
    marketplace_model: "DRAFT disclosed_agent / provider invoice / 5% platform commission",
    invoice_requirements: "RESEARCHED / STUB adapters — no fake legal invoice issuance",
    e_invoice_requirements: country === "US" ? "NOT_APPLICABLE" : "RESEARCHED stub",
    legal_documents: "DRAFT stubs for 15 document types × locales — not LEGAL_APPROVED",
    privacy_documents: "DRAFT — not PRIVACY_APPROVED",
    localization_report: "Machine stubs only; native approval required",
    test_evidence: "tests/tax/phase15g1GlobalCompletion.test.ts",
    migration_checksums: index.migrationChecksums,
    unresolved_issues: [
      "Human tax approval missing",
      "Human legal/native approval missing",
      "Staging Golden Path not run",
      country === "US" || country === "CA" ? "Subdivision launch coverage blocked" : "National food/catering rate confirmation pending primary-source review",
    ],
  };
  const file = join(outDir, `${country}.evidence.json`);
  writeFileSync(file, JSON.stringify(pack, null, 2) + "\n", "utf8");
  index.countries.push({ country, file: `docs/rc/evidence/phase15g1/${country}.evidence.json` });
}

writeFileSync(join(outDir, "INDEX.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`Wrote ${COUNTRIES.length} evidence packs → ${outDir}`);
console.log(JSON.stringify(index.approvalCounts, null, 2));
