#!/usr/bin/env node
/**
 * Permanent multi-global release controller.
 * GitHub Actions is the long-running scheduler — Cursor is not required.
 * Never prints secrets. Never fabricates legal/tax/credential approvals.
 *
 * Reaction contract:
 * - Inspect GitHub reality every tick (never trust stored state alone).
 * - GITHUB_TOKEN-dispatched workflow_run events do not recurse — schedule +
 *   in-tick autofix wait are the guaranteed continuation paths.
 * - Owner-wait blocks only production deploy / country activation.
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
const HANDLED_PATH = path.join(STATE_DIR, "AUTONOMOUS-HANDLED-FAILURES.json");
const CANONICAL_OWNER_ISSUE_TITLE = "[15G.3E] Owner action required";
const RELEASE_BRANCH = "release/global-menu-universes-21";
const PHASE18_WORKFLOW = "phase18scale-load-cert.yml";
const AUTOFIX_WORKFLOW = "phase18-autonomous-autofix.yml";
const PROD_REF = "hkpokyapzarefrgqzkos";
const STAGING_REF = "uigxsboqeruxflgzqztl";
const LOAD_REF = "arstaxredytrjcmqcwhh";
const MAX_AUTOFIX_WAIT_MS = 8 * 60 * 1000;
const AUTOFIX_POLL_MS = 15_000;

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

function sleep(ms) {
  const sec = Math.max(1, Math.ceil(Number(ms) / 1000));
  try {
    execFileSync("sleep", [String(sec)], { stdio: "ignore" });
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* fallback spin for environments without sleep(1) */
    }
  }
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
  if (
    /PHASE18_POOLER_AUTH_PROBE_FAILED|phase18_pooler_probe_retry|timeout expired|ECONNRESET|ECONNREFUSED|pooler/i.test(
      s,
    )
  ) {
    return "NETWORK_OR_POOLER_ERROR";
  }
  if (/api-keys HTTP|project HTTP|PHASE18_PROJECT_NOT_FOUND|project not found|INACTIVE|RESOURCE_EXPIR|paused/i.test(s)) {
    return "RESOURCE_EXPIRATION";
  }
  if (/\bSECURITY_INCIDENT\b|secret.?expos(?:ed|ure)|critical security finding/i.test(s)) {
    return "SECURITY_INCIDENT";
  }
  if (/rate limit|AUTH_RATE_LIMIT|429/i.test(s)) return "RATE_LIMIT_ERROR";
  if (/The operation was canceled|timed_out|timeout-minutes|WORKFLOW_TIMEOUT/i.test(s)) {
    return "WORKFLOW_TIMEOUT";
  }
  if (/AUTH_REFRESH_FAIL|refresh_token|session/i.test(s)) return "AUTH_OR_SESSION_ERROR";
  if (/msdi:|menu_service_day|menus_fail|MENU_OR_SEED/i.test(s)) return "MENU_OR_SEED_DATA_ERROR";
  if (/RLS|tenant isolation|cross-tenant/i.test(s)) return "RLS_OR_TENANT_ERROR";
  if (/Unable to download|download-artifact|Artifact .* not found|handoff failed/i.test(s)) {
    return "ARTIFACT_HANDOFF_ERROR";
  }
  if (/Invalid workflow|workflow file|YAML|Unexpected value/i.test(s)) return "CI_WORKFLOW_ERROR";
  return "TEST_HARNESS_ERROR";
}

function pickErrorLine(logHint) {
  const text = String(logHint || "");
  const failMarker = text.match(/PHASE18_[A-Z0-9_]*FAIL[A-Z0-9_]*[^\n]*/i);
  if (failMarker) return failMarker[0].replace(/^.*?(PHASE18_)/i, "$1").slice(0, 300);
  const apiKeys = text.match(/api-keys HTTP \d+[^\n]*/i);
  if (apiKeys) return apiKeys[0].slice(0, 300);
  const projectHttp = text.match(/project HTTP \d+[^\n]*/i);
  if (projectHttp) return projectHttp[0].slice(0, 300);
  const probe = text.match(/phase18_pooler_probe_retry[^\n]*/i);
  if (probe) return probe[0].slice(0, 300);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const preferred =
    lines.find((l) => /##\[error\].*(PHASE18_|timeout|pooler|api-keys|ECONN)/i.test(l)) ||
    [...lines]
      .reverse()
      .find(
        (l) =>
          /PHASE18_[A-Z0-9_]+/.test(l) &&
          !/ALLOW_PROVISION|EVIDENCE|LOAD_REF|SOAK_HOURS|MAX_COST/.test(l),
      ) ||
    lines.find((l) => /timeout expired|ECONNRESET|ECONNREFUSED|api-keys HTTP/i.test(l)) ||
    lines.find((l) => /##\[error\]/.test(l)) ||
    "unknown_error";
  return String(preferred)
    .replace(/^.*?##\[error\]\s*/, "")
    .replace(/^.*?\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, "")
    .slice(0, 300);
}

function listPhase18Runs(limit = 12) {
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

function listAutofixRuns(limit = 8) {
  return (
    ghJson([
      "run",
      "list",
      "--workflow",
      AUTOFIX_WORKFLOW,
      "--limit",
      String(limit),
      "--json",
      "databaseId,status,conclusion,headSha,url,createdAt,updatedAt",
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

function isFailedConclusion(c) {
  return c === "failure" || c === "cancelled" || c === "timed_out" || c === "startup_failure";
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
    "main",
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

function waitForNewAutofixRun(beforeIds, timeoutMs = MAX_AUTOFIX_WAIT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const runs = listAutofixRuns(5);
    const fresh = runs.find((r) => !beforeIds.has(r.databaseId));
    if (fresh) return fresh;
    sleep(AUTOFIX_POLL_MS);
  }
  return null;
}

function waitForRunCompletion(runId, timeoutMs = MAX_AUTOFIX_WAIT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const viewed = ghJson(["run", "view", String(runId), "--json", "status,conclusion,databaseId,headSha,url"]);
      if (viewed && viewed.status === "completed") return viewed;
    } catch {
      /* retry */
    }
    sleep(AUTOFIX_POLL_MS);
  }
  return null;
}

function findNewestPhase18After(beforeIds, sha, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const runs = listPhase18Runs(8);
    const hit = runs.find(
      (r) =>
        !beforeIds.has(r.databaseId) &&
        (!sha || !r.headSha || r.headSha === sha) &&
        (r.status === "queued" || r.status === "in_progress" || r.status === "completed"),
    );
    if (hit) return hit;
    sleep(10_000);
  }
  return null;
}

function inspectFailedRun(runId) {
  try {
    const viewed = ghJson(["run", "view", String(runId), "--json", "jobs,conclusion,headSha,url"]) || {};
    const jobs = viewed.jobs || [];
    const failed = jobs.filter((j) => isFailedConclusion(j.conclusion));
    const primary = failed.find((j) => j.name !== "final-report") || failed[0];
    let logHint = "";
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

function normalizeError(err) {
  return String(err || "")
    .replace(/\d{5,}/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function dedupeKey(parts) {
  return fingerprint([
    PHASE18_WORKFLOW,
    parts.job,
    parts.step,
    parts.errorClass,
    normalizeError(parts.error),
    parts.sha,
  ]);
}

function markHandled(handled, entry) {
  handled.entries = handled.entries || [];
  handled.entries.push({ ...entry, last_checked_at: nowIso() });
  handled.entries = handled.entries.slice(-100);
  handled.updated_at = nowIso();
}

function wasRunHandled(handled, runId) {
  return (handled.entries || []).some(
    (e) => Number(e.failed_run_id) === Number(runId) && e.resolution && e.resolution !== "detected",
  );
}

async function main() {
  const state = readJson(STATE_PATH, {});
  const ledger = readJson(LEDGER_PATH, { version: 1, entries: [] });
  const gates = readJson(GATES_PATH, { version: 1, gates: {} });
  const live = readJson(LIVE_STATE_PATH, {});
  const handled = readJson(HANDLED_PATH, { version: 1, entries: [] });

  state.counters = state.counters || {};
  state.counters.controller_ticks = Number(state.counters.controller_ticks || 0) + 1;
  state.updated_at = nowIso();
  state.stamped_at = state.stamped_at || nowIso();
  state.release_branch = RELEASE_BRANCH;
  state.phase18_project_ref = LOAD_REF;
  state.lanes = state.lanes || {};

  const sha = releaseSha();
  state.release_sha = sha;

  const prs = listOpenPrs();
  const issues = listOpenIssues();
  const closedPrs = closeNoisePrs(prs, ledger);
  const closedIssues = closeDuplicate15g3eIssues(issues, ledger);

  const waits = [];
  if (!vercelCredsPresent()) {
    waits.push("WAITING_OWNER_AUTH");
    state.lanes.production_deploy = "BLOCKED_WAITING_OWNER_AUTH";
    if (state.owner_wait !== "WAITING_OWNER_AUTH" && state.owner_wait !== "WAITING_OWNER_RESOURCE") {
      state.owner_wait = "WAITING_OWNER_AUTH";
      state.owner_wait_recorded_at = nowIso();
      ensureCanonicalOwnerIssue(
        [
          "## Autonomous controller — WAITING_OWNER_AUTH",
          "",
          "Vercel credentials are not available to the autonomous controller.",
          "Production exact-SHA deploy remains locked until `VERCEL_TOKEN` is provided.",
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

  // Owner waits must never block technical remediation below.
  state.lanes.phase18_auth_coverage = state.lanes.phase18_auth_coverage || "ACTIVE";
  state.lanes.github_hygiene = "ACTIVE";

  let runs = listPhase18Runs(12);
  let autofixRuns = listAutofixRuns(8);
  const activeCount = countActiveRuns(runs);
  const activeAutofix = countActiveRuns(autofixRuns);
  if (activeCount > 1) {
    const keep = runs.find((r) => r.status === "in_progress" || r.status === "queued");
    cancelObsoleteRuns(runs, keep?.databaseId);
    runs = listPhase18Runs(12);
  }
  if (activeAutofix > 1) {
    const keep = autofixRuns.find((r) => r.status === "in_progress" || r.status === "queued");
    cancelObsoleteRuns(autofixRuns, keep?.databaseId);
    autofixRuns = listAutofixRuns(8);
  }

  const latest = runs[0] || null;
  const active = runs.find((r) => r.status === "in_progress" || r.status === "queued" || r.status === "waiting");
  state.active_phase18_run_id = active?.databaseId || null;
  if (latest) {
    state.last_phase18_run_id = latest.databaseId;
    state.last_phase18_conclusion = latest.conclusion;
  }

  let action = "noop";
  let replacementRun = null;
  let autofixRunId = null;
  let fixSha = null;

  if (active) {
    state.state = "AUTH_COVERAGE";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
    action = "monitor_active_run";
  } else if (latest && latest.conclusion === "success" && latest.headSha === sha) {
    state.state = "CONTROLLED_RAMPS";
    state.lanes.phase18_auth_coverage = "PASS";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
    if (activeCount === 0) {
      dispatchPhase18(sha, "controlled-ramps-business");
      state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
      state.stop_after = "controlled-ramps-business";
      action = "dispatch_controlled_ramps";
    }
  } else if (latest && isFailedConclusion(latest.conclusion) && !wasRunHandled(handled, latest.databaseId)) {
    state.state = "FAILED_REQUIRES_AUTOFIX";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";

    const detail = inspectFailedRun(latest.databaseId);
    const logicKey = dedupeKey({
      job: detail.job,
      step: detail.step,
      errorClass: detail.errorClass,
      error: detail.error,
      sha: latest.headSha || sha,
    });
    const runFp = fingerprint([
      PHASE18_WORKFLOW,
      latest.databaseId,
      latest.headSha,
      detail.job,
      detail.step,
      detail.errorClass,
      normalizeError(detail.error),
    ]);

    markHandled(handled, {
      detected_at: nowIso(),
      failed_run_id: latest.databaseId,
      failed_sha: latest.headSha,
      job: detail.job,
      step: detail.step,
      error_class: detail.errorClass,
      error: detail.error,
      fingerprint: runFp,
      logic_key: logicKey,
      resolution: "detected",
    });

    gates.notes = gates.notes || {};
    gates.notes.phase18_last_failure = `${detail.errorClass}: ${detail.error}`;
    state.last_failure_fingerprint = runFp;

    ledger.entries.push({
      at: nowIso(),
      run_id: latest.databaseId,
      sha: latest.headSha,
      job: detail.job,
      step: detail.step,
      class: detail.errorClass,
      error: detail.error,
      fingerprint: runFp,
      logic_key: logicKey,
      action: "detect_unhandled_failure",
    });

    const recentSameLogic = (ledger.entries || []).filter(
      (e) => e.logic_key === logicKey && e.action === "dispatch_autofix",
    ).length;
    const resourceEscalation =
      detail.errorClass === "RESOURCE_EXPIRATION" &&
      (recentSameLogic >= 1 || /api-keys HTTP 400|PHASE18_PROJECT_NOT_FOUND|project not found/i.test(detail.error));

    if (resourceEscalation) {
      state.owner_wait = "WAITING_OWNER_RESOURCE";
      state.status = "WAITING_OWNER_RESOURCE";
      ensureCanonicalOwnerIssue(
        [
          "## Autonomous controller — WAITING_OWNER_RESOURCE",
          "",
          `Isolated Phase 18 project \`${LOAD_REF}\` is unreachable (\`${detail.error}\`).`,
          "Do not use production/shared-staging refs.",
          "UNAPPROVED_PAID_RESOURCES remains NOT APPROVED — provide an existing isolated project or approve reprovision.",
          "",
          `- Failed run: ${latest.databaseId}`,
          `- Job/step: ${detail.job} / ${detail.step}`,
          `- Class: ${detail.errorClass}`,
          `- SHA: \`${latest.headSha}\``,
          `- Detected: ${nowIso()}`,
          "",
          "Technical lanes continue where possible; production deploy remains blocked separately by WAITING_OWNER_AUTH / LEGAL_TAX.",
        ].join("\n"),
      );
    }

    // Always attempt autofix for the unhandled run (even under owner-resource wait),
    // so diagnostics/code hardening land; then redispatch once on the new tip.
    if (activeAutofix === 0) {
      const beforeAutofix = new Set(autofixRuns.map((r) => r.databaseId));
      dispatchAutofix({
        runId: latest.databaseId,
        job: detail.job,
        step: detail.step,
        sha: latest.headSha || sha,
        errorClass: detail.errorClass,
        fingerprint: runFp,
        error: detail.error,
      });
      state.counters.autofix_dispatches = Number(state.counters.autofix_dispatches || 0) + 1;
      action = "dispatch_autofix";
      ledger.entries.push({
        at: nowIso(),
        run_id: latest.databaseId,
        sha: latest.headSha,
        class: detail.errorClass,
        fingerprint: runFp,
        logic_key: logicKey,
        action: "dispatch_autofix",
      });

      const autofixRun = waitForNewAutofixRun(beforeAutofix);
      if (autofixRun) {
        autofixRunId = autofixRun.databaseId;
        const completed = waitForRunCompletion(autofixRun.databaseId);
        console.log(
          JSON.stringify({
            autofix_wait: {
              run_id: autofixRun.databaseId,
              status: completed?.status || "timeout",
              conclusion: completed?.conclusion || null,
            },
          }),
        );
      }
    } else {
      action = "wait_active_autofix";
      autofixRunId = autofixRuns.find((r) => r.status !== "completed")?.databaseId || null;
    }

    // Refresh release tip after autofix push
    try {
      sh("git", ["fetch", "origin", RELEASE_BRANCH], { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    fixSha = releaseSha();
    state.release_sha = fixSha;

    const beforePhase = new Set(listPhase18Runs(12).map((r) => r.databaseId));
    // One replacement attempt after handling this run ID — even under resource wait —
    // proves the reaction loop; repeated identical resource failures escalate without spam.
    const alreadyReplaced = (handled.entries || []).some(
      (e) => e.logic_key === logicKey && e.replacement_phase18_run_id && e.failed_sha === (latest.headSha || sha),
    );
    if (!alreadyReplaced && countActiveRuns(listPhase18Runs(8)) === 0) {
      dispatchPhase18(fixSha, state.stop_after || "auth-coverage");
      state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
      state.state = "AUTH_COVERAGE";
      if (state.status !== "WAITING_OWNER_RESOURCE") {
        state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
      }
      action = action === "dispatch_autofix" ? "autofix_then_redispatch_phase18" : "redispatch_phase18";
      replacementRun = findNewestPhase18After(beforePhase, fixSha);
      markHandled(handled, {
        detected_at: nowIso(),
        failed_run_id: latest.databaseId,
        failed_sha: latest.headSha,
        job: detail.job,
        step: detail.step,
        error_class: detail.errorClass,
        error: detail.error,
        fingerprint: runFp,
        logic_key: logicKey,
        autofix_run_id: autofixRunId,
        fix_sha: fixSha,
        replacement_phase18_run_id: replacementRun?.databaseId || null,
        resolution: replacementRun ? "replacement_dispatched" : "replacement_dispatch_attempted",
      });
      ledger.entries.push({
        at: nowIso(),
        run_id: latest.databaseId,
        sha: fixSha,
        class: detail.errorClass,
        fingerprint: runFp,
        action: "dispatch_replacement_phase18",
        replacement_run_id: replacementRun?.databaseId || null,
      });
    } else {
      markHandled(handled, {
        detected_at: nowIso(),
        failed_run_id: latest.databaseId,
        failed_sha: latest.headSha,
        fingerprint: runFp,
        logic_key: logicKey,
        autofix_run_id: autofixRunId,
        fix_sha: fixSha,
        resolution: alreadyReplaced ? "duplicate_replacement_suppressed" : "autofix_only",
      });
    }
  } else if (!latest) {
    state.state = "VERIFYING_SOURCE";
    dispatchPhase18(sha, "auth-coverage");
    state.counters.phase18_dispatches = Number(state.counters.phase18_dispatches || 0) + 1;
    state.state = "AUTH_COVERAGE";
    state.stop_after = "auth-coverage";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
    action = "dispatch_auth_coverage";
  } else if (latest && isFailedConclusion(latest.conclusion) && wasRunHandled(handled, latest.databaseId)) {
    state.state = "FAILED_REQUIRES_AUTOFIX";
    state.status =
      state.owner_wait === "WAITING_OWNER_RESOURCE"
        ? "WAITING_OWNER_RESOURCE"
        : "AUTONOMOUS_CONTROLLER_RUNNING";
    action = "await_schedule_or_resource";
  } else {
    state.state = "INVENTORY";
    state.status = "AUTONOMOUS_CONTROLLER_RUNNING";
    action = "inventory";
  }

  gates.updated_at = nowIso();
  gates.gates = gates.gates || {};
  if (latest?.conclusion === "success") {
    gates.gates.phase18_auth_coverage = "PASS";
  } else if (isFailedConclusion(latest?.conclusion)) {
    gates.gates.phase18_auth_coverage = "FAIL";
    if (/POOLER|api-keys|RESOURCE/i.test(gates.notes?.phase18_last_failure || "")) {
      gates.gates.phase18_schema_parity = "FAIL";
      gates.gates.phase18_source_safety = "FAIL";
    }
  }

  live.updated_at = nowIso();
  live.MULTI_GLOBAL_CUSTOMER_RELEASE = "NOT_LIVE";
  live.GLOBAL_SCALE_CERTIFIED = "NO";
  live.READY_FOR_GLOBAL_PRODUCTION_CANARY = "NO";
  live.owner_blockers = [
    ...waits,
    ...(state.owner_wait === "WAITING_OWNER_RESOURCE" ? ["WAITING_OWNER_RESOURCE"] : []),
  ];
  live.STRIPE = "OFF";
  live.invoice_only = true;
  live.commission_bps = 500;

  ledger.entries = (ledger.entries || []).slice(-200);
  ledger.updated_at = nowIso();

  writeJson(STATE_PATH, state);
  writeJson(LEDGER_PATH, ledger);
  writeJson(GATES_PATH, gates);
  writeJson(LIVE_STATE_PATH, live);
  writeJson(HANDLED_PATH, handled);

  const summary = {
    controller: "phase18-autonomous-global-release",
    status: state.status,
    state: state.state,
    action,
    release_sha: state.release_sha,
    fix_sha: fixSha,
    active_phase18_run_id: state.active_phase18_run_id,
    last_phase18_run_id: state.last_phase18_run_id,
    last_phase18_conclusion: state.last_phase18_conclusion,
    autofix_run_id: autofixRunId,
    replacement_phase18_run_id: replacementRun?.databaseId || null,
    replacement_status: replacementRun?.status || null,
    owner_wait: state.owner_wait,
    closed_prs: closedPrs,
    closed_issues: closedIssues,
    github_token_recursion_note:
      "workflow_run does not fire for GITHUB_TOKEN-dispatched child workflows; 5m schedule + in-tick autofix wait are authoritative",
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
        `release_sha=${state.release_sha || ""}`,
        `fix_sha=${fixSha || ""}`,
        `autofix_run_id=${autofixRunId || ""}`,
        `replacement_phase18_run_id=${replacementRun?.databaseId || ""}`,
        `owner_wait=${state.owner_wait || ""}`,
      ].join("\n") + "\n",
    );
  }
}

main().catch((e) => {
  console.error(String(e?.stack || e?.message || e));
  process.exit(2);
});
