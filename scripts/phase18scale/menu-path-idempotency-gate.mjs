#!/usr/bin/env node
/**
 * Menu-path alignment idempotency gate.
 * Exit 0 = already clean (skip second repair)
 * Exit 3 = need second repair
 * Exit 2 = fail after second repair verification (caller runs repair then re-invokes with VERIFY=1)
 */
import fs from "node:fs";

const reportPath = "docs/rc/phase18scale/evidence/ensure-menu-path-price-alignment.json";
const outPath = "docs/rc/phase18scale/evidence/ensure-menu-path-price-alignment-idempotency.json";
const mode = String(process.env.PHASE18_IDEM_MODE || "check"); // check | verify

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const verify = report.verify || {};
const clean =
  report.CLOUD_MENU_PATH_PRICE_ALIGNMENT === "PASS" &&
  Number(report.items_repaired || 0) === 0 &&
  Number(report.products_repaired || 0) === 0 &&
  Number(verify.missing_msd || 0) === 0 &&
  Number(verify.missing_msdi || 0) === 0 &&
  Number(verify.price_mismatch || 0) === 0 &&
  Number(verify.provider_mismatch || 0) === 0 &&
  Number(verify.valid_warm_path || 0) === Number(verify.companies || 0);

if (mode === "check" && clean) {
  const out = {
    MENU_PATH_REPAIR_IDEMPOTENCY: "PASS",
    SKIPPED_SECOND_FULL_REPAIR: "YES",
    items_repaired: 0,
    products_repaired: 0,
    verify,
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (mode === "check") {
  console.log(JSON.stringify({ SKIPPED_SECOND_FULL_REPAIR: "NO", reason: "first_pass_not_clean" }));
  process.exit(3);
}

const out = {
  MENU_PATH_REPAIR_IDEMPOTENCY: clean ? "PASS" : "FAIL",
  SKIPPED_SECOND_FULL_REPAIR: "NO",
  items_repaired: report.items_repaired || 0,
  products_repaired: report.products_repaired || 0,
  verify,
  stamped_at: new Date().toISOString(),
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
if (!clean) process.exit(2);
