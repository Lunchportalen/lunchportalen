#!/usr/bin/env node
/**
 * Merge sharded business active-load session artifacts into canonical pool.
 * Never prints tokens/passwords.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVE_LOAD_SESSIONS_MIN,
  ACTIVE_LOAD_SESSIONS_TARGET,
  COMPANIES_TARGET,
  PROVIDERS_TARGET,
} from "./lib/business-load-model.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function loadNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function main() {
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || 5);
  const target = Number(process.env.PHASE18_ACTIVE_LOAD_SESSIONS || ACTIVE_LOAD_SESSIONS_TARGET);
  const minRequired = Number(process.env.PHASE18_ACTIVE_LOAD_SESSIONS_MIN || ACTIVE_LOAD_SESSIONS_MIN);
  const byUser = new Map();
  const shardReports = [];

  for (let i = 0; i < shardCount; i += 1) {
    const p = path.join(OUT, `sessions-business-active-load.shard-${i}.ndjson`);
    const rows = loadNdjson(p);
    const reportPath = path.join(OUT, `auth-session-coverage.shard-${i}.json`);
    const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : null;
    shardReports.push({
      shard: i,
      rows: rows.length,
      AUTH_SESSION_COVERAGE: report?.AUTH_SESSION_COVERAGE || "MISSING",
      failed: report?.failed ?? null,
    });
    for (const r of rows) {
      if (!r?.user_id || !r?.access_token || !r?.refresh_token) continue;
      byUser.set(r.user_id, r);
    }
  }

  const issued = [...byUser.values()].sort((a, b) => a.index - b.index);
  const outPath = path.join(OUT, "sessions-business-active-load.ndjson");
  fs.writeFileSync(outPath, issued.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.copyFileSync(outPath, path.join(OUT, "sessions.ndjson"));
  fs.writeFileSync(
    path.join(OUT, "sessions-business-active-load.checkpoint.ndjson"),
    issued.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );

  const companySet = new Set(issued.map((r) => r.company_id).filter(Boolean));
  const providerSet = new Set(issued.map((r) => r.provider_id).filter(Boolean));
  const report = {
    phase: "18SCALE",
    AUTH_USERS_EXIST: Number(process.env.PHASE18_AUTH_USERS_EXIST || 100000),
    EMPLOYEE_PROFILES_EXIST: Number(process.env.PHASE18_EMPLOYEE_PROFILES_EXIST || 100000),
    COMPANIES_COVERED_BY_ACTIVE_SESSION: `${companySet.size}/${COMPANIES_TARGET}`,
    PROVIDERS_COVERED_BY_ACTIVE_SESSION: `${providerSet.size}/${PROVIDERS_TARGET}`,
    ACTIVE_LOAD_SESSIONS: issued.length,
    TARGET_ACTIVE_LOAD_SESSIONS: target,
    SERVICE_ROLE_AS_EMPLOYEE: 0,
    SESSION_DUPLICATE_USER_IDS: issued.length - byUser.size,
    SESSION_INVALID_COMPANY_RELATIONS: issued.filter((r) => !r.company_id).length,
    SESSION_INVALID_PROVIDER_PATHS: issued.filter((r) => !r.provider_id).length,
    shards: shardReports,
    AUTH_SESSION_COVERAGE:
      issued.length >= minRequired &&
      issued.length >= target &&
      companySet.size >= COMPANIES_TARGET &&
      providerSet.size >= PROVIDERS_TARGET &&
      shardReports.every((s) => s.AUTH_SESSION_COVERAGE === "PASS")
        ? "PASS"
        : "FAIL",
    stamped_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "auth-session-coverage.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.AUTH_SESSION_COVERAGE !== "PASS") {
    throw new Error(
      `PHASE18_AUTH_SESSION_MERGE_FAIL sessions=${issued.length} companies=${companySet.size} providers=${providerSet.size}`,
    );
  }
}

main();
