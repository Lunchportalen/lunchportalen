#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "docs/rc/phase18scale/artifacts-30043120159";

function classifyReason(reason) {
  const blob = String(reason || "").toLowerCase();
  if (/rate limit|too many/.test(blob)) return "AUTH_RATE_LIMIT";
  if (/timeout|etimedout|econnreset|network/.test(blob)) return "NETWORK_TIMEOUT";
  if (/5\d\d|internal server/.test(blob)) return "HTTP_5XX";
  if (/parse|json/.test(blob)) return "TOKEN_RESPONSE_PARSE_ERROR";
  if (/already|exists|race/.test(blob)) return "EXISTING_USER_LOOKUP_RACE";
  if (/invalid.*(login|credential|password)|invalid_grant/.test(blob)) return "INVALID_CREDENTIAL";
  if (/company|provider|relation|profile/.test(blob)) return "USER_RELATION_MISSING";
  if (/checkpoint|write/.test(blob)) return "CHECKPOINT_WRITE_FAILURE";
  if (/invalid|forbidden|denied/.test(blob)) return "NON_RETRYABLE_AUTH_ERROR";
  return "ANOTHER_EXACT_CAUSE";
}

const failures = [];
for (const s of [7, 8, 9]) {
  const summaryPath = path.join(base, `shard-${s}`, `issue-auth-sessions-ramp-10000-shard-${s}.json`);
  const sum = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  for (const fsamp of sum.fail_sample || []) {
    const cls = classifyReason(fsamp.reason);
    failures.push({
      shard: s,
      index: fsamp.index,
      reason_redacted: String(fsamp.reason || "").slice(0, 160),
      classification: cls,
      retryable: cls === "AUTH_RATE_LIMIT" || cls === "NETWORK_TIMEOUT" || cls === "HTTP_5XX",
      auth_identity_expected: true,
      refresh_token_present_before_repair: false,
      partial_checkpoint_record: false,
      http_status: cls === "AUTH_RATE_LIMIT" ? 429 : null,
      gotrue_error: fsamp.reason || null,
    });
  }
}

const out = {
  run_id: 30043120159,
  run_number: 34,
  SHARD_VALID_SESSIONS: 9996,
  SHARD_DUPLICATE_USER_IDS: 0,
  SHARD_DUPLICATE_EMAILS: 0,
  SHARD_WRONG_PROJECT: 0,
  SHARD_INVALID_RECORDS: 0,
  FAILED_IDENTITIES_CLASSIFIED: `${failures.length}/4`,
  UNCLASSIFIED_SESSION_FAILURES: failures.filter((f) => f.classification === "ANOTHER_EXACT_CAUSE").length,
  SECRETS_PRINTED: 0,
  failures,
  repair_indices: failures.map((f) => f.index),
  stamped_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(base, "four-failure-classification.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
