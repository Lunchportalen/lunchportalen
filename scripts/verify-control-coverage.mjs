// scripts/verify-control-coverage.mjs
// Keep scan rules in sync with lib/system/controlCoverage.ts
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");
const LOCK_PATH = path.join(ROOT, "config", "control-coverage-violation-lock.json");
const MARKERS_PATH = path.join(ROOT, "reports", "control-coverage-markers.json");

const AI_LIB_IMPORT_RE = /@\/lib\/ai\//;
const WITH_AI_ENTRY_RE = /withApiAiEntrypoint/;
const RUNTIME_EDGE_RE = /export\s+const\s+runtime\s*=\s*["']edge["']/;
const MUTATING_EXPORT_RE = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/g;
const CMS_GATE_CALL_RE = /withCmsPageDocumentGate\s*\(/;

const SUGGEST_AI =
  'Wrap this route handler with withApiAiEntrypoint from @/lib/http/withApiAiEntrypoint (return withApiAiEntrypoint(req, "METHOD", async () => { ... })).';
const SUGGEST_CMS =
  "Wrap mutating handler body with withCmsPageDocumentGate from @/lib/cms/cmsPageDocumentGate.";

function sortUnique(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function normalizeRel(full, root) {
  return full.slice(root.length + 1).split(path.sep).join("/");
}

function* walkFiles(dir, pred) {
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

function isGrowthScopedRel(rel) {
  return (
    rel.startsWith("app/api/ai/growth/") ||
    rel.startsWith("app/api/ai/experiments/") ||
    rel.includes("/api/backoffice/experiments/") ||
    rel.startsWith("app/api/experiments/")
  );
}

function scan() {
  const aiViolations = [];
  const cmsViolations = [];
  const growthViolations = [];

  let aiTotal = 0;
  let aiWrapped = 0;
  let cmsMutateTotal = 0;
  let cmsMutateGated = 0;

  for (const full of walkFiles(API_DIR, (n) => n === "route.ts")) {
    const rel = normalizeRel(full, ROOT);
    let src;
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
      if (edgeOnly) continue;

      aiTotal += 1;
      const wrapped = WITH_AI_ENTRY_RE.test(src);
      WITH_AI_ENTRY_RE.lastIndex = 0;
      if (wrapped) {
        aiWrapped += 1;
      } else {
        aiViolations.push(rel);
      }

      if (isGrowthScopedRel(rel)) {
        if (wrapped) {
          /* ok */
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

  const aiCoverage = aiTotal === 0 ? 100 : Math.round((100 * aiWrapped) / aiTotal);
  const cmsCoverage =
    cmsMutateTotal === 0 ? 100 : Math.round((100 * cmsMutateGated) / cmsMutateTotal);

  return {
    aiViolations: sortUnique(aiViolations),
    cmsViolations: sortUnique(cmsViolations),
    growthViolations: sortUnique(growthViolations),
    aiCoverage,
    cmsCoverage,
    aiTotal,
    cmsMutateTotal,
  };
}

function loadLock() {
  if (!fs.existsSync(LOCK_PATH)) {
    return { version: 1, ai: [], cms: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
    const ai = sortUnique(Array.isArray(raw.ai) ? raw.ai : []);
    const cms = sortUnique(Array.isArray(raw.cms) ? raw.cms : []);
    return { version: raw.version ?? 1, ai, cms };
  } catch (e) {
    console.error("[CONTROL] Invalid lock file:", LOCK_PATH, e);
    process.exit(1);
  }
}

function writeMarkers(report) {
  const markers = [];
  for (const path of report.aiViolations) {
    markers.push({ path, domain: "ai", suggestion: SUGGEST_AI });
  }
  for (const path of report.cmsViolations) {
    markers.push({ path, domain: "cms", suggestion: SUGGEST_CMS });
  }
  for (const path of report.growthViolations) {
    markers.push({ path, domain: "growth", suggestion: SUGGEST_AI });
  }

  const dir = path.dirname(MARKERS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    MARKERS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ci: String(process.env.CI || ""),
        markers,
        metrics: {
          aiCoverage: report.aiCoverage,
          cmsCoverage: report.cmsCoverage,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

function main() {
  const report = scan();
  writeMarkers(report);

  const lock = loadLock();
  const lockAi = JSON.stringify(lock.ai);
  const lockCms = JSON.stringify(lock.cms);
  const curAi = JSON.stringify(report.aiViolations);
  const curCms = JSON.stringify(report.cmsViolations);

  if (lockAi !== curAi || lockCms !== curCms) {
    console.error("[CONTROL] CONTROL_COVERAGE_LOCK_DRIFT: config/control-coverage-violation-lock.json must match current violations.");
    console.error("  Lock AI:", lock.ai);
    console.error("  Curr AI:", report.aiViolations);
    console.error("  Lock CMS:", lock.cms);
    console.error("  Curr CMS:", report.cmsViolations);
    console.error("  Update the lock only in a reviewed PR after fixing or explicitly accepting debt (coverage gate may still fail).");
    for (const m of [
      ...report.aiViolations.map((path) => ({ path, domain: "AI", suggestion: SUGGEST_AI })),
      ...report.cmsViolations.map((path) => ({ path, domain: "CMS", suggestion: SUGGEST_CMS })),
    ]) {
      console.error(`[CONTROL][${m.domain}] ${m.path}`);
      console.error(`  → ${m.suggestion}`);
    }
    process.exit(1);
  }

  if (report.aiCoverage < 100 || report.cmsCoverage < 100) {
    console.error(
      `[CONTROL] CONTROL_COVERAGE_UNDER_100: aiCoverage=${report.aiCoverage}% (need 100), cmsCoverage=${report.cmsCoverage}% (need 100).`,
    );
    console.error(`  AI routes (non-edge) scanned: ${report.aiTotal}, CMS mutate route files: ${report.cmsMutateTotal}`);
    for (const p of report.aiViolations) {
      console.error(`[CONTROL][AI] ${p}`);
      console.error(`  → ${SUGGEST_AI}`);
    }
    for (const p of report.cmsViolations) {
      console.error(`[CONTROL][CMS] ${p}`);
      console.error(`  → ${SUGGEST_CMS}`);
    }
    process.exit(1);
  }

  console.log("[CONTROL] Coverage OK: AI 100%, CMS 100%, lock in sync.");
  console.log(`[CONTROL] Markers written: ${path.relative(ROOT, MARKERS_PATH)}`);
}

main();
