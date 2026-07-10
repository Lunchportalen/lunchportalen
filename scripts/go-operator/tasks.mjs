import fs from "node:fs";
import path from "node:path";

import {
  F4B_MIGRATION,
  F4B_MIGRATION_FILE,
  PENDING_BILLING_MIGRATIONS,
  PRODUCTION_LEDGER_SNAPSHOT,
  TASK_TEST_COMMANDS,
  TRUTH_INDEX,
} from "./constants.mjs";
import { computePendingMigrations, listRepoMigrationVersions } from "./safety.mjs";
import { runCommand } from "./workspace.mjs";

/**
 * @param {string} isoDate
 * @param {Record<string, unknown>} ctx
 */
export function buildEvidenceMarkdown(task, isoDate, ctx) {
  const lines = [
    `# GO Operator — ${task}`,
    "",
    `**Status:** Evidence archived · docs-only · **${ctx.decision ?? "PENDING"}**`,
    `**Date:** ${isoDate}`,
    `**Operator version:** ${ctx.version ?? "1.0.0"}`,
    `**Main HEAD:** \`${ctx.head ?? "unknown"}\``,
    `**Mode:** ${ctx.mode ?? "read-only"}`,
    `**Audit type:** Read-only. No SOT start. No auto-rollout. No production mutation.`,
    "",
    "**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**",
    "",
    "---",
    "",
    "## 1. Scope",
    "",
    String(ctx.scope ?? `Automated GO Operator run for task \`${task}\`.`),
    "",
    "## 2. Workspace gate",
    "",
    "| Check | Result |",
    "|-------|--------|",
    `| Branch | \`${ctx.workspace?.branch ?? "n/a"}\` |`,
    `| HEAD | \`${ctx.workspace?.head ?? "n/a"}\` |`,
    `| Gate | **${ctx.workspace?.ok ? "PASS" : "FAIL"}** |`,
    "",
    "## 3. Checks",
    "",
  ];

  const checks = /** @type {Array<{name: string, ok: boolean, detail?: string}>} */ (ctx.checks ?? []);
  if (checks.length === 0) {
    lines.push("_No checks recorded._", "");
  } else {
    lines.push("| Check | Result | Detail |", "|-------|--------|--------|");
    for (const c of checks) {
      lines.push(`| ${c.name} | **${c.ok ? "PASS" : "FAIL"}** | ${c.detail ?? ""} |`);
    }
    lines.push("");
  }

  lines.push("## 4. Tests", "", "| Command | Result |", "|---------|--------|");
  for (const t of /** @type {Array<{cmd: string, ok: boolean}>} */ (ctx.tests ?? [])) {
    lines.push(`| \`${t.cmd}\` | **${t.ok ? "PASS" : "FAIL"}** |`);
  }
  lines.push("");

  if (ctx.targets) {
    lines.push("## 5. Targets", "");
    lines.push("| Field | Value |", "|-------|-------|");
    for (const [k, v] of Object.entries(ctx.targets)) {
      lines.push(`| ${k} | \`${String(v)}\` |`);
    }
    lines.push("");
  }

  lines.push("## 6. Decision", "", `**${ctx.decision ?? "PENDING"}**`, "");
  if (ctx.nextGoPrompt) {
    const fence = "```";
    lines.push("**Exact next GO prompt:**", "", fence + "text", ctx.nextGoPrompt, fence, "");
  }

  lines.push(
    "**STOP.** This document does not authorize SOT, auto-rollout, production apply, Sanity mutation, Supabase mutation, or order-path changes.",
    "",
  );

  return lines.join("\n");
}

/**
 * @param {string} root
 * @param {string} task
 * @param {Record<string, unknown>} ctx
 */
export function writeEvidence(root, task, ctx) {
  const isoDate = new Date().toISOString().slice(0, 10);
  const relPath = path.join("docs", "evidence", `${task}-${isoDate}.md`);
  const absPath = path.join(root, relPath);
  const markdown = buildEvidenceMarkdown(task, isoDate, ctx);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, markdown, "utf8");
  return { relPath: relPath.replace(/\\/g, "/"), absPath, isoDate };
}

/**
 * @param {string} root
 * @param {Record<string, unknown>} report
 */
export function writeLatestReport(root, report) {
  const dir = path.join(root, ".go-operator");
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, "latest-report.json");
  fs.writeFileSync(abs, JSON.stringify(report, null, 2), "utf8");
  return abs;
}

/**
 * @param {string} root
 * @param {string} task
 * @param {{ targets?: Record<string, string>, workspace: Record<string, unknown>, mode: string, head?: string, runTests?: boolean }} input
 */
export async function runTaskChecks(root, task, input) {
  const checks = [];
  const tests = [];
  const targets = input.targets ?? {};

  if (task === "truth-freeze") {
    const truthExists = fs.existsSync(path.join(root, TRUTH_INDEX));
    checks.push({
      name: "truth index exists",
      ok: truthExists,
      detail: TRUTH_INDEX,
    });
    checks.push({
      name: "SOT runtime blocked in operator",
      ok: true,
      detail: "always forbidden",
    });
  }

  if (task === "f4b-readiness" || task === "f4b-production-apply-readiness") {
    const migPath = path.join(root, F4B_MIGRATION_FILE);
    const migExists = fs.existsSync(migPath);
    checks.push({ name: "F4b migration file", ok: migExists, detail: F4B_MIGRATION_FILE });
    if (migExists) {
      const sql = fs.readFileSync(migPath, "utf8");
      checks.push({
        name: "localized_generated_content branch",
        ok: sql.includes("localized_generated_content"),
      });
      checks.push({
        name: "no broad UPDATE/DELETE",
        ok: !/^\s*UPDATE\s+public\.menu_service_day_items/im.test(sql) && !/^\s*DELETE\s+FROM/im.test(sql),
      });
      checks.push({
        name: "RLS unchanged comment",
        ok: /RLS:\s*intentionally unchanged/i.test(sql),
      });
    }
  }

  if (task === "f4b-production-apply-readiness") {
    const f4bApplied = PRODUCTION_LEDGER_SNAPSHOT.includes(F4B_MIGRATION);
    checks.push({
      name: "F4b in production ledger snapshot",
      ok: f4bApplied,
      detail: f4bApplied ? "already applied" : "not applied",
    });

    const repoVersions = listRepoMigrationVersions(root);
    const pending = computePendingMigrations(repoVersions, PRODUCTION_LEDGER_SNAPSHOT);
    const pendingBilling = pending.filter((v) => PENDING_BILLING_MIGRATIONS.includes(v));
    checks.push({
      name: "pending billing migrations isolated",
      ok: pendingBilling.length === PENDING_BILLING_MIGRATIONS.length,
      detail: `${pendingBilling.length} billing migrations pending`,
    });
    checks.push({
      name: "bulk apply would not be F4b-only",
      ok: pending.length > 0,
      detail: `pending count: ${pending.length}`,
    });
  }

  if (task === "sot-dry-run") {
    const resolverPath = path.join(root, "lib/menu-generator/localizedGeneratorSotResolver.ts");
    checks.push({
      name: "SOT resolver module exists",
      ok: fs.existsSync(resolverPath),
    });
    checks.push({
      name: "SOT start forbidden",
      ok: true,
      detail: "operator hard block",
    });
  }

  if (task === "evidence-pr") {
    checks.push({
      name: "evidence-pr is docs-only packaging",
      ok: true,
      detail: "stages exact evidence file only",
    });
  }

  if (input.runTests !== false) {
    const cmds = TASK_TEST_COMMANDS[task] ?? [];
    for (const cmd of cmds) {
      const result = runCommand(cmd, root);
      tests.push({ cmd, ok: result.ok, output: result.output });
      if (!result.ok) {
        checks.push({ name: `test: ${cmd}`, ok: false, detail: "failed" });
      }
    }
  }

  const checksOk = checks.every((c) => c.ok);
  const testsOk = tests.every((t) => t.ok);

  let decision = "PASS";
  let nextGoPrompt = "";

  if (task === "f4b-production-apply-readiness") {
    const f4bApplied = PRODUCTION_LEDGER_SNAPSHOT.includes(F4B_MIGRATION);
    if (f4bApplied) {
      decision = "NOT READY — F4b already applied in production";
      nextGoPrompt =
        "GO Danish scoped SOT re-cutover verification — read-only production read-back first, SOT flags OFF unless explicit scoped GO, no auto-rollout";
    } else if (!checksOk || !testsOk) {
      decision = "NOT READY — BLOCKERS LISTED";
      nextGoPrompt = "GO fix F4b production apply blockers — source-only first, no production apply, no SOT start";
    } else {
      decision = "READY FOR F4B PRODUCTION APPLY GO";
      nextGoPrompt =
        "GO apply F4b localized SOT MSDI trigger alignment migration to production — explicit Supabase production apply, no SOT start, no auto-rollout";
    }
  } else if (task === "truth-freeze") {
    decision = checksOk && testsOk ? "PASS — truth freeze checks complete" : "NOT READY — BLOCKERS LISTED";
    nextGoPrompt = "GO merge GO operator evidence PR — docs-only, no production mutation";
  } else if (task === "f4b-readiness") {
    decision = checksOk && testsOk ? "PASS — F4b source readiness" : "NOT READY — BLOCKERS LISTED";
    nextGoPrompt =
      "GO F4b production apply readiness — read-only ledger check via GO Operator, no production apply";
  } else if (task === "sot-dry-run") {
    decision = checksOk && testsOk ? "PASS — SOT dry-run contracts" : "NOT READY — BLOCKERS LISTED";
    nextGoPrompt = "GO SOT cutover planning PR — implementation plan only, no SOT start, no production mutation";
  } else if (task === "evidence-pr") {
    decision = checksOk ? "PASS — evidence PR scope validated" : "NOT READY";
    nextGoPrompt = "GO merge GO operator evidence PR — docs-only, no production apply, no SOT start";
  }

  return {
    checks,
    tests,
    targets,
    decision,
    nextGoPrompt,
    ok: checksOk && testsOk,
    scope:
      task === "f4b-production-apply-readiness"
        ? "Read-only verification whether F4b migration apply GO is applicable."
        : `Automated GO Operator task \`${task}\` (read-only).`,
  };
}
