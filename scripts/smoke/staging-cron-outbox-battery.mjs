#!/usr/bin/env node
/**
 * Phase 14C.4 — live cron/outbox auth battery (staging only).
 */
import {
  loadEnvFile,
  maskSecret,
  stagingFetch,
  assertStagingTarget,
} from "../test/staging-edge-access.mjs";

const base = (process.argv[2] || process.env.STAGING_BASE_URL || "https://staging.app.lunchportalen.no").replace(
  /\/$/,
  "",
);
assertStagingTarget(base);

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env"), ...process.env };
const cronSecret = String(env.CRON_SECRET || env.LP_SMOKE_CRON_SECRET || "").trim();

const JOBS = [
  { method: "GET", path: "/api/cron/daily-order-summary?dryRun=1", name: "daily-order-summary" },
  { method: "GET", path: "/api/cron/outbox?dryRun=1", name: "outbox" },
  { method: "GET", path: "/api/cron/invoices/generate?dryRun=1", name: "provider-invoice-generate" },
  { method: "GET", path: "/api/cron/commission-settlement?dryRun=1", name: "commission-settlement" },
  { method: "GET", path: "/api/cron/week-scheduler?dryRun=1", name: "week-scheduler" },
  { method: "GET", path: "/api/cron/meal-learning", name: "meal-learning" },
];

async function hit(job, mode) {
  const headers = {};
  if (mode === "wrong") headers.authorization = "Bearer wrong-cron-secret-value";
  if (mode === "valid" && cronSecret) headers.authorization = `Bearer ${cronSecret}`;
  const res = await stagingFetch(base, job.path, { method: job.method, headers }, env);
  const text = await res.text();
  return { status: res.status, snippet: text.slice(0, 100) };
}

let failures = 0;
let unauthorizedSuccess = 0;
let wrongSuccess = 0;
let validOk = 0;

for (const job of JOBS) {
  const bare = await hit(job, "none");
  if (bare.status === 200) {
    console.error(`P0 ${job.name} no-auth → 200`);
    unauthorizedSuccess += 1;
    failures += 1;
  } else if (bare.status === 401 || bare.status === 403 || bare.status === 405) {
    console.log(`OK ${job.name} no-auth → ${bare.status}`);
  } else {
    console.error(`WARN ${job.name} no-auth → ${bare.status}`);
    failures += 1;
  }

  const wrong = await hit(job, "wrong");
  if (wrong.status === 200) {
    console.error(`P0 ${job.name} wrong-auth → 200`);
    wrongSuccess += 1;
    failures += 1;
  } else if (wrong.status === 401 || wrong.status === 403 || wrong.status === 405) {
    console.log(`OK ${job.name} wrong-auth → ${wrong.status}`);
  }

  if (!cronSecret) {
    console.error(`SKIP ${job.name} valid-auth: CRON_SECRET missing`);
    failures += 1;
    continue;
  }

  const ok = await hit(job, "valid");
  if (ok.status >= 200 && ok.status < 300) {
    validOk += 1;
    console.log(`OK ${job.name} valid-auth → ${ok.status}`);
    const dup = await hit(job, "valid");
    console.log(`  duplicate → ${dup.status}`);
  } else if (ok.status === 401 || ok.status === 403) {
    console.error(`FAIL ${job.name} valid-auth → ${ok.status} (check staging CRON_SECRET)`);
    failures += 1;
  } else {
    console.log(`OK ${job.name} valid-auth → ${ok.status} (dry-run/boundary)`);
    validOk += 1;
  }
}

console.log(
  JSON.stringify(
    {
      jobs: JOBS.length,
      unauthorizedSuccess,
      wrongSuccess,
      validOk,
      cronSecret: maskSecret(cronSecret),
    },
    null,
    2,
  ),
);

if (unauthorizedSuccess > 0) process.exit(2);
process.exit(failures ? 1 : 0);
