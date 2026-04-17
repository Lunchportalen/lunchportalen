/**
 * Writes ./fullAudit.json — flat buckets: flows, frontend, backend, ai, ux, data.
 * Deterministic: derived from repo-intelligence/fullAudit.json + auditReport.json.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FULL = path.join(ROOT, "repo-intelligence", "fullAudit.json");
const OUT = path.join(ROOT, "fullAudit.json");

type BucketItem = Record<string, unknown>;

function isBackendPath(p: string): boolean {
  return p.includes("app/api/") || p.startsWith("app/api/") || p.includes("/api/");
}

function isFrontendPath(p: string): boolean {
  return (
    (p.includes("components/") && !p.includes("node_modules")) ||
    /app\/\([^)]+\)\//.test(p) ||
    /\/page\.tsx$/.test(p) ||
    (p.startsWith("app/") && !p.includes("app/api/"))
  );
}

function splitPerformanceToLayers(
  perf: BucketItem[]
): { frontend: BucketItem[]; backend: BucketItem[] } {
  const frontend: BucketItem[] = [];
  const backend: BucketItem[] = [];
  for (const item of perf) {
    const files = Array.isArray(item.files) ? (item.files as string[]) : [];
    const code = typeof item.code === "string" ? item.code : "";
    let fB = false;
    let fF = false;
    for (const f of files.slice(0, 80)) {
      const fp = f.split(":")[0] ?? f;
      if (isBackendPath(fp)) fB = true;
      if (isFrontendPath(fp)) fF = true;
    }
    if (code === "API_NO_DB_HINT" || (fB && !fF)) backend.push(item);
    else if (fF || code === "CONSOLE_ERROR_USAGE") frontend.push(item);
    else backend.push(item);
  }
  return { frontend, backend };
}

function main() {
  if (!fs.existsSync(FULL)) {
    console.error("[exportFlatAudit] Run npm run audit:full first (needs repo-intelligence/fullAudit.json).");
    process.exit(1);
  }
  const full = JSON.parse(fs.readFileSync(FULL, "utf8")) as Record<string, unknown>;

  const flows = (full.flows as unknown[]) ?? [];
  const ai = (full.ai as BucketItem[]) ?? [];
  const ux = (full.ux as BucketItem[]) ?? [];
  const data = (full.data as BucketItem[]) ?? [];
  const perf = (full.performance as BucketItem[]) ?? [];
  const critical = (full.critical as BucketItem[]) ?? [];

  const { frontend: perfFe, backend: perfBe } = splitPerformanceToLayers(perf);

  const frontend: BucketItem[] = [...ux.map((x) => ({ ...x, layer: "ux" })), ...perfFe.map((x) => ({ ...x, layer: "performance" }))];
  const backend: BucketItem[] = [
    ...critical.map((x) => ({ ...x, layer: "critical" })),
    ...perfBe.map((x) => ({ ...x, layer: "performance" })),
  ];

  /** Spec: exactly six buckets (see AGENTS / audit workflow). Provenance: repo-intelligence/fullAudit.json */
  const doc = {
    flows,
    frontend,
    backend,
    ai,
    ux,
    data,
  };

  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), "utf8");
  console.log(
    `[exportFlatAudit] Wrote ${OUT} (flows=${flows.length}, frontend=${frontend.length}, backend=${backend.length}, ai=${ai.length}, ux=${ux.length}, data=${data.length})`
  );
}

main();
