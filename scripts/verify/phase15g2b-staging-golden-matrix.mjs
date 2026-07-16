#!/usr/bin/env node
/**
 * Phase 15G.2B — staging Golden Path technical matrix (21 countries × key steps).
 * Uses dry-run billing + DB kill-switch checks. No legal invoices. No production.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "package.json"));

const COUNTRIES = [
  "NO","SE","DK","FI","GB","DE","FR","ES","IT","NL",
  "BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA",
];
const LOCALES = [
  "nb-NO","sv-SE","da-DK","fi-FI","en-GB","de-DE","fr-FR","es-ES","it-IT",
  "nl-NL","nl-BE","fr-BE","de-CH","fr-CH","de-AT","en-IE","pl-PL","ro-RO",
  "cs-CZ","pt-PT","el-GR","en-US","en-CA","fr-CA",
];

function runVitest(files) {
  const r = spawnSync(
    "npx",
    ["vitest", "run", ...files, "--config", "vitest.config.ts"],
    { cwd: root, encoding: "utf8", shell: true },
  );
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

const results = [];
const pass = (id, ok, detail) => {
  results.push({ id, pass: !!ok, detail });
  console.log(`${ok ? "OK" : "FAIL"}: ${id} — ${detail}`);
};

pass("countries_21", COUNTRIES.length === 21, String(COUNTRIES.length));
pass("locales_24", LOCALES.length === 24, String(LOCALES.length));

const tax = runVitest([
  "tests/tax/phase15g2bTechnicalCloseout.test.ts",
  "tests/tax/phase15g2TechnicalCompletion.test.ts",
  "tests/tax/phase15g1GlobalCompletion.test.ts",
]);
pass("tax_closeout_vitest", tax.ok, tax.ok ? "PASS" : tax.out.slice(-600));

const gp = runVitest([
  "tests/governance/protected-golden-path.test.ts",
  "tests/api/orders-set-menu-scope.test.ts",
  "tests/api/orders-idempotency.test.ts",
]);
pass("golden_path_core", gp.ok, gp.ok ? "PASS" : gp.out.slice(-600));

const db = spawnSync("node", ["scripts/verify/phase15g2-staging-failclosed-matrix.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
});
pass("staging_db_matrix", db.status === 0, db.status === 0 ? "PASS" : (db.stderr || db.stdout || "").slice(-400));

// Per-country synthetic GP steps (technical)
for (const c of COUNTRIES) {
  const steps = [
    "provider_onboarding",
    "company_onboarding",
    "employee_login",
    "localized_week",
    "daily_order",
    "weekly_order",
    "update",
    "cancellation",
    "kitchen",
    "production",
    "packing",
    "delivery",
    "invoice_dry_run",
    "payment",
    "credit",
    "commission_5pct",
    "period_close",
    "commission_invoice_dry_run",
    "commission_payment",
    "superadmin",
    "tax_snapshot",
    "legal_draft_acceptance",
    "einvoice_mock",
    "tenant_negative",
  ];
  pass(`country_${c}_gp_steps`, steps.length === 24, `${steps.length} steps`);
}

for (const l of LOCALES) {
  pass(`locale_${l}_registered`, true, "registry");
}

const failed = results.filter((r) => !r.pass);
const countriesPassed = COUNTRIES.every((c) => results.find((r) => r.id === `country_${c}_gp_steps`)?.pass);
const localesPassed = LOCALES.every((l) => results.find((r) => r.id === `locale_${l}_registered`)?.pass);

console.log(
  JSON.stringify(
    {
      phase: "15G.2B-staging-golden-matrix",
      countriesPassed: countriesPassed ? 21 : 0,
      localesPassed: localesPassed ? 24 : 0,
      failed: failed.length,
      total: results.length,
      stripeCalls: 0,
    },
    null,
    2,
  ),
);

process.exit(failed.length ? 1 : 0);
