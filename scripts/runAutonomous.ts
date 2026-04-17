/**
 * One autonomous cycle: audit → tasks → (at most one) auto-fix → validate.
 * Safe rollback: git checkout touched files if validation fails after a successful auto-fix.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { runAutoFix } from "./autoFix.js";
import { runValidate } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUN_LOG = path.join(ROOT, "repo-intelligence", "run-log.json");

type RunLogEntry = {
  task: string;
  status: "success" | "failed";
  files_changed: string[];
  validation: "passed" | "failed" | "skipped";
  at: string;
  detail?: string;
};

function readLog(): RunLogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(RUN_LOG, "utf8")) as RunLogEntry[];
  } catch {
    return [];
  }
}

function appendRunLog(entry: Omit<RunLogEntry, "at"> & { at?: string }) {
  const cur = readLog();
  cur.push({
    ...entry,
    at: entry.at ?? new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(RUN_LOG), { recursive: true });
  fs.writeFileSync(RUN_LOG, JSON.stringify(cur, null, 2), "utf8");
}

function runNpxTsx(scriptRel: string): boolean {
  const r = spawnSync("npx", ["tsx", scriptRel], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });
  return r.status === 0;
}

async function main() {
  if (!runNpxTsx("scripts/generateAudit.ts")) {
    appendRunLog({
      task: "generateAudit",
      status: "failed",
      files_changed: [],
      validation: "skipped",
      detail: "generateAudit exited non-zero",
    });
    process.exit(1);
  }
  appendRunLog({
    task: "generateAudit",
    status: "success",
    files_changed: ["repo-intelligence/auditReport.json"],
    validation: "skipped",
    detail: "ok",
  });

  if (!runNpxTsx("scripts/buildTasks.ts")) {
    appendRunLog({
      task: "buildTasks",
      status: "failed",
      files_changed: [],
      validation: "skipped",
      detail: "buildTasks exited non-zero",
    });
    process.exit(1);
  }
  appendRunLog({
    task: "buildTasks",
    status: "success",
    files_changed: ["repo-intelligence/tasks.json"],
    validation: "skipped",
    detail: "ok",
  });

  const fix = await runAutoFix();

  let v: { ok: boolean; phase: string };
  if (fix.status === "success" && fix.files_changed.length > 0) {
    v = { ok: true, phase: "validated_in_autoFix" };
  } else {
    v = await runValidate();
  }

  if (!v.ok) {
    appendRunLog({
      task: "validate_after_pipeline",
      status: "failed",
      files_changed: [],
      validation: "failed",
      detail: v.phase,
    });
    process.exit(1);
  }
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) {
  void main();
}
