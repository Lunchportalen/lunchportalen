import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { assertDocsOnlyDiff } from "./safety.mjs";

/**
 * @param {string} root
 * @param {{ evidenceRelPath: string, task: string, branch?: string, title?: string, body?: string }} opts
 */
export function openDocsOnlyPr(root, opts) {
  const evidenceRelPath = opts.evidenceRelPath.replace(/\\/g, "/");
  const branch = opts.branch ?? `docs/go-operator-${opts.task}-${new Date().toISOString().slice(0, 10)}`;

  assertDocsOnlyDiff([evidenceRelPath], (rel) => fs.readFileSync(path.join(root, rel), "utf8"));

  const currentBranch = execSync("git branch --show-current", { cwd: root, encoding: "utf8" }).trim();
  if (currentBranch !== branch) {
    try {
      execSync(`git checkout -b ${branch}`, { cwd: root, stdio: "pipe" });
    } catch {
      execSync(`git checkout ${branch}`, { cwd: root, stdio: "pipe" });
    }
  }

  execSync(`git add -f ${evidenceRelPath}`, { cwd: root, stdio: "pipe" });

  const staged = execSync("git diff --cached --name-only", { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  assertDocsOnlyDiff(staged, (rel) => {
    try {
      return execSync(`git show :${rel}`, { cwd: root, encoding: "utf8" });
    } catch {
      return fs.readFileSync(path.join(root, rel), "utf8");
    }
  });

  const commitMsg = `docs(ops): GO operator evidence — ${opts.task}`;
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd: root, stdio: "pipe" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/nothing to commit/i.test(msg)) {
      throw err;
    }
  }

  let prUrl = null;
  try {
    execSync(`git push -u origin HEAD`, { cwd: root, stdio: "pipe" });
    const title = opts.title ?? `docs(ops): GO operator evidence — ${opts.task}`;
    const body =
      opts.body ??
      [
        "## Summary",
        "",
        `- Automated GO Operator evidence for \`${opts.task}\``,
        "- Docs-only",
        "- No production mutation",
        "- No SOT start",
        "- No auto-rollout",
        "",
        "## Test plan",
        "",
        "- [x] GO Operator safety gates PASS",
        "- [ ] Reviewer confirms evidence",
      ].join("\n");

    const escapedBody = body.replace(/"/g, '\\"');
    prUrl = execSync(`gh pr create --title "${title}" --body "${escapedBody}"`, {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch (err) {
    return {
      ok: false,
      branch,
      staged,
      error: err instanceof Error ? err.message : String(err),
      prUrl,
    };
  }

  return { ok: true, branch, staged, prUrl };
}
