/**
 * Writes ./prioritizedTasks.json from repo-intelligence/auditReport.json
 * Priority: critical → FETCH_REFERENCE → TABLE_NOT_IN_DATABASE → rest (by severity).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { AuditIssue } from "./audit/auditCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "repo-intelligence", "auditReport.json");
const OUT = path.join(ROOT, "prioritizedTasks.json");

type TaskOut = {
  type: "connect" | "fix" | "improve";
  layer: "frontend" | "backend" | "api" | "ai" | "data" | "ux";
  target: string;
  description: string;
  impact: "high" | "medium" | "low";
  code: string;
};

const SEV: Record<AuditIssue["severity"], TaskOut["impact"]> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
};

function inferType(code: string): TaskOut["type"] {
  if (/FETCH|FLOW|CONNECT|UNRESOLVED/i.test(code)) return "connect";
  if (/CONSOLE|UNUSED|HEURISTIC|POTENTIALLY_UNUSED/i.test(code)) return "improve";
  return "fix";
}

function inferLayer(issue: AuditIssue): TaskOut["layer"] {
  const c = issue.code;
  if (c === "LAYOUT_WITHOUT_PAGES") return "ux";
  if (c.includes("AI_") || /ai_/i.test(issue.message)) return "ai";
  const f = issue.files?.[0]?.split(":")[0] ?? "";
  if (f.includes("app/api/")) return "api";
  if (f.includes("components/") || /app\/\([^)]+\)\//.test(f)) return "frontend";
  if (c === "TABLE_NOT_IN_DATABASE_TS") return "data";
  return "backend";
}

function rank(code: string): number {
  if (code === "FETCH_REFERENCE_UNRESOLVED") return 0;
  if (code === "TABLE_NOT_IN_DATABASE_TS") return 1;
  if (code === "MISSING_CANONICAL_ROUTE") return -1;
  return 10;
}

function main() {
  if (!fs.existsSync(AUDIT_PATH)) {
    console.error(`[exportPrioritizedTasks] Missing ${AUDIT_PATH}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8")) as {
    generated_at?: string;
    critical_blockers: AuditIssue[];
    missing: AuditIssue[];
    partial: AuditIssue[];
  };

  const all: AuditIssue[] = [
    ...raw.critical_blockers,
    ...raw.missing,
    ...raw.partial,
  ];

  all.sort((a, b) => {
    const dr = rank(a.code) - rank(b.code);
    if (dr !== 0) return dr;
    const imp = { high: 0, medium: 1, low: 2 } as const;
    const ir = imp[SEV[a.severity]] - imp[SEV[b.severity]];
    if (ir !== 0) return ir;
    return a.code.localeCompare(b.code);
  });

  const tasks: TaskOut[] = all.map((issue) => ({
    type: inferType(issue.code),
    layer: inferLayer(issue),
    target:
      issue.files && issue.files.length > 0
        ? issue.files.slice(0, 3).join(", ")
        : issue.message.length > 160
          ? `${issue.message.slice(0, 157)}…`
          : issue.message,
    description: issue.message,
    impact: SEV[issue.severity] ?? "medium",
    code: issue.code,
  }));

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        audit_generated_at: raw.generated_at ?? null,
        tasks,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[exportPrioritizedTasks] Wrote ${OUT} (${tasks.length} tasks)`);
}

main();
