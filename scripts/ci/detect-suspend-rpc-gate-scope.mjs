#!/usr/bin/env node
/**
 * PR scope for suspend-rpc-authz required check.
 * Relevant when diff touches supabase/** or lib/admin/** (RPC wiring surface).
 */
import { execFileSync } from "node:child_process";

export const SUSPEND_RPC_GATE_PREFIXES = ["supabase/", "lib/admin/"];

/**
 * @param {string[]} changedFiles
 * @returns {boolean}
 */
export function isSuspendRpcGateRelevant(changedFiles) {
  const files = Array.isArray(changedFiles) ? changedFiles : [];
  return files.some((file) =>
    SUSPEND_RPC_GATE_PREFIXES.some((prefix) => String(file).startsWith(prefix)),
  );
}

/**
 * @param {string} base
 * @param {string} head
 * @param {{ cwd?: string, fetch?: boolean }} [options]
 * @returns {{ relevant: boolean, changed: string[] }}
 */
export function detectSuspendRpcGateScope(base, head, options = {}) {
  const { cwd = process.cwd(), fetch = true } = options;

  if (!base?.trim() || !head?.trim()) {
    throw new Error("detectSuspendRpcGateScope: base and head SHAs are required");
  }

  if (fetch) {
    execFileSync("git", ["fetch", "--no-tags", "origin", base, head], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const diffArgs = (range) =>
    execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMR", range, "--", "supabase/", "lib/admin/"],
      { cwd, encoding: "utf8" },
    ).trim();

  let raw = "";
  try {
    raw = diffArgs(`${base}...${head}`);
  } catch {
    raw = diffArgs(`${base}..${head}`);
  }

  const changed = raw ? raw.split("\n").filter(Boolean) : [];
  return { relevant: isSuspendRpcGateRelevant(changed), changed };
}

function main() {
  const event = String(process.env.GITHUB_EVENT_NAME ?? "").trim();
  if (event !== "pull_request") {
    console.log("suspend-rpc-gate-scope relevant=true reason=non_pr_event");
    process.exit(0);
  }

  const base = process.env.GATE_DIFF_BASE ?? process.env.GITHUB_BASE_SHA ?? "";
  const head = process.env.GATE_DIFF_HEAD ?? process.env.GITHUB_HEAD_SHA ?? "";
  const result = detectSuspendRpcGateScope(base, head);

  if (result.relevant) {
    console.log(`suspend-rpc-gate-scope relevant=true changed=${result.changed.length}`);
    result.changed.forEach((f) => console.log(`  ${f}`));
    process.exit(0);
  }

  console.log("suspend-rpc-gate-scope relevant=false reason=no_supabase_or_lib_admin_changes");
  process.exit(2);
}

const isMain = process.argv[1]?.includes("detect-suspend-rpc-gate-scope.mjs");
if (isMain) {
  main();
}
