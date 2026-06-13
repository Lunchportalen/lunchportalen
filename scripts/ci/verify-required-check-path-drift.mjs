#!/usr/bin/env node
/**
 * Drift guard: passthrough path filters must match each workflow's on.pull_request.paths.
 * Operator follow-up: promote job `required-check-path-drift` to branch-protection required.
 */
import { resolve } from "node:path";
import { loadWorkflowPullRequestPaths } from "./parse-workflow-pr-paths.mjs";
import { REQUIRED_CHECK_PATH_CONFIG } from "./required-check-path-patterns.mjs";

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
export function pathListsEqual(a, b) {
  const left = [...(a ?? [])].map((s) => s.trim()).sort();
  const right = [...(b ?? [])].map((s) => s.trim()).sort();
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

/**
 * @param {{ cwd?: string }} [options]
 * @returns {{ ok: boolean, mismatches: Array<{ check: string, workflow: string, onlyInPassthrough: string[], onlyInWorkflow: string[] }> }}
 */
export function verifyRequiredCheckPathDrift(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  /** @type {Array<{ check: string, workflow: string, onlyInPassthrough: string[], onlyInWorkflow: string[] }>} */
  const mismatches = [];

  for (const [checkKey, config] of Object.entries(REQUIRED_CHECK_PATH_CONFIG)) {
    const fromWorkflow = loadWorkflowPullRequestPaths(resolve(cwd, config.workflow), { cwd });
    const fromPassthrough = config.paths;

    if (pathListsEqual(fromWorkflow, fromPassthrough)) {
      continue;
    }

    const workflowSet = new Set(fromWorkflow);
    const passthroughSet = new Set(fromPassthrough);
    mismatches.push({
      check: checkKey,
      workflow: config.workflow,
      onlyInPassthrough: fromPassthrough.filter((p) => !workflowSet.has(p)),
      onlyInWorkflow: fromWorkflow.filter((p) => !passthroughSet.has(p)),
    });
  }

  return { ok: mismatches.length === 0, mismatches };
}

function main() {
  const result = verifyRequiredCheckPathDrift();

  if (result.ok) {
    console.log("required-check-path-drift OK — passthrough filters match workflow on.pull_request.paths");
    console.log(
      "operator-follow-up: promote workflow job `required-check-path-drift` to branch-protection required when ready",
    );
    process.exit(0);
  }

  console.error("required-check-path-drift FAIL — update scripts/ci/required-check-path-patterns.mjs or workflow paths");
  for (const mismatch of result.mismatches) {
    console.error(`\n[${mismatch.check}] ${mismatch.workflow}`);
    if (mismatch.onlyInWorkflow.length) {
      console.error(`  only in workflow: ${mismatch.onlyInWorkflow.join(", ")}`);
    }
    if (mismatch.onlyInPassthrough.length) {
      console.error(`  only in passthrough: ${mismatch.onlyInPassthrough.join(", ")}`);
    }
  }
  process.exit(1);
}

const isMain = process.argv[1]?.includes("verify-required-check-path-drift.mjs");
if (isMain) {
  main();
}
