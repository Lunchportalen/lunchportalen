import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { EXPECTED_REMOTE } from "./constants.mjs";

/**
 * @param {string} root
 */
export function runWorkspaceGate(root = process.cwd()) {
  const issues = [];

  let porcelain = "";
  try {
    porcelain = execSync("git status --porcelain=v1", { cwd: root, encoding: "utf8" }).trim();
  } catch (err) {
    issues.push(`git status failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, branch: null, head: null, remote: null };
  }

  const lines = porcelain ? porcelain.split("\n") : [];
  const dirtyTracked = lines.filter((line) => {
    const code = line.slice(0, 2);
    return code.includes("M") || code.includes("A") || code.includes("D") || code.includes("R");
  });
  if (dirtyTracked.length > 0) {
    issues.push(`tracked dirty files: ${dirtyTracked.length}`);
  }

  const merging = fs.existsSync(path.join(root, ".git", "MERGE_HEAD"));
  const rebasing = fs.existsSync(path.join(root, ".git", "rebase-merge")) || fs.existsSync(path.join(root, ".git", "rebase-apply"));
  const cherry = fs.existsSync(path.join(root, ".git", "CHERRY_PICK_HEAD"));
  if (merging || rebasing || cherry) {
    issues.push("repository in MERGING/REBASING/CHERRY-PICKING state");
  }

  let branch = "";
  let head = "";
  let remote = "";
  try {
    branch = execSync("git branch --show-current", { cwd: root, encoding: "utf8" }).trim();
    head = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim();
    remote = execSync("git remote get-url origin", { cwd: root, encoding: "utf8" }).trim();
  } catch (err) {
    issues.push(`git metadata failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (remote && remote !== EXPECTED_REMOTE) {
    issues.push(`unexpected remote: ${remote}`);
  }

  return {
    ok: issues.length === 0,
    issues,
    branch,
    head,
    remote,
    untrackedCount: lines.filter((l) => l.startsWith("??")).length,
  };
}

/**
 * @param {string} cmd
 * @param {string} root
 */
export function runCommand(cmd, root = process.cwd()) {
  const started = Date.now();
  try {
    const output = execSync(cmd, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    return { ok: true, cmd, durationMs: Date.now() - started, output: output.slice(-4000) };
  } catch (err) {
    const output = [
      err && typeof err === "object" && "stdout" in err ? String(err.stdout ?? "") : "",
      err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "",
      err instanceof Error ? err.message : String(err),
    ].join("\n");
    return { ok: false, cmd, durationMs: Date.now() - started, output: output.slice(-4000) };
  }
}
