#!/usr/bin/env node
import fs from "node:fs";

const align = JSON.parse(
  fs.readFileSync("docs/rc/phase18scale/evidence/ensure-menu-path-price-alignment.json", "utf8"),
);
const dates = JSON.parse(
  fs.readFileSync("docs/rc/phase18scale/evidence/phase18-run-date-manifest.json", "utf8"),
);
const menus = fs.existsSync("docs/rc/phase18scale/evidence/ensure-published-menus.json")
  ? JSON.parse(fs.readFileSync("docs/rc/phase18scale/evidence/ensure-published-menus.json", "utf8"))
  : null;
const out = {
  job: "synthetic-seed-reconcile",
  FULL_SEED_RERUN: "NO",
  CLOUD_COMPANY_MENU_PATH_PREFLIGHT: align.CLOUD_COMPANY_MENU_PATH_PREFLIGHT,
  PHASE18_PRIMARY_SERVICE_DATE: dates.PHASE18_PRIMARY_SERVICE_DATE,
  PHASE18_SECONDARY_SERVICE_DATE: dates.PHASE18_SECONDARY_SERVICE_DATE,
  menus_ok: menus?.menus_ok ?? null,
  menus_fail: menus?.menus_fail ?? null,
  stamped_at: new Date().toISOString(),
};
fs.mkdirSync("docs/rc/phase18scale/evidence", { recursive: true });
fs.writeFileSync(
  "docs/rc/phase18scale/evidence/synthetic-seed-reconcile.json",
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out, null, 2));
