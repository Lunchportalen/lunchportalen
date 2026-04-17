/**
 * Writes repo-intelligence/auditReport.json from deterministic repo scans.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { generateAuditReport } from "./audit/auditCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "repo-intelligence");
const OUT_FILE = path.join(OUT_DIR, "auditReport.json");

function main() {
  const report = generateAuditReport();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), "utf8");
  console.log(
    `[generateAudit] Wrote ${OUT_FILE} (critical=${report.critical_blockers.length}, missing=${report.missing.length}, partial=${report.partial.length})`
  );
}

main();
