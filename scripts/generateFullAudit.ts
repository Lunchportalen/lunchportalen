/**
 * Writes repo-intelligence/fullAudit.json — master audit buckets (critical, flows, ai, ux, performance, data).
 * Deterministic: uses auditCore.generateAuditReport(), repo-intelligence/flows.json, and a small synthetic registry.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { generateAuditReport, type AuditIssue } from "./audit/auditCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "repo-intelligence");
const OUT_FILE = path.join(OUT_DIR, "fullAudit.json");
const FLOWS_FILE = path.join(OUT_DIR, "flows.json");

export type FullAuditBucketItem = {
  id: string;
  bucket: "critical" | "flows" | "ai" | "ux" | "performance" | "data";
  code: string;
  severity: AuditIssue["severity"];
  summary: string;
  files?: string[];
  evidence?: string;
  /** Optional extra context (e.g. flow step list). */
  meta?: Record<string, unknown>;
};

export type FlowGraphEntry = {
  kind: "flow_graph";
  name: string;
  confidence: string;
  steps: string[];
  inference: string;
};

export type FullAuditDocument = {
  schema_version: 1;
  generated_at: string;
  repo_root: string;
  sources: string[];
  critical: FullAuditBucketItem[];
  flows: Array<FullAuditBucketItem | FlowGraphEntry>;
  ai: FullAuditBucketItem[];
  ux: FullAuditBucketItem[];
  performance: FullAuditBucketItem[];
  data: FullAuditBucketItem[];
};

function sid(parts: string[]): string {
  return `FA_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16)}`;
}

function issueToBucketItem(
  bucket: FullAuditBucketItem["bucket"],
  issue: AuditIssue,
  extraMeta?: Record<string, unknown>
): FullAuditBucketItem {
  return {
    id: issue.id,
    bucket,
    code: issue.code,
    severity: issue.severity,
    summary: issue.message,
    files: issue.files,
    evidence: issue.evidence,
    meta: extraMeta,
  };
}

function classifyAuditIssue(issue: AuditIssue): FullAuditBucketItem["bucket"] | "skip" {
  const c = issue.code;
  if (c === "FLOW_SOCIAL_LEAD_ORDER_PARTIAL" || (c.startsWith("FLOW") && c.includes("SOCIAL"))) return "flows";
  if (c === "TABLE_NOT_IN_DATABASE_TS") {
    if (/ai_|ceo|autonomy|enterprise_revenue/i.test(issue.message)) return "ai";
    return "data";
  }
  if (c === "AI_SOCIAL_PERSIST_HEURISTIC") return "ai";
  if (c === "LAYOUT_WITHOUT_PAGES") return "ux";
  if (c === "CONSOLE_ERROR_USAGE" || c === "API_NO_DB_HINT") return "performance";
  if (c === "FETCH_REFERENCE_UNRESOLVED") return "data";
  if (c === "MISSING_CANONICAL_ROUTE" || c === "SUPABASE_FROM_STAR") return "critical";
  if (c === "POTENTIALLY_UNUSED_DEV_API") return "skip";
  return "data";
}

const SYNTHETIC: FullAuditBucketItem[] = [
  {
    id: sid(["SYN", "WORKER_QUEUE_STUBS"]),
    bucket: "ai",
    code: "WORKER_QUEUE_STUBS",
    severity: "medium",
    summary:
      "workers/worker.ts: job types send_email, ai_generate, experiment_run are log-only stubs (no SMTP / AI / experiment runner).",
    files: ["workers/worker.ts"],
    evidence: "read_source",
    meta: { jobTypes: ["send_email", "ai_generate", "experiment_run"] },
  },
  {
    id: sid(["SYN", "META_ADS_MOCK"]),
    bucket: "ai",
    code: "META_ADS_MOCK",
    severity: "low",
    summary: "lib/ads/meta.ts: createMetaCampaign returns mock_created until real Meta integration is enabled.",
    files: ["lib/ads/meta.ts"],
    evidence: "read_source",
  },
];

function loadFlowGraph(): FlowGraphEntry[] {
  if (!fs.existsSync(FLOWS_FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(FLOWS_FILE, "utf8")) as { flows?: unknown };
  const flows = raw.flows;
  if (!Array.isArray(flows)) return [];
  const out: FlowGraphEntry[] = [];
  for (const f of flows) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "unnamed";
    const confidence = typeof o.confidence === "string" ? o.confidence : "unknown";
    const steps = Array.isArray(o.steps) ? o.steps.map((s) => String(s)) : [];
    const inference = typeof o.inference === "string" ? o.inference : "";
    out.push({ kind: "flow_graph", name, confidence, steps, inference });
  }
  return out;
}

function buildFullAudit(): FullAuditDocument {
  const report = generateAuditReport();
  const generated_at = new Date().toISOString();

  const critical: FullAuditBucketItem[] = [];
  const flows: Array<FullAuditBucketItem | FlowGraphEntry> = [...loadFlowGraph()];
  const ai: FullAuditBucketItem[] = [];
  const ux: FullAuditBucketItem[] = [];
  const performance: FullAuditBucketItem[] = [];
  const data: FullAuditBucketItem[] = [];

  for (const issue of report.critical_blockers) {
    critical.push(issueToBucketItem("critical", issue));
  }

  const buckets = [...report.missing, ...report.partial];
  for (const issue of buckets) {
    const b = classifyAuditIssue(issue);
    if (b === "skip") continue;
    const item = issueToBucketItem(b, issue);
    if (b === "flows") flows.push(item);
    else if (b === "ai") ai.push(item);
    else if (b === "ux") ux.push(item);
    else if (b === "performance") performance.push(item);
    else data.push(item);
  }

  for (const s of SYNTHETIC) {
    if (s.bucket === "ai") ai.push(s);
  }

  /** Promote table-not-in-ts that reference ai_* tables into ai bucket as well (cross-cutting). */
  for (const issue of report.missing) {
    if (issue.code !== "TABLE_NOT_IN_DATABASE_TS") continue;
    if (!/ai_/i.test(issue.message)) continue;
    if (!ai.some((x) => x.id === issue.id)) {
      ai.push(issueToBucketItem("ai", issue, { also_in: "data" }));
    }
  }

  const sortFn = (a: FullAuditBucketItem, b: FullAuditBucketItem) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const s = order[a.severity] - order[b.severity];
    if (s !== 0) return s;
    return a.code.localeCompare(b.code);
  };
  critical.sort(sortFn);
  const graph = flows.filter((x): x is FlowGraphEntry => "kind" in x && x.kind === "flow_graph");
  const flowFindings = flows.filter((x): x is FullAuditBucketItem => !("kind" in x));
  graph.sort((a, b) => a.name.localeCompare(b.name));
  flowFindings.sort(sortFn);
  const flowsMerged: Array<FullAuditBucketItem | FlowGraphEntry> = [...graph, ...flowFindings];
  flows.length = 0;
  flows.push(...flowsMerged);
  ai.sort(sortFn);
  ux.sort(sortFn);
  performance.sort(sortFn);
  data.sort(sortFn);

  return {
    schema_version: 1,
    generated_at,
    repo_root: report.repo_root,
    sources: [
      "scripts/audit/auditCore.generateAuditReport",
      "repo-intelligence/flows.json",
      "synthetic:integration_gaps",
    ],
    critical,
    flows,
    ai,
    ux,
    performance,
    data,
  };
}

function main() {
  const doc = buildFullAudit();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(doc, null, 2), "utf8");
  console.log(
    `[generateFullAudit] Wrote ${OUT_FILE} (critical=${doc.critical.length}, flows=${doc.flows.length}, ai=${doc.ai.length}, ux=${doc.ux.length}, performance=${doc.performance.length}, data=${doc.data.length})`
  );
}

main();
