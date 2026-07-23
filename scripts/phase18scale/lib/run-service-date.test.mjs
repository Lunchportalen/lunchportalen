import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isFutureDateUtc,
  nextWeekdayUtc,
  previousWeekdayUtc,
  requirePrimaryServiceDate,
  writeRunDateManifest,
} from "./run-service-date.mjs";

const primary = nextWeekdayUtc(new Date(), 1);
assert.equal(isFutureDateUtc(primary), true);
assert.equal(isFutureDateUtc("2000-01-01"), false);

const prev = previousWeekdayUtc(primary);
assert.notEqual(prev, primary);

const tmp = path.join(os.tmpdir(), `phase18-run-date-${Date.now()}.json`);
writeRunDateManifest({ primary, secondary: nextWeekdayUtc(new Date(`${primary}T12:00:00Z`), 1), source: "test" }, tmp);
const got = requirePrimaryServiceDate({}, tmp);
assert.equal(got, primary);

assert.throws(
  () => requirePrimaryServiceDate({ PHASE18_SERVICE_DATE: "2099-01-01" }, tmp),
  /CONTRACT_MISMATCH/,
);

fs.unlinkSync(tmp);
console.log(JSON.stringify({ run_service_date_tests: "PASS", primary }));
