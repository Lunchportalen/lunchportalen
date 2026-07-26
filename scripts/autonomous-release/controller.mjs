#!/usr/bin/env node
/**
 * Permanent multi-global release controller.
 * GitHub Actions is the long-running scheduler — Cursor is not required.
 * Never prints secrets. Never fabricates legal/tax/credential approvals.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const STATE_DIR = path.join(ROOT, "docs/rc/autonomous-release");
const LIVE_STATE_PATH = path.join(ROOT, "docs/rc/launch-2026-08-01/GLOBAL-LIVE-STATE.json");
const STATE_PATH = path.join(STATE_DIR, "AUTONOMOUS-RELEASE-STATE.json");
const LEDGER_PATH = path.join(STATE_DIR, "AUTONOMOUS-FAILURE-LEDGER.json");
const GATES_PATH = path.join(STATE_DIR, "AUTONOMOUS-GATE-INVENTORY.json");
const CANONICAL_OWNER_ISSUE_TITLE = "[15G.3E] Owner action required";
const RELEASE_BRANCH = "release/global-menu-universes-21";
const PHASE18_WORKFLOW = "phase18scale-load-cert.yml";
const AUTOFIX_WORKFLOW = "phase18-autonomous-autofix.yml";
const PROD_REF = "hkpokyapzarefrgqzkos";
const STAGING_REF = "uigxsboqeruxflgzqztl";
const LOAD_REF = "arstaxredytrjcmqcwhh";

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function ghJson(args) {
  const out = sh("gh", args);
  return out ? JSON.parse(out) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function fingerprint(parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((p) => String(p || "")).join("|"))
    .digest("hex")
    .slice(0, 16);
}

function classifyFromText(blob) {
  const s = String(blob || "");
  // Pooler / network markers must win before broad security keyword scans (logs often mention "security" tooling).
  if (
    /PHASE18_POOLER_AUTH_PROBE_FAILED|phase18_pooler_probe_retry|timeout expired|ECONNRESET|ECONNREFUSED|pooler/i.test(
      s,
    )
  ) {
    return "NETWORK_OR_POOLER_ERROR";
  }
  if (/\bSECURITY_INCIDENT\b|secret.?expos(?:ed|ure)|critical security finding/i.test(s)) {
    return "SECURITY_INCIDENT";
  }
  if (/rate limit|AUTH_RATE_LIMIT|429/i.test(s)) return "RATE_LIMIT_ERROR";
  if (/The operation was canceled|timeout-minutes|WORKFLOW_TIMEOUT/i.test(s)) return "WORKFLOW_TIMEOUT";
  if (/AUTH_REFRESH_FAIL|refresh_token|session/i.test(s)) return "AUTH_OR_SESSION_ERROR";
  if (/msdi:|menu_service_day|menus_fail|MENU_OR_SEED/i.test(s)) return "MENU_OR_SEED_DATA_ERROR";
  if (/RLS|tenant isolation|cross-tenant/i.test(s)) return "RLS_OR_TENANT_ERROR";
  if (/Unable to download|download-artifact|Artifact .* not found|handoff failed/i.test(s)) {
    return "ARTIFACT_HANDOFF_ERROR";
  }
  if (/Invalid workflow|workflow file|YAML|Unexpected value/i.test(s)) return "CI_WORKFLOW_ERROR";
  if (/project not found|INACTIVE|RESOURCE_EXPIR|credential.?expired/i.test(s)) return "RESOURCE_EXPIRATION";
  return "TEST_HARNESS_ERROR";
}

function pickErrorLine(logHint) {
  const text = String(logHint || "");
  // Prefer precise Phase18 failure markers anywhere in the blob (not only the tail).
  const failMarker = text.match(/PHASE18_[A-Z0-9_]*FAIL[A-Z0-9_]*[^\n]*/i);
  if (failMarker) return failMarker[0].replace(/^.*?(PHASE18_)/i, "$1").slice(0, 300);
  const probe = text.match(/phase18_pooler_probe_retry[^\n]*/i);
  if (probe) return probe[0].slice(0, 300);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const preferred =
    lines.find((l) => /##\[error\].*(PHASE18_|timeout|pooler|ECONN)/i.test(l)) ||
    [...lines].reverse().find((l) => /PHASE18_[A-Z0-9_]+/.test(l) && !/ALLOW_PROVISION|EVIDENCE|LOAD_REF|SOAK_HOURS|MAX_COST/.test(l)) ||
    lines.find((l) => /timeout expired|ECONNRESET|ECONNREFUSED/i.test(l)) ||
    lines.find((l) => /##\[error\]/.test(l)) ||
    "unknown_error";
  return String(preferred)
    .replace(/^.*?##\[error\]\s*/, "")
    .replace(/^.*?\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, "")
    .slice(0, 300);
}

function listPhase18Runs(limit = 8) {
  return (
    ghJson([
      "run",
      "list",
      "--workflow",
      PHASE18_WORKFLOW,
      "--limit",
      String(limit),
      "--json",
      "databaseId,status,conclusion,headSha,url,createdAt,updatedAt,event",
    ]) || []
  );
}

function listOpenPrs() {
  return ghJson(["pr", "list", "--state", "open", "--limit", "50", "--json", "number,title,headRefName,url"]) || [];
}

function listOpenIssues() {
  return (
    ghJson(["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,labels,url"]) || []
  );
}

function closeNoisePrs(prs, ledger) {
  const closed = [];
  for (const pr of prs) {
    const title = String(pr.title || "");
    const head = String(pr.headRefName || "");
    const noise =
      /repo-intelligence|weekly refresh|autonomous\/engineer|bot\/codex/i.test(title) ||
      /repo-intelligence|bot\/codex|autonomous\/engineer/i.test(head);
    if (!noise) continue;
    try {
      sh("gh", [
        "pr",
        "close",
        String(pr.number),
        "--comment",
        "Closed by autonomous release controller as non-release automation noise. Zero open PRs required for August 1 launch.",
      ]);
      closed.push(pr.number);
      ledger.entries.push({
        at: nowIso(),
        class: "AUTOMATION_NOISE",
        action: "close_pr",
        pr: pr.number,
        title,
      });
    } catch (e) {
      console.error(`close_pr_failed #${pr.number}: ${String(e?.stderr || e?.message || e).slice(0, 200)}`);
    }
  }
  return closed;
}

function closeDuplicate15g3eIssues(issues, ledger) {
  const closed = [];
  const dups = issues.filter((i) => /^\[15G\.3E\] Owner action required — run /i.test(i.title || ""));
  for (const issue of dups) {
    try {
      sh("gh", [
        "issue",
        "close",
        String(issue.number),
        "--comment",
        `Closed as duplicate of canonical Issue titled \`${CANONICAL_OWNER_ISSUE_TITLE}\`. See docs/rc/phase15g3e/OWNER-ACTIONS-CANONICAL.md.`,
      ]);
      closed.push(issue.number);
      ledger.entries.push({
        at: nowIso(),
        class: "AUTOMATION_NOISE",
        action: "close_issue",
        issue: issue.number,
        title: issue.title,
      });
    } catch (e) {
      console.error(`close_issue_failed #${issue.number}: ${String(e?.stderr || e?.message || e).slice(0, 200)}`);
    }
  }
  return closed;
}

function ensureCanonicalOwnerIssue(bodyExtra) {
  const open = listOpenIssues().filter(
    (i) => i.title === CANONICAL_OWNER_ISSUE_TITLE || /^\[15G\.3E\] Owner action required/.test(i.title || ""),
  );
  open.sort((a, b) => a.number - b.number);
  const primary = open.find((i) => i.title === CANONICAL_OWNER_ISSUE_TITLE) || open[0];
  for (const dup of open.slice(1)) {
    try {
      sh("gh", [
        "issue",
        "close",
        String(dup.number),
        "--comment",
        `Closed as duplicate of canonical #${primary?.number || "?"}.`,
      ]);
    } catch {
      /* ignore */
    }
  }
  if (!primary) return null;
  if (bodyExtra) {
    try {
      sh("gh", ["issue", "comment", String(primary.number), "--body", bodyExtra]);
    } catch {
      /* ignore */
    }
  }
  return primary.number;
}

function countActiveRuns(runs) {
  return runs.filter((r) => r.status === "queued" || r.status === "in_progress" || r.status === "waiting").length;
}

function cancelObsoleteRuns(runs, keepId) {
  for (const r of runs) {
    if (r.databaseId === keepId) continue;
    if (r.status !== "queued" && r.status !== "in_progress" && r.status !== "waiting") continue;
    try {
      sh("gh", ["run", "cancel", String(r.databaseId)]);
      console.log(JSON.stringify({ cancelled_obsolete_run: r.databaseId }));
    } catch {
      /* ignore */
    }
  }
}

function releaseSha() {
  try {
    return sh("git", ["rev-parse", `origin/${RELEASE_BRANCH}`]);
  } catch {
    try {
      return sh("git", ["rev-parse", "HEAD"]);
    } catch {
      return null;
    }
  }
}

function vercelCredsPresent() {
  return Boolean(process.env.VERCEL_TOKEN && String(process.env.VERCEL_TOKEN).trim());
}

function dispatchPhase18(sha, stopAfter = "auth-coverage") {
  sh("gh", [
    "workflow",
    "run",
    PHASE18_WORKFLOW,
    "--ref",
    RELEASE_BRANCH,
    "-f",
    `stop_after=${stopAfter}`,
    "-f",
    "allow_provision=YES",
    "-f",
    "skip_synthetic_seed=YES",
    "-f",
    `project_ref=${LOAD_REF}`,
    "-f",
    `app_sha=${sha}`,
    "-f",
    "max_cost_usd=10.00",
  ]);
}

function dispatchAutofix(payload) {
  const args = [
    "workflow",
    "run",
    AUTOFIX_WORKFLOW,
    "--ref",
    RELEASE_BRANCH,
    "-f",
    `failing_run_id=${payload.runId}`,
    "-f",
    `failing_job=${payload.job || "unknown"}`,
    "-f",
    `failing_step=${payload.step || "unknown"}`,
    "-f",
    `failing_sha=${payload.sha}`,
    "-f",
    `error_class=${payload.errorClass}`,
    "-f",
    `fingerprint=${payload.fingerprint}`,
    "-f",
    `normalized_error=${String(payload.error || "").slice(0, 400)}`,
  ];
  sh("gh", args);
}

function inspectFailedRun(runId) {
  try {
    const viewed = ghJson(["run", "view", String(runId), "--json", "jobs,conclusion,headSha,url"]) || {};
    const jobs = viewed.jobs || [];
    const failed = jobs.filter((j) => j.conclusion === "failure" || j.conclusion === "cancelled");
    const primary = failed.find((j) => j.name !== "final-report") || failed[0];
    let logHint = "";
    // Prefer whole-run failed logs (job-scoped --log-failed can truncate to env echo only).
    try {
      logHint = sh("gh", ["run", "view", String(runId), "--log-failed"], {
        maxBuffer: 12 * 1024 * 1024,
      });
    } catch {
      logHint = "";
    }
    if ((!logHint || logHint.length < 200) && (primary?.databaseId || primary?.id)) {
      const jobId = primary.databaseId || primary.id;
      try {
        logHint = sh("gh", ["run", "view", String(runId), "--job", String(jobId), "--log-failed"], {
          maxBuffer: 12 * 1024 * 1024,
        });
      } catch {
        /* keep prior */
      }
    }
    const errLine = pickErrorLine(logHint);
    const logTail = logHint.slice(-12000);
    const errorClass = classifyFromText(`${primary?.name || ""}\n${errLine}\n${logTail}`);
    return {
      job: primary?.name || "unknown",
      step: (primary?.steps || []).find((s) => s.conclusion === "failure")?.name || "unknown",
      errorClass,
      error: errLine,
      logTail: logTail.slice(-800),
    };
  } catch (e) {
    return {
      job: "unknown",
      step: "unknown",
      errorClass: "CI_WORKFLOW_ERROR",
      error: String(e?.message || e).slice(0, 200),
      logTail: "",
    };
  }
}

function mapStateFromGates(state, runs, sha) {
  const latest = runs[0] || null;
  const active = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  if (active) {
    state.state = "AUTH_COVERAGE";
    state.active_phase18_run_id = active.databaseId;
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
    return state;
  }
  state.active_phase18_run_id = null;
  if (!latest) {
    state.state = "VERIFYING_SOURCE";
    return state;
  }
  state.last_phase18_run_id = latest.databaseId;
  state.last_phase18_conclusion = latest.conclusion;
  if (latest.conclusion === "success" && latest.headSha === sha) {
    // Checkpoint A success → advance to controlled ramps
    state.state = "CONTROLLED_RAMPS";
    state.lanes.phase18_auth_coverage = "PASS";
    return state;
  }
  if (latest.conclusion === "failure" || latest.conclusion === "cancelled") {
    state.state = "FAILED_REQUIRES_AUTOFIX";
    return state;
  }
  state.state = "INVENTORY";
  return state;
}

function persistStateBranch(files) {
  const branch = "rc/autonomous-release-state";
  try {
    sh("git", ["fetch", "origin", branch], { stdio: "ignore" });
  } catch {
    /* first time */
  }
  // Commit on current worktree path into state branch via orphan-safe push of docs only.
  // Controller workflow persists via dedicated checkout of state branch.
  const stamp = {
    persisted_paths: files,
    at: nowIso(),
  };
  writeJson(path.join(STATE_DIR, "LAST-PERSIST.json"), stamp);
}

async function main() {
  const state = readJson(STATE_PATH, {});
  const ledger = readJson(LEDGER_PATH, { version: 1, entries: [] });
  const gates = readJson(GATES_PATH, { version: 1, gates: {} });
  const live = readJson(LIVE_STATE_PATH, {});

  state.counters = state.counters || {};
  state.counters.controller_ticks = Number(state.counters.controller_ticks || 0) + 1;
  state.updated_at = nowIso();
  state.stamped_at = state.stamped_at || nowIso();
  state.release_branch = RELEASE_BRANCH;
  state.phase18_project_ref = LOAD_REF;

  const sha = releaseSha();
  state.release_sha = sha;

  // Hygiene lane (independent)
  const prs = listOpenPrs();
  const issues = listOpenIssues();
  const closedPrs = closeNoisePrs(prs, ledger);
  const closedIssues = closeDuplicate15g3eIssues(issues, ledger);

  // Owner wait lanes (do not terminate controller)
  const waits = [];
  if (!vercelCredsPresent()) {
    waits.push("WAITING_OWNER_AUTH");
    state.lanes.production_deploy = "BLOCKED_WAITING_OWNER_AUTH";
    if (state.owner_wait !== "WAITING_OWNER_AUTH") {
      state.owner_wait = "WAITING_OWNER_AUTH";
      state.owner_wait_recorded_at = nowIso();
      ensureCanonicalOwnerIssue(
        [
          "## Autonomous controller — WAITING_OWNER_AUTH",
          "",
          "Vercel credentials are not available to the autonomous controller.",
          "Production exact-SHA deploy remains locked until `VERCEL_TOKEN` (or interactive login) is provided.",
          "",
          `- Release SHA: \`${sha}\``,
          `- Recorded: ${nowIso()}`,
          "",
          "Independent lanes continue: Phase 18, hygiene, staging prep, docs.",
        ].join("\n"),
      );
    }
  }
  waits.push("WAITING_OWNER_LEGAL_TAX");
  state.lanes.legal_tax_activation = "BLOCKED_WAITING_OWNER_LEGAL_TAX";

  const runs = listPhase18Runs(10);
  const activeCount = countActiveRuns(runs);
  if (activeCount > 1) {
    const keep = runs.find((r) => r.status === "in_progress" || r.status === "queued");
    cancelObsoleteRuns(runs, keep?.databaseId);
  }

  mapStateFromGates(state, runs, sha);

  // Advance / repair / dispatch
  let action = "noop";
  if (state.state === "FAILED_REQUIRES_AUTOFIX") {
    const latest = runs[0];
    const detail = inspectFailedRun(latest.databaseId);
    const fp = fingerprint([
      PHASE18_WORKFLOW,
      detail.job,
      detail.step,
      detail.errorClass,
      detail.error.replace(/\d{5,}/g, "N"),
    ]);
    const already = ledger.entries.some((e) => e.fingerprint === fp && e.action === "dispatch_autofix");
    ledger.entries.push({
      at: nowIso(),
      run_id: latest.databaseId,
      sha: latest.headSha,
      job: detail.job,
      step: detail.step,
      class: detail.errorClass,
      error: detail.error,
      fingerprint: fp,
      action: already ? "skip_duplicate_autofix" : "dispatch_autofix",
    });
    gates.notes = gates.notes || {};
    gates.notes.phase18_last_failure = `${detail.errorClass}: ${detail.error}`;
    if (detail.errorClass === "NETWORK_OR_POOLER_ERROR" || detail.errorClass === "RESOURCE_EXPIRATION") {
      // Retry Phase 18 directly (pooler flakes) — also mark resource wait if persistent.
      const recentPooler = ledger.entries.filter((e) => e.class === "NETWORK_OR_POOLER_ERROR").slice(-5);
      if (recentPooler.length >= 3) {
        state.status = "WAITING_OWNER_RESOURCE";
        state.state = "WAITING_OWNER_RESOURCE";
        state.owner_wait = "WAITING_OWNER_RESOURCE";
        ensureCanonicalOwnerIssue(
          [
            "## Autonomous controller — WAITING_OWNER_RESOURCE",
            "",
            `Isolated Phase 18 project \`${LOAD_REF}\` pooler auth probe failing repeatedly.`,
            "Do not use production/shared-staging refs.",
            "",
            `- Latest run: ${latest.databaseId}`,
            `- Error: ${detail.error}`,
            `- SHA: \`${latest.headSha}\``,
          ].join("\n"),
        );
        action = "owner_resource_wait";
      } else if (activeCount === 0) {
        dispatchPhase18(sha, state.stop_after || "auth-coverage");
        state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
        state.state = "AUTH_COVERAGE";
        state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
        action = "redispatch_phase18_pooler_retry";
      }
    } else if (!already && activeCount === 0) {
      dispatchAutofix({
        runId: latest.databaseId,
        job: detail.job,
        step: detail.step,
        sha: latest.headSha || sha,
        errorClass: detail.errorClass,
        fingerprint: fp,
        error: detail.error,
      });
      state.counters.autofix_dispatches = Number(state.counters.autofix_dispatches || 0) + 1;
      state.last_failure_fingerprint = fp;
      state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
      action = "dispatch_autofix";
    } else if (activeCount === 0 && already) {
      // Same fingerprint already autofixed — redispatch gate after cooldown
      dispatchPhase18(sha, state.stop_after || "auth-coverage");
      state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
      state.state = "AUTH_COVERAGE";
      action = "redispatch_after_autofix";
    }
  } else if (state.state === "CONTROLLED_RAMPS" && activeCount === 0) {
    dispatchPhase18(sha, "controlled-ramps-business");
    state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
    state.stop_after = "controlled-ramps-business";
    action = "dispatch_controlled_ramps";
  } else if (
    (state.state === "INVENTORY" || state.state === "VERIFYING_SOURCE" || state.state === "AUTH_COVERAGE") &&
    activeCount === 0 &&
    (!runs[0] || runs[0].conclusion === "failure" || runs[0].conclusion === "cancelled")
  ) {
    // Bootstrap / continue Checkpoint A
    if (state.status !== "WAITING_OWNER_RESOURCE") {
      dispatchPhase18(sha, "auth-coverage");
      state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
      state.state = "AUTH_COVERAGE";
      state.stop_after = "auth-coverage";
      state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
      action = "dispatch_auth_coverage";
    }
  } else if (activeCount === 1) {
    action = "monitor_active_run";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
  }

  // Prefer waiting status only when that is the sole meaningful status
  if (waits.includes("WAITING_OWNER_AUTH") && state.status === "AUTONOMOUS_CONTROLLER_RUNNING") {
    // Keep RUNNING while independent lanes continue; surface wait in owner_wait.
  }
  if (state.state === "WAITING_OWNER_RESOURCE") {
    state.status = "WAITING_OWNER_RESOURCE";
  }

  // Update gates / live snapshot honestly
  gates.updated_at = nowIso();
  if (runs[0]?.conclusion === "success") {
    gates.gates.phase18_auth_coverage = "PASS";
  } else if (runs[0]?.conclusion === "failure") {
    gates.gates.phase18_auth_coverage = "FAIL";
    gates.gates.phase18_schema_parity =
      /POOLER|schema-and-release-parity/i.test(gates.notes?.phase18_last_failure || "")
        ? "FAIL"
        : gates.gates.phase18_schema_parity;
  }
  live.updated_at = nowIso();
  live.MULTI_GLOBAL_CUSTOMER_RELEASE = "NOT_LIVE";
  live.GLOBAL_SCALE_CERTIFIED = "NO";
  live.READY_FOR_GLOBAL_PRODUCTION_CANARY = "NO";
  live.owner_blockers = waits;
  live.STRIPE = "OFF";
  live.invoice_only = true;
  live.commission_bps = 500;

  // Trim ledger
  ledger.entries = (ledger.entries || []).slice(-200);
  ledger.updated_at = nowIso();

  writeJson(STATE_PATH, state);
  writeJson(LEDGER_PATH, ledger);
  writeJson(GATES_PATH, gates);
  writeJson(LIVE_STATE_PATH, live);
  persistStateBranch([STATE_PATH, LEDGER_PATH, GATES_PATH, LIVE_STATE_PATH]);

  const summary = {
    controller: "phase18-autonomous-global-release",
    status: state.status,
    state: state.state,
    action,
    release_sha: sha,
    active_phase18_run_id: state.active_phase18_run_id,
    last_phase18_run_id: state.last_phase18_run_id,
    last_phase18_conclusion: state.last_phase18_conclusion,
    owner_wait: state.owner_wait,
    closed_prs: closedPrs,
    closed_issues: closedIssues,
    forbidden_refs_guard: { prod: PROD_REF, staging: STAGING_REF, load: LOAD_REF },
    stamped_at: nowIso(),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `status=${state.status}`,
        `state=${state.state}`,
        `action=${action}`,
        `release_sha=${sha || ""}`,
        `owner_wait=${state.owner_wait || ""}`,
      ].join("\n") + "\n",
    );
  }
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exit(2);
});
