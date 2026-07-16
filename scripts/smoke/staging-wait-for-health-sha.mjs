#!/usr/bin/env node
import { loadEnvFile, waitForStagingHealthSha } from "../test/staging-edge-access.mjs";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
}

const base = (arg("--base") || process.env.PLAYWRIGHT_BASE_URL || "").replace(/\/$/, "");
const expectedSha = (arg("--expected-sha") || process.env.EXPECTED_RUNTIME_SHA || "").toLowerCase();
const maxWaitMs = Number(arg("--max-wait-ms") || process.env.STAGING_HEALTH_WAIT_MS || 20 * 60 * 1000);
const intervalMs = Number(arg("--interval-ms") || process.env.STAGING_HEALTH_INTERVAL_MS || 15_000);
const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env"), ...process.env };

if (!base || !expectedSha) {
  console.error("FAIL: --base and --expected-sha required");
  process.exit(1);
}

try {
  const result = await waitForStagingHealthSha(base, expectedSha, env, { maxWaitMs, intervalMs });
  console.log(
    `PASS: staging health SHA ready sha=${result.version} attempts=${result.attempts} waitedMs=${result.waitedMs}`,
  );
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exit(1);
}
