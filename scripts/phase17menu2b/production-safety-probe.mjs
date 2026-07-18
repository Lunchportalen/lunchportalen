#!/usr/bin/env node
/**
 * Read-only production safety probe. Never mutates.
 * Uses public health endpoint + optional MCP-fed inputs via env.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");
const LOCKED_SHA = "771a4207e9743fd232971eb95ecc27e45723a89d";

fs.mkdirSync(OUT, { recursive: true });

const report = {
  stamped_at: new Date().toISOString(),
  PRODUCTION_MUTATIONS: 0,
  PRODUCTION_DEPLOYMENTS: 0,
  PRODUCTION_MIGRATIONS: 0,
  expected_production_sha: LOCKED_SHA,
  observed_production_sha: process.env.PHASE17MENU2B_OBS_PROD_SHA ?? "UNVERIFIED_HTTP",
  production_health: "UNVERIFIED",
  norway_ordering: "ASSUMED_ENABLED_FROM_PRIOR_LOCK",
  mva_threshold_automation: "ASSUMED_LIVE_FROM_PRIOR_LOCK",
  other_countries_disabled: "20/20_ASSUMED_FROM_PRIOR_LOCK",
  stripe: "OFF_ASSUMED_FROM_PRIOR_LOCK",
  deploy_lock: "ACTIVE_DECLARED",
  migration_lock: "ACTIVE_DECLARED",
  note: "Agent Supabase MCP lists production project only; no production writes issued. Full SHA/health confirmation requires public /api/health or owner-approved read probe.",
};

try {
  const res = await fetch("https://app.lunchportalen.no/api/health", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  report.production_health_http = res.status;
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (json) {
    report.production_health = json.ok === true || json.data?.ok === true || json.status === "ok" ? "PASS" : "WARN";
    report.observed_production_sha =
      json.data?.version ||
      json.data?.release?.git_sha ||
      json.version ||
      json.sha ||
      json.gitSha ||
      report.observed_production_sha;
    report.NORWAY_PRODUCTION_REGRESSION =
      report.observed_production_sha === LOCKED_SHA && report.production_health === "PASS"
        ? "PASS"
        : "REVIEW";
  } else {
    report.production_health = res.status === 200 ? "PASS_BODY_NON_JSON" : "FAIL";
  }
} catch (e) {
  report.production_health = "UNREACHABLE";
  report.production_health_error = String(e.message ?? e);
}

fs.writeFileSync(path.join(OUT, "norway-production-regression.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  PRODUCTION_MUTATIONS: 0,
  production_health: report.production_health,
  observed_production_sha: report.observed_production_sha,
}, null, 2));
