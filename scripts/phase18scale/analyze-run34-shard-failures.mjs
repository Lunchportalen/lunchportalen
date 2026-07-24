#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "docs/rc/phase18scale/artifacts-30043120159";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function loadNdjson(p) {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function redactMsg(s) {
  return String(s || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[EMAIL]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

function classify(sample) {
  const status = sample?.http_status ?? sample?.status ?? sample?.statusCode ?? null;
  const code = String(sample?.error_code || sample?.code || sample?.error || sample?.name || "");
  const msg = String(sample?.message || sample?.msg || sample?.error_description || "");
  const blob = `${code} ${msg}`.toLowerCase();
  if (status === 429 || /rate.?limit|too many/.test(blob)) return "AUTH_RATE_LIMIT";
  if (/timeout|etimedout|econnreset|fetch failed|network|enotfound/.test(blob)) {
    return "NETWORK_TIMEOUT";
  }
  if ((typeof status === "number" && status >= 500) || /internal server|502|503|504/.test(blob)) {
    return "HTTP_5XX";
  }
  if (/parse|unexpected token|invalid json/.test(blob)) return "TOKEN_RESPONSE_PARSE_ERROR";
  if (/already|exists|duplicate|race/.test(blob)) return "EXISTING_USER_LOOKUP_RACE";
  if (/invalid.*(login|credential|password)|invalid_grant/.test(blob)) return "INVALID_CREDENTIAL";
  if (/company|provider|relation|profile|location/.test(blob)) return "USER_RELATION_MISSING";
  if (/checkpoint|enospc|eacces/.test(blob)) return "CHECKPOINT_WRITE_FAILURE";
  if (typeof status === "number" && status >= 400 && status < 500) {
    return "NON_RETRYABLE_AUTH_ERROR";
  }
  return "ANOTHER_EXACT_CAUSE";
}

const report = {
  shards: [],
  failures: [],
  totals: { summary_rows: 0, reused: 0, issued_new: 0, failed: 0, ndjson_unique: 0 },
};
const allUsers = new Set();
const allEmails = new Set();

for (let s = 0; s <= 9; s++) {
  const d = path.join(base, `shard-${s}`);
  const files = walk(d);
  const summaryPath = files.find((f) => /issue-auth-sessions.*\.json$/.test(f));
  const ndPaths = files.filter((f) => /\.ndjson$/.test(f));
  const sum = summaryPath ? JSON.parse(fs.readFileSync(summaryPath, "utf8")) : null;
  let rows = [];
  for (const p of ndPaths) rows = rows.concat(loadNdjson(p));
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    if (!r.user_id || seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    uniq.push(r);
  }
  for (const r of uniq) {
    allUsers.add(r.user_id);
    allEmails.add(String(r.email || "").toLowerCase());
  }
  const failSample = Array.isArray(sum?.fail_sample) ? sum.fail_sample : [];
  report.shards.push({
    shard: s,
    files: files.map((f) => path.relative(d, f)),
    summary_rows: sum?.rows ?? null,
    unique_users: sum?.unique_users ?? null,
    unique_emails: sum?.unique_emails ?? null,
    reused: sum?.reused ?? null,
    issued_new: sum?.issued_new ?? null,
    failed: sum?.failed ?? null,
    range: sum?.range ?? null,
    shard_target: sum?.shard_target ?? null,
    ndjson_unique: uniq.length,
    fail_sample_count: failSample.length,
  });
  report.totals.summary_rows += Number(sum?.rows || 0);
  report.totals.reused += Number(sum?.reused || 0);
  report.totals.issued_new += Number(sum?.issued_new || 0);
  report.totals.failed += Number(sum?.failed || 0);
  report.totals.ndjson_unique += uniq.length;
  for (const fsamp of failSample) {
    const cls = classify(fsamp);
    report.failures.push({
      shard: s,
      index: fsamp.index ?? fsamp.employee_index ?? null,
      user_id: fsamp.user_id ?? fsamp.id ?? null,
      company_id: fsamp.company_id ?? null,
      provider_id: fsamp.provider_id ?? null,
      location_id: fsamp.location_id ?? null,
      attempts: fsamp.attempts ?? fsamp.attempt_count ?? null,
      http_status: fsamp.http_status ?? fsamp.status ?? null,
      error_code: fsamp.error_code ?? fsamp.code ?? null,
      message_redacted: redactMsg(
        fsamp.message || fsamp.msg || fsamp.error || fsamp.error_description || "",
      ).slice(0, 300),
      classification: cls,
      retryable: [
        "AUTH_RATE_LIMIT",
        "NETWORK_TIMEOUT",
        "HTTP_5XX",
        "TOKEN_RESPONSE_PARSE_ERROR",
        "EXISTING_USER_LOOKUP_RACE",
      ].includes(cls),
      raw_keys: Object.keys(fsamp || {}),
    });
  }
}

report.unique_across_ndjson = { users: allUsers.size, emails: allEmails.size };
report.FAILED_IDENTITIES_CLASSIFIED = `${report.failures.length}/4`;
fs.writeFileSync(path.join(base, "failure-classification.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
