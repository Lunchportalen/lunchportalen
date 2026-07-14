#!/usr/bin/env node
/**
 * Fail-closed RC orchestrator core — testable step runner.
 * Used by phase13-21-country-rc-proof.mjs and behavior tests.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * @typedef {Object} StepResult
 * @property {string} id
 * @property {string} label
 * @property {string} cmd
 * @property {boolean} pass
 * @property {number} ms
 * @property {number|null} exitCode
 * @property {string|null} signal
 * @property {boolean} timedOut
 */

/**
 * @typedef {Object} RunStepOptions
 * @property {Record<string, string|undefined>} [env]
 * @property {boolean} [rcMode]
 * @property {boolean} [productionNodeEnv]
 * @property {number} [timeoutMs]
 * @property {string} [cwd]
 * @property {string} [requiredArtifact]
 */

/**
 * @param {string} id
 * @param {string} label
 * @param {string} cmd
 * @param {RunStepOptions} [opts]
 * @returns {StepResult}
 */
export function runStepCore(id, label, cmd, opts = {}) {
  const started = Date.now();
  const env = { ...process.env, ...(opts.env ?? {}) };
  if (opts.rcMode) env.RC_MODE = "true";
  if (opts.productionNodeEnv) env.NODE_ENV = "production";

  const r = spawnSync(cmd, {
    shell: true,
    stdio: "inherit",
    env,
    cwd: opts.cwd ?? process.cwd(),
    timeout: opts.timeoutMs ?? 0,
  });

  const ms = Date.now() - started;
  const timedOut = r.error?.code === "ETIMEDOUT";
  const exitCode = r.status ?? null;
  const signal = r.signal ?? null;
  let pass = exitCode === 0 && !timedOut && signal == null;

  if (pass && opts.requiredArtifact) {
    const artifactPath = path.isAbsolute(opts.requiredArtifact)
      ? opts.requiredArtifact
      : path.join(opts.cwd ?? process.cwd(), opts.requiredArtifact);
    if (!fs.existsSync(artifactPath)) {
      pass = false;
    }
  }

  return {
    id,
    label,
    cmd,
    pass,
    ms,
    exitCode,
    signal,
    timedOut,
  };
}

/**
 * @param {StepResult[]} results
 * @returns {{ failures: string[], pass: boolean }}
 */
export function summarizeResults(results) {
  const failures = [];
  for (const r of results) {
    if (r.pass) continue;
    if (r.timedOut) failures.push(`${r.label} (timeout after ${r.ms}ms)`);
    else if (r.signal) failures.push(`${r.label} (signal ${r.signal})`);
    else failures.push(`${r.label} (exit ${r.exitCode ?? "?"}, ${r.ms}ms)`);
  }
  return { failures, pass: failures.length === 0 };
}

/**
 * @param {boolean} localOnly
 * @param {boolean} allPassed
 * @returns {string}
 */
export function finalBanner(localOnly, allPassed) {
  if (!allPassed) {
    return localOnly
      ? "PHASE 13 LOCAL GATES FAILED"
      : "PHASE 13 STAGING RC PROOF FAILED";
  }
  return localOnly
    ? "PHASE 13 LOCAL GATES: PASS (staging-integration hoppet over med --local-only)"
    : "PHASE 13 STAGING RC PROOF: PASS";
}

/**
 * Fail-closed process exit code from results.
 * @param {StepResult[]} results
 * @param {string[]} extraFailures
 * @returns {number}
 */
export function exitCodeForResults(results, extraFailures = []) {
  const { pass } = summarizeResults(results);
  return pass && extraFailures.length === 0 ? 0 : 1;
}
