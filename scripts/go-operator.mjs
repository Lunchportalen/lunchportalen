#!/usr/bin/env node
/**
 * GO Operator — read-only evidence automation for Lunchportalen GO tracks.
 * Default: read-only. No SOT. No auto-rollout. No production mutation.
 */

import { GO_OPERATOR_VERSION, TASK_ALIASES, VALID_TASKS } from "./go-operator/constants.mjs";
import { openDocsOnlyPr } from "./go-operator/pr.mjs";
import { validateModeSafety } from "./go-operator/safety.mjs";
import { runTaskChecks, writeEvidence, writeLatestReport } from "./go-operator/tasks.mjs";
import { runWorkspaceGate } from "./go-operator/workspace.mjs";

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {
    task: "",
    mode: "read-only",
    allowProductionMutation: false,
    openPr: false,
    dryPr: false,
    targetProvider: "",
    targetDate: "",
    targetTier: "",
    runTests: true,
    skipWorkspaceGate: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--task" && argv[i + 1]) {
      out.task = argv[++i];
    } else if (arg.startsWith("--task=")) {
      out.task = arg.slice("--task=".length);
    } else if (arg === "--mode" && argv[i + 1]) {
      out.mode = argv[++i];
    } else if (arg.startsWith("--mode=")) {
      out.mode = arg.slice("--mode=".length);
    } else if (arg === "--allow-production-mutation") {
      out.allowProductionMutation = true;
    } else if (arg === "--allow-production-mutation=true") {
      out.allowProductionMutation = true;
    } else if (arg === "--allow-production-mutation=false") {
      out.allowProductionMutation = false;
    } else if (arg === "--open-pr") {
      out.openPr = true;
    } else if (arg === "--open-pr=true") {
      out.openPr = true;
    } else if (arg === "--open-pr=false") {
      out.openPr = false;
    } else if (arg === "--dry-pr") {
      out.dryPr = true;
    } else if (arg === "--dry-pr=true") {
      out.dryPr = true;
    } else if (arg === "--dry-pr=false") {
      out.dryPr = false;
    } else if (arg === "--target-provider" && argv[i + 1]) {
      out.targetProvider = argv[++i];
    } else if (arg.startsWith("--target-provider=")) {
      out.targetProvider = arg.slice("--target-provider=".length);
    } else if (arg === "--target-date" && argv[i + 1]) {
      out.targetDate = argv[++i];
    } else if (arg.startsWith("--target-date=")) {
      out.targetDate = arg.slice("--target-date=".length);
    } else if (arg === "--target-tier" && argv[i + 1]) {
      out.targetTier = argv[++i];
    } else if (arg.startsWith("--target-tier=")) {
      out.targetTier = arg.slice("--target-tier=".length);
    } else if (arg === "--skip-tests") {
      out.runTests = false;
    } else if (arg === "--skip-workspace-gate") {
      out.skipWorkspaceGate = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return out;
}

function printHelp() {
  console.log(`GO Operator v${GO_OPERATOR_VERSION}
Usage: node scripts/go-operator.mjs --task <task> [options]

Tasks: ${VALID_TASKS.join(", ")}

Options:
  --mode read-only|production          (default: read-only)
  --allow-production-mutation=false    (default: false; hard-blocked ops always forbidden)
  --open-pr=false                      (default: false)
  --dry-pr                             (local/CI: validate PR path without gh/git push)
  --target-provider=<uuid>
  --target-date=<YYYY-MM-DD>
  --target-tier=<BASIS|LUXUS|ENTERPRISE>
  --skip-tests                         (CI fast path for docs packaging)
  --skip-workspace-gate                (CI only)

Safety: SOT, auto-rollout, Supabase apply, Sanity mutation, billing, order path — always forbidden.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  const rawTask = String(args.task ?? "").trim().toLowerCase();
  const task = TASK_ALIASES[rawTask] ?? rawTask;

  if (!VALID_TASKS.includes(task)) {
    console.error(`GO_OPERATOR_BLOCKED: unknown task '${rawTask}'`);
    process.exit(1);
  }

  try {
    validateModeSafety(args.mode, args.allowProductionMutation);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const workspace = args.skipWorkspaceGate
    ? { ok: true, issues: [], branch: "ci", head: "ci", remote: "", untrackedCount: 0 }
    : runWorkspaceGate(root);

  if (!workspace.ok) {
    console.error("GO_OPERATOR_BLOCKED: workspace gate failed", workspace.issues);
    process.exit(1);
  }

  const targets = {
    ...(args.targetProvider ? { provider: args.targetProvider } : {}),
    ...(args.targetDate ? { date: args.targetDate } : {}),
    ...(args.targetTier ? { tier: args.targetTier } : {}),
  };

  const result = await runTaskChecks(root, task, {
    workspace,
    mode: args.mode,
    head: workspace.head,
    targets,
    runTests: args.runTests !== false,
  });

  const evidence = writeEvidence(root, task, {
    version: GO_OPERATOR_VERSION,
    workspace,
    mode: args.mode,
    head: workspace.head,
    checks: result.checks,
    tests: result.tests,
    targets: Object.keys(targets).length ? targets : undefined,
    decision: result.decision,
    nextGoPrompt: result.nextGoPrompt,
    scope: result.scope,
  });

  let pr = null;
  let prSkippedReason = null;
  if (args.openPr) {
    pr = openDocsOnlyPr(root, {
      evidenceRelPath: evidence.relPath,
      task,
      runId: workspace.head || "local",
      dryRun: args.dryPr,
    });
    if (pr && typeof pr === "object" && "prSkippedReason" in pr && pr.prSkippedReason) {
      prSkippedReason = pr.prSkippedReason;
    }
  }

  const report = {
    version: GO_OPERATOR_VERSION,
    task,
    mode: args.mode,
    allowProductionMutation: args.allowProductionMutation,
    ok: result.ok,
    decision: result.decision,
    nextGoPrompt: result.nextGoPrompt,
    workspace,
    checks: result.checks,
    tests: result.tests,
    evidencePath: evidence.relPath,
    pr,
    ...(prSkippedReason ? { prSkippedReason } : {}),
    completedAt: new Date().toISOString(),
    safety: {
      sot: "NOT_STARTED",
      autoRollout: "NOT_STARTED",
      productionMutation: "NONE",
    },
  };

  const reportPath = writeLatestReport(root, report);

  console.log(JSON.stringify({ ok: result.ok, decision: result.decision, evidence: evidence.relPath, reportPath, pr }, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
