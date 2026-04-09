import "server-only";

import fs from "fs";
import path from "path";

const AI_LIB_IMPORT_RE = /@\/lib\/ai\//;
const WITH_AI_ENTRY_RE = /withApiAiEntrypoint/;
const RUNTIME_EDGE_RE = /export\s+const\s+runtime\s*=\s*["']edge["']/;

const MUTATING_EXPORT_RE =
  /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/g;
const CMS_GATE_CALL_RE = /withCmsPageDocumentGate\s*\(/;

const LEGACY_UI_BUTTON_RE = /from\s+["']@\/components\/ui\/button["']/;
const DS_UI_RE = /from\s+["']@\/components\/ui\/ds(\/|["'])/;

export type SystemHealthMetrics = {
  aiCoverage: number;
  cmsCoverage: number;
  dsUsage: number;
  growthIsolation: number;
};

export type ControlCoverageReport = {
  metrics: SystemHealthMetrics;
  aiViolations: string[];
  cmsViolations: string[];
  growthViolations: string[];
  dsLegacyFiles: string[];
  dsDsFiles: string[];
};

/** Marked violation for CI artifacts and logs (STEP 3 / STEP 4). */
export type ControlViolationMarker = {
  path: string;
  domain: "ai" | "cms" | "growth";
  suggestion: string;
};

const SUGGEST_AI = "Wrap this route handler with withApiAiEntrypoint from @/lib/http/withApiAiEntrypoint (return withApiAiEntrypoint(req, \"POST\", async () => { ... })).";
const SUGGEST_CMS =
  "Wrap mutating handler body with withCmsPageDocumentGate from @/lib/cms/cmsPageDocumentGate (return withCmsPageDocumentGate(\"source-id\", async () => { ... })).";
const SUGGEST_GROWTH = `${SUGGEST_AI} (Growth/experiments routes must stay entrypoint-attributed.)`;

export function getControlViolationMarkers(report: ControlCoverageReport): ControlViolationMarker[] {
  const out: ControlViolationMarker[] = [];
  for (const path of report.aiViolations) {
    out.push({ path, domain: "ai", suggestion: SUGGEST_AI });
  }
  for (const path of report.cmsViolations) {
    out.push({ path, domain: "cms", suggestion: SUGGEST_CMS });
  }
  for (const path of report.growthViolations) {
    out.push({ path, domain: "growth", suggestion: SUGGEST_GROWTH });
  }
  return out;
}

export function logControlCoverageSuggestions(report: ControlCoverageReport): void {
  for (const m of getControlViolationMarkers(report)) {
    console.error(`[CONTROL][${m.domain.toUpperCase()}] ${m.path}`);
    console.error(`  → ${m.suggestion}`);
  }
}

function repoRoot(): string {
  return process.cwd();
}

function normalizeRel(full: string, root: string): string {
  return full.slice(root.length + 1).split(path.sep).join("/");
}

function* walkFiles(dir: string, pred: (name: string) => boolean): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      yield* walkFiles(full, pred);
    } else if (pred(e.name)) {
      yield full;
    }
  }
}

function isGrowthScopedRel(rel: string): boolean {
  return (
    rel.startsWith("app/api/ai/growth/") ||
    rel.startsWith("app/api/ai/experiments/") ||
    rel.includes("/api/backoffice/experiments/") ||
    rel.startsWith("app/api/experiments/")
  );
}

/**
 * Static scan of the repo: expected AI/CMS/DS/growth discipline.
 * Does not use runtime counters — safe to call from instrumentation or admin tooling.
 */
export function getControlCoverageReport(): ControlCoverageReport {
  if (typeof window !== "undefined") {
    throw new Error("controlCoverage must not run in browser");
  }
  const root = repoRoot();
  const apiDir = path.join(root, "app", "api");

  const aiViolations: string[] = [];
  const cmsViolations: string[] = [];
  const growthViolations: string[] = [];
  const dsLegacySet = new Set<string>();
  const dsDsSet = new Set<string>();

  let aiTotal = 0;
  let aiWrapped = 0;
  let growthTotal = 0;
  let growthWrapped = 0;
  let cmsMutateTotal = 0;
  let cmsMutateGated = 0;

  for (const full of walkFiles(apiDir, (n) => n === "route.ts")) {
    const rel = normalizeRel(full, root);
    let src: string;
    try {
      src = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }

    const usesAiLib = AI_LIB_IMPORT_RE.test(src);
    AI_LIB_IMPORT_RE.lastIndex = 0;
    if (usesAiLib) {
      const edgeOnly = RUNTIME_EDGE_RE.test(src);
      RUNTIME_EDGE_RE.lastIndex = 0;
      if (edgeOnly) {
        continue;
      }
      aiTotal += 1;
      const wrapped = WITH_AI_ENTRY_RE.test(src);
      WITH_AI_ENTRY_RE.lastIndex = 0;
      if (wrapped) {
        aiWrapped += 1;
      } else {
        aiViolations.push(rel);
      }

      if (isGrowthScopedRel(rel)) {
        growthTotal += 1;
        if (wrapped) {
          growthWrapped += 1;
        } else {
          growthViolations.push(rel);
        }
      }
    }

    if (rel.startsWith("app/api/backoffice/content/")) {
      const mutating = [...src.matchAll(MUTATING_EXPORT_RE)];
      MUTATING_EXPORT_RE.lastIndex = 0;
      if (mutating.length === 0) continue;
      cmsMutateTotal += 1;
      if (CMS_GATE_CALL_RE.test(src)) {
        CMS_GATE_CALL_RE.lastIndex = 0;
        cmsMutateGated += 1;
      } else {
        CMS_GATE_CALL_RE.lastIndex = 0;
        cmsViolations.push(rel);
      }
    }
  }

  const scanDirs = [
    path.join(root, "app"),
    path.join(root, "components"),
  ].filter((d) => fs.existsSync(d));

  for (const base of scanDirs) {
    for (const full of walkFiles(base, (n) => n.endsWith(".tsx") || n.endsWith(".ts"))) {
      if (full.includes(`${path.sep}node_modules${path.sep}`)) continue;
      let src: string;
      try {
        src = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const rel = normalizeRel(full, root);
      const legacy = LEGACY_UI_BUTTON_RE.test(src);
      LEGACY_UI_BUTTON_RE.lastIndex = 0;
      const ds = DS_UI_RE.test(src);
      DS_UI_RE.lastIndex = 0;
      if (ds) dsDsSet.add(rel);
      if (legacy && !ds) dsLegacySet.add(rel);
    }
  }

  const aiCoverage = aiTotal === 0 ? 100 : Math.round((100 * aiWrapped) / aiTotal);
  const cmsCoverage =
    cmsMutateTotal === 0 ? 100 : Math.round((100 * cmsMutateGated) / cmsMutateTotal);
  const growthIsolation =
    growthTotal === 0 ? 100 : Math.round((100 * growthWrapped) / growthTotal);
  const dsDsFiles = [...dsDsSet];
  const dsLegacyFiles = [...dsLegacySet];
  const denom = dsDsFiles.length + dsLegacyFiles.length;
  const dsUsage = denom === 0 ? 100 : Math.round((100 * dsDsFiles.length) / denom);

  return {
    metrics: {
      aiCoverage,
      cmsCoverage,
      dsUsage,
      growthIsolation,
    },
    aiViolations,
    cmsViolations,
    growthViolations,
    dsLegacyFiles,
    dsDsFiles,
  };
}

/** Compact percentages for dashboards and APIs. */
export function getSystemHealth(): SystemHealthMetrics {
  return getControlCoverageReport().metrics;
}

/** Log AI/CMS/growth violations to stderr (dev / CI). */
export function logControlCoverageErrors(): void {
  const r = getControlCoverageReport();
  for (const p of r.aiViolations) {
    console.error(`[CONTROL][AI] Missing withApiAiEntrypoint: ${p}`);
  }
  for (const p of r.cmsViolations) {
    console.error(`[CONTROL][CMS] Missing withCmsPageDocumentGate on mutating handler: ${p}`);
  }
  for (const p of r.growthViolations) {
    console.error(`[CONTROL][GROWTH] AI route not entrypoint-wrapped: ${p}`);
  }
  if (r.aiViolations.length || r.cmsViolations.length || r.growthViolations.length) {
    logControlCoverageSuggestions(r);
  }
}

/** Dev server: one-line control summary. */
export function logDevControlPlaneSummary(): void {
  const { metrics } = getControlCoverageReport();
  console.info(`[Lunchportalen] AI control: ${metrics.aiCoverage}%`);
  console.info(`[Lunchportalen] CMS control: ${metrics.cmsCoverage}%`);
  console.info(`[Lunchportalen] DS usage (import scan): ${metrics.dsUsage}%`);
  console.info(`[Lunchportalen] Growth/experiments AI isolation: ${metrics.growthIsolation}%`);
}
