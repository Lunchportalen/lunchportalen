#!/usr/bin/env node
/**
 * Generate the durable Phase 18 run-date manifest once per workflow run.
 * Never prints secrets. Fail closed if an explicit date is not in the future.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nextWeekdayUtc,
  writeRunDateManifest,
  RUN_DATE_MANIFEST_PATH,
} from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function main() {
  const explicit =
    process.env.PHASE18_PRIMARY_SERVICE_DATE ||
    process.env.PHASE18_RUN_SERVICE_DATE ||
    process.env.PHASE18_SERVICE_DATE ||
    "";
  const primary = explicit || nextWeekdayUtc(new Date(), 1);
  const secondaryExplicit = process.env.PHASE18_SECONDARY_SERVICE_DATE || "";
  const wantSecondary = ["1", "true", "yes"].includes(
    String(process.env.PHASE18_REQUIRE_SECONDARY_SERVICE_DATE || "1").toLowerCase(),
  );
  const secondary =
    secondaryExplicit ||
    (wantSecondary ? nextWeekdayUtc(new Date(`${primary}T12:00:00.000Z`), 1) : null);

  const manifest = writeRunDateManifest({
    primary,
    secondary,
    source: "write-run-date-manifest.mjs",
  });

  // Keep synthetic-distribution.json from poisoning later jobs with stale dates.
  const distPath = path.join(OUT, "synthetic-distribution.json");
  if (fs.existsSync(distPath)) {
    try {
      const dist = JSON.parse(fs.readFileSync(distPath, "utf8"));
      dist.service_date = primary;
      dist.PHASE18_PRIMARY_SERVICE_DATE = primary;
      dist.PHASE18_SECONDARY_SERVICE_DATE = secondary;
      dist.service_dates = manifest.service_dates;
      dist.run_date_contract = "bound";
      fs.writeFileSync(distPath, JSON.stringify(dist, null, 2));
    } catch {
      /* ignore corrupt prior dist */
    }
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      distPath,
      JSON.stringify(
        {
          phase: "18SCALE",
          service_date: primary,
          PHASE18_PRIMARY_SERVICE_DATE: primary,
          PHASE18_SECONDARY_SERVICE_DATE: secondary,
          service_dates: manifest.service_dates,
          run_date_contract: "bound",
        },
        null,
        2,
      ),
    );
  }

  // Export for GITHUB_ENV consumers.
  const lines = [
    `PHASE18_RUN_SERVICE_DATE=${primary}`,
    `PHASE18_PRIMARY_SERVICE_DATE=${primary}`,
    `PHASE18_SERVICE_DATE=${primary}`,
  ];
  if (secondary) lines.push(`PHASE18_SECONDARY_SERVICE_DATE=${secondary}`);
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${lines.join("\n")}\n`);
  }
  console.log(
    JSON.stringify(
      {
        phase: "18SCALE",
        RUN_DATE_MANIFEST_PRESENT: "YES",
        RUN_DATE_IS_FUTURE: "YES",
        PHASE18_RUN_SERVICE_DATE: primary,
        PHASE18_PRIMARY_SERVICE_DATE: primary,
        PHASE18_SECONDARY_SERVICE_DATE: secondary,
        path: path.basename(RUN_DATE_MANIFEST_PATH),
      },
      null,
      2,
    ),
  );
}

main();
