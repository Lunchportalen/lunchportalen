/**
 * Converts repo-intelligence/auditReport.json → repo-intelligence/tasks.json
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import type { AuditIssue, AuditReport } from "./audit/auditCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "repo-intelligence", "auditReport.json");
const OUT_PATH = path.join(ROOT, "repo-intelligence", "tasks.json");

export type TaskRecord = {
  id: string;
  type: "fix" | "connect" | "optimize";
  target: string;
  description: string;
  impact: "high" | "medium" | "low";
  code: string;
  automatable: boolean;
  source_issue_id: string;
};

const IMPACT_RANK: Record<TaskRecord["impact"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CRITICALITY: Record<AuditIssue["severity"], TaskRecord["impact"]> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};

function inferTaskType(code: string): TaskRecord["type"] {
  if (code.includes("FETCH") || code.includes("FLOW") || code.includes("CONNECT")) return "connect";
  if (code.includes("UNUSED") || code.includes("CONSOLE") || code.includes("HEURISTIC")) return "optimize";
  return "fix";
}

function stableTaskId(issue: AuditIssue): string {
  return createHash("sha256")
    .update([issue.code, issue.id, issue.message].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function automatableFor(code: string): boolean {
  /** Only pattern-based fixes wired in scripts/autoFix.ts (safe registry). */
  return code === "CONSOLE_ERROR_USAGE";
}

function issueToTask(issue: AuditIssue, bucket: string): TaskRecord {
  const id = stableTaskId(issue);
  const target =
    issue.files && issue.files.length > 0
      ? issue.files.slice(0, 3).join(", ")
      : bucket + ":" + issue.code;
  return {
    id,
    type: inferTaskType(issue.code),
    target,
    description: issue.message,
    impact: CRITICALITY[issue.severity] ?? "medium",
    code: issue.code,
    automatable: automatableFor(issue.code),
    source_issue_id: issue.id,
  };
}

function loadAudit(): AuditReport {
  const raw = fs.readFileSync(AUDIT_PATH, "utf8");
  return JSON.parse(raw) as AuditReport;
}

function main() {
  if (!fs.existsSync(AUDIT_PATH)) {
    console.error(`[buildTasks] Missing ${AUDIT_PATH}. Run npm run audit:generate first.`);
    process.exit(1);
  }
  const audit = loadAudit();
  const tasks: TaskRecord[] = [
    ...audit.critical_blockers.map((i) => issueToTask(i, "critical_blockers")),
    ...audit.missing.map((i) => issueToTask(i, "missing")),
    ...audit.partial.map((i) => issueToTask(i, "partial")),
  ];

  tasks.sort((a, b) => {
    const ir = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
    if (ir !== 0) return ir;
    return a.id.localeCompare(b.id);
  });

  const payload = {
    generated_at: new Date().toISOString(),
    audit_generated_at: audit.generated_at,
    tasks,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[buildTasks] Wrote ${OUT_PATH} (${tasks.length} tasks)`);
}

main();
