#!/usr/bin/env node
/**
 * Deterministic autofix for Phase 18 / launch controller failures.
 * Smallest focused change only. Never prints secrets. Never touches prod/staging refs.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const RESOLVE = path.join(ROOT, "scripts/phase18scale/resolve-cloud-target.mjs");

function sh(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function bumpPoolerRetries() {
  let src = fs.readFileSync(RESOLVE, "utf8");
  if (!src.includes("probePoolerAuthWithRetries")) {
    throw new Error("resolve-cloud-target missing probePoolerAuthWithRetries");
  }
  // Increase initial attempts 6 → 10 and connection timeout if still 30000.
  let changed = false;
  if (src.includes("attempts: 6,\n  label: \"initial\"")) {
    src = src.replace("attempts: 6,\n  label: \"initial\"", 'attempts: 10,\n  label: "initial"');
    changed = true;
  }
  if (src.includes("connectionTimeoutMillis: 30000")) {
    src = src.replace("connectionTimeoutMillis: 30000", "connectionTimeoutMillis: 45000");
    changed = true;
  }
  // Longer backoff between retries
  if (src.includes("await new Promise((r) => setTimeout(r, 1000 * attempt));")) {
    src = src.replace(
      "await new Promise((r) => setTimeout(r, 1000 * attempt));",
      "await new Promise((r) => setTimeout(r, 2500 * attempt));",
    );
    changed = true;
  }
  if (!changed) {
    console.log(JSON.stringify({ autofix: "noop", reason: "pooler_retry_already_tuned" }));
    return false;
  }
  fs.writeFileSync(RESOLVE, src);
  console.log(JSON.stringify({ autofix: "applied", file: "resolve-cloud-target.mjs", class: "NETWORK_OR_POOLER_ERROR" }));
  return true;
}

function main() {
  const errorClass = String(process.env.AUTOFIX_ERROR_CLASS || "");
  const fingerprint = String(process.env.AUTOFIX_FINGERPRINT || "");
  const runId = String(process.env.AUTOFIX_RUN_ID || "");
  console.log(JSON.stringify({ autofix_start: { errorClass, fingerprint, runId } }));

  let changed = false;
  if (errorClass === "NETWORK_OR_POOLER_ERROR" || errorClass === "RESOURCE_EXPIRATION") {
    changed = bumpPoolerRetries() || changed;
  } else if (errorClass === "RATE_LIMIT_ERROR" || errorClass === "AUTH_OR_SESSION_ERROR") {
    // Auth coverage already sharded; strengthen rate-limit pause if present.
    const proof = path.join(ROOT, "scripts/phase18scale/auth-refresh-coverage-proof.mjs");
    let src = fs.readFileSync(proof, "utf8");
    if (src.includes("rate_limit_pause_ms: 90000")) {
      src = src.replace("rate_limit_pause_ms: 90000", "rate_limit_pause_ms: 120000");
      src = src.replace("await sleep(90000);", "await sleep(120000);");
      fs.writeFileSync(proof, src);
      changed = true;
      console.log(JSON.stringify({ autofix: "applied", file: "auth-refresh-coverage-proof.mjs" }));
    } else {
      console.log(JSON.stringify({ autofix: "noop", reason: "auth_rate_limit_already_tuned" }));
    }
  } else {
    console.log(JSON.stringify({ autofix: "noop", reason: "no_deterministic_patch_for_class", errorClass }));
  }

  // Focused tests when we touched known files
  if (changed) {
    try {
      sh("node", ["scripts/phase18scale/lib/pooler-auth-errors.test.mjs"]);
      sh("node", ["scripts/phase18scale/lib/auth-refresh-shard-slice.test.mjs"]);
    } catch (e) {
      console.error(String(e?.stderr || e?.message || e));
      process.exit(2);
    }
  }

  fs.writeFileSync(
    path.join(ROOT, "docs/rc/autonomous-release/LAST-AUTOFIX.json"),
    `${JSON.stringify(
      {
        errorClass,
        fingerprint,
        runId,
        changed,
        stamped_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? "true" : "false"}\n`);
  }
}

main();
