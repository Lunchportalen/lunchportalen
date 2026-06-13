#!/usr/bin/env node
/**
 * PR scope per required check — git diff base...head (suspend-rpc pattern).
 * Exit 0 + touched=true when check paths changed; exit 2 + touched=false when not.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathMatchesAnyGitHubFilter } from "./github-path-filter.mjs";
import { REQUIRED_CHECK_PATH_CONFIG } from "./required-check-path-patterns.mjs";

/**
 * @param {string} base
 * @param {string} head
 * @param {{ cwd?: string, fetch?: boolean }} [options]
 * @returns {string[]}
 */
export function listPullRequestChangedFiles(base, head, options = {}) {
  const { cwd = process.cwd(), fetch = true } = options;

  if (!base?.trim() || !head?.trim()) {
    throw new Error("listPullRequestChangedFiles: base and head SHAs are required");
  }

  if (fetch) {
    execFileSync("git", ["fetch", "--no-tags", "origin", base, head], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const runDiff = (range) =>
    execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", range],
      { cwd, encoding: "utf8" },
    ).trim();

  let raw = "";
  try {
    raw = runDiff(`${base}...${head}`);
  } catch {
    try {
      raw = runDiff(`${base}..${head}`);
    } catch {
      return [];
    }
  }

  return raw ? raw.split("\n").filter(Boolean) : [];
}

/**
 * @param {string[]} changedFiles
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function isCheckPathTouched(changedFiles, patterns) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  return files.some((file) => pathMatchesAnyGitHubFilter(file, patterns));
}

/**
 * @param {string[]} changedFiles
 * @returns {Record<string, { touched: boolean, matched: string[] }>}
 */
export function detectRequiredCheckScopeFromChanged(changedFiles) {
  /** @type {Record<string, { touched: boolean, matched: string[] }>} */
  const result = {};

  for (const [checkKey, config] of Object.entries(REQUIRED_CHECK_PATH_CONFIG)) {
    const matched = changedFiles.filter((file) =>
      pathMatchesAnyGitHubFilter(file, config.paths),
    );
    result[checkKey] = {
      touched: matched.length > 0,
      matched,
    };
  }

  return result;
}

/**
 * @param {string} base
 * @param {string} head
 * @param {{ cwd?: string, fetch?: boolean }} [options]
 * @returns {Record<string, { touched: boolean, matched: string[] }>}
 */
export function detectRequiredCheckScope(base, head, options = {}) {
  const changed = listPullRequestChangedFiles(base, head, options);
  return detectRequiredCheckScopeFromChanged(changed);
}

/**
 * @param {Record<string, { touched: boolean }>} scope
 * @param {string} [githubOutputPath]
 */
export function writeScopeToGitHubOutput(scope, githubOutputPath) {
  if (!githubOutputPath) {
    return;
  }

  for (const [checkKey, value] of Object.entries(scope)) {
    appendFileSync(
      githubOutputPath,
      `${checkKey}_touched=${value.touched ? "true" : "false"}\n`,
      "utf8",
    );
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has("--json");
  const githubOutput = process.env.GITHUB_OUTPUT ?? "";

  const event = String(process.env.GITHUB_EVENT_NAME ?? "").trim();
  if (event && event !== "pull_request") {
    const empty = Object.fromEntries(
      Object.keys(REQUIRED_CHECK_PATH_CONFIG).map((key) => [key, { touched: false, matched: [] }]),
    );
    if (asJson) {
      console.log(JSON.stringify(empty, null, 2));
      process.exit(0);
    }
    writeScopeToGitHubOutput(
      Object.fromEntries(Object.entries(empty).map(([k, v]) => [k, { touched: v.touched }])),
      githubOutput || undefined,
    );
    process.exit(0);
  }

  const singleCheck = process.env.REQUIRED_CHECK_KEY ?? "";
  const base = process.env.GATE_DIFF_BASE ?? process.env.GITHUB_BASE_SHA ?? "";
  const head = process.env.GATE_DIFF_HEAD ?? process.env.GITHUB_HEAD_SHA ?? "";
  const scope = detectRequiredCheckScope(base, head);

  if (asJson) {
    console.log(JSON.stringify(scope, null, 2));
    process.exit(0);
  }

  if (githubOutput) {
    writeScopeToGitHubOutput(scope, githubOutput);
    for (const [checkKey, value] of Object.entries(scope)) {
      console.log(
        `required-check-scope ${checkKey} touched=${value.touched} matched=${value.matched.length}`,
      );
    }
    process.exit(0);
  }

  if (singleCheck) {
    const entry = scope[singleCheck];
    if (!entry) {
      console.error(`Unknown REQUIRED_CHECK_KEY: ${singleCheck}`);
      process.exit(1);
    }
    if (entry.touched) {
      console.log(`required-check-scope ${singleCheck} touched=true matched=${entry.matched.length}`);
      entry.matched.forEach((file) => console.log(`  ${file}`));
      process.exit(0);
    }
    console.log(`required-check-scope ${singleCheck} touched=false`);
    process.exit(2);
  }

  console.error("Usage: detect-required-check-scope.mjs [--json] (set GATE_DIFF_BASE/HEAD or GITHUB_* SHAs)");
  process.exit(1);
}

const isMain = process.argv[1]?.includes("detect-required-check-scope.mjs");
if (isMain) {
  main();
}
