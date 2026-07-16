#!/usr/bin/env node
/**
 * Phase 14C.4 — staging runtime preflight (health SHA + stability).
 *
 * Usage:
 *   node scripts/smoke/staging-runtime-preflight.mjs --base https://staging.app.lunchportalen.no --expected-sha <40-char>
 */
import {
  loadEnvFile,
  maskSecret,
  runStagingHealthPreflight,
} from "../test/staging-edge-access.mjs";

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
}

const base = (arg("--base") || process.env.PLAYWRIGHT_BASE_URL || "").replace(/\/$/, "");
const expectedSha = (arg("--expected-sha") || process.env.EXPECTED_RUNTIME_SHA || "").toLowerCase();
const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env"), ...process.env };

if (!base) {
  console.error("FAIL: --base required");
  process.exit(1);
}

try {
  const result = await runStagingHealthPreflight(base, expectedSha, env);
  console.log(`PASS: staging runtime preflight base=${result.baseUrl} sha=${result.version}`);
  console.log(`bypass=${maskSecret(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? env.VERCEL_PROTECTION_BYPASS)}`);
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exit(1);
}
