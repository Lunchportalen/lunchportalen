import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { assertDocsOnlyDiff, assertEvidencePathUnderDocsEvidence } from "./safety.mjs";

/**
 * @param {string} task
 * @param {string} isoDate
 * @param {string} runId
 */
export function buildPrBranchName(task, isoDate, runId) {
  const safeRunId = String(runId ?? "local").replace(/[^a-zA-Z0-9._-]/g, "-");
  return `docs/go-operator-${task}-${isoDate}-${safeRunId}`;
}

/**
 * @param {string} ghOutput
 */
export function parsePrUrl(ghOutput) {
  const trimmed = String(ghOutput ?? "").trim();
  const match = trimmed.match(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/);
  if (!match) {
    return { url: trimmed || null, number: null };
  }
  return { url: match[0], number: Number(match[1]) };
}

/**
 * @param {string} root
 * @param {string} evidenceRelPath
 */
export function validateEvidenceFile(root, evidenceRelPath) {
  const normalized = evidenceRelPath.replace(/\\/g, "/");
  assertEvidencePathUnderDocsEvidence(normalized);
  const absPath = path.join(root, normalized);
  if (!fs.existsSync(absPath)) {
    throw new Error(`GO_OPERATOR_BLOCKED: evidence file missing at ${normalized}`);
  }
  assertDocsOnlyDiff([normalized], () => fs.readFileSync(absPath, "utf8"));
  return normalized;
}

/**
 * @param {string} root
 * @param {{ evidenceRelPath: string, task: string, runId?: string, branch?: string, title?: string, body?: string, dryRun?: boolean }} opts
 */
export function openDocsOnlyPr(root, opts) {
  const evidenceRelPath = validateEvidenceFile(root, opts.evidenceRelPath);
  const isoDate = new Date().toISOString().slice(0, 10);
  const runId = opts.runId ?? "local";
  const branch = opts.branch ?? buildPrBranchName(opts.task, isoDate, runId);

  if (opts.dryRun || process.env.GO_OPERATOR_DRY_PR === "true") {
    return {
      ok: true,
      dryRun: true,
      branch,
      url: null,
      number: null,
      staged: [evidenceRelPath],
    };
  }

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
    .filter(Boolean)
    .map((rel) => rel.replace(/\\/g, "/"));

  if (staged.length === 0) {
    return {
      ok: true,
      branch,
      url: null,
      number: null,
      staged: [],
      prSkippedReason: "no changes",
    };
  }

  if (staged.length !== 1 || staged[0] !== evidenceRelPath) {
    throw new Error(
      `GO_OPERATOR_BLOCKED: staged diff must contain only ${evidenceRelPath} (got ${staged.join(", ")})`,
    );
  }

  assertDocsOnlyDiff(staged, (rel) => {
    try {
      return execSync(`git show :${rel}`, { cwd: root, encoding: "utf8" });
    } catch {
      return fs.readFileSync(path.join(root, rel), "utf8");
    }
  });

  const commitMsg = `docs(go-operator): archive ${opts.task} evidence`;
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd: root, stdio: "pipe" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/nothing to commit/i.test(msg)) {
      return {
        ok: true,
        branch,
        url: null,
        number: null,
        staged,
        prSkippedReason: "no changes",
      };
    }
    throw err;
  }

  try {
    execSync("git push -u origin HEAD", { cwd: root, stdio: "pipe" });
    const title = opts.title ?? `docs(go-operator): archive ${opts.task} evidence`;
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
    const ghOutput = execSync(`gh pr create --base main --title "${title}" --body "${escapedBody}"`, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN },
    }).trim();
    const { url, number } = parsePrUrl(ghOutput);

    return { ok: true, branch, url, number, staged };
  } catch (err) {
    return {
      ok: false,
      branch,
      url: null,
      number: null,
      staged,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
