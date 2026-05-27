/**
 * Transitive keep-set closure from live importers (FASE A).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeStableJson } from "./lib/stable-json.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AI = path.join(ROOT, "lib/ai");

const ARCHIVE_PREFIXES = ["engines/", "reality/", "monopoly/", "boardroom/", "org/", "brain/"];
const ARCHIVE_ROOT = new Set([
  "omniscientContext.ts", "omniscientDecisionEngine.ts", "automationEngine.ts",
  "generativeEngine.ts", "prioritizationEngine.ts", "globalIntelligence.ts",
  "opportunityEngine.ts", "explainEngine.ts", "valueEngine.ts", "swarm.ts",
  "consensus.ts", "governor.ts", "capabilityRegistry.ts", "composeGlobalOs.ts",
  "composeOperationsAutonomy.ts", "procurementEngine.ts", "purchasePlanner.ts",
  "productionPlanner.ts", "routePlanner.ts", "costOptimizationEngine.ts", "supplierPlanner.ts",
  "businessStateEngine.ts", "businessDecisionEngine.ts", "growthStrategyEngine.ts",
  "pricingEngine.ts", "revenueLeakEngine.ts", "marketOpportunityEngine.ts",
  "marketRankingEngine.ts", "marketSimulationEngine.ts", "expansionEngine.ts",
  "autonomousGenerator.ts", "autonomousOpportunityEngine.ts", "saasIntelligenceEngine.ts",
  "saasPriorityEngine.ts", "saasStateEngine.ts", "revenueDecisionEngine.ts",
  "revenueEngine.ts", "revenueIntelligenceEngine.ts", "simulationEngine.ts",
]);

function norm(p) { return p.split(path.sep).join("/"); }
function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory() && !["node_modules", ".next", ".git"].includes(e.name)) walk(f, o);
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) o.push(f);
  }
  return o;
}
function countLoc(f) { return fs.readFileSync(f, "utf8").split("\n").length; }

function resolveImport(imp) {
  const cands = [
    path.join(AI, `${imp}.ts`),
    path.join(AI, imp, "index.ts"),
  ];
  const parts = imp.split("/");
  if (parts.length > 1) cands.push(path.join(AI, ...parts) + ".ts");
  for (const c of cands) if (fs.existsSync(c)) return norm(path.relative(AI, c));
  return null;
}

function isArchiveRel(rel) {
  if (!rel) return true;
  if (ARCHIVE_ROOT.has(rel)) return true;
  return ARCHIVE_PREFIXES.some((p) => rel.startsWith(p));
}

function extractImports(content) {
  const out = [];
  const re = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) out.push(m[1]);
  return out;
}

function extractInternalImports(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const out = [];
  const re = /from\s+["']\.\/?([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) {
    const rel = path.normalize(path.join(path.dirname(filePath), m[1]));
    const candidates = [rel + ".ts", path.join(rel, "index.ts")];
    for (const c of candidates) {
      if (fs.existsSync(c) && c.startsWith(AI)) {
        out.push(norm(path.relative(AI, c)));
        break;
      }
    }
  }
  const re2 = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  while ((m = re2.exec(content))) {
    const r = resolveImport(m[1]);
    if (r) out.push(r);
  }
  return out;
}

const keep = new Set();
const queue = [];

// Seed from app + lib (non-ai) + tests — skip archive imports
for (const root of ["app", "lib", "tests"]) {
  const base = path.join(ROOT, root);
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    const rel = norm(path.relative(ROOT, file));
    if (rel.startsWith("lib/ai/")) continue;
    // Skip cron routes slated for deletion
    if (rel.match(/^app\/api\/cron\//)) continue;
    // Skip archive-only API routes
    if (rel === "app/api/ai/automation/route.ts") continue;
    if (rel === "app/api/ai/swarm/route.ts") continue;

    for (const imp of extractImports(fs.readFileSync(file, "utf8"))) {
      const resolved = resolveImport(imp);
      if (resolved && !isArchiveRel(resolved) && !keep.has(resolved)) {
        keep.add(resolved);
        queue.push(resolved);
      }
    }
  }
}

while (queue.length) {
  const cur = queue.shift();
  const full = path.join(AI, cur);
  if (!fs.existsSync(full)) continue;
  for (const dep of extractInternalImports(full)) {
    if (!isArchiveRel(dep) && !keep.has(dep)) {
      keep.add(dep);
      queue.push(dep);
    }
  }
}

const allAi = walk(AI).map((f) => norm(path.relative(AI, f)));
const archiveFiles = allAi.filter((r) => isArchiveRel(r)).sort();
const keepFiles = [...keep].sort();
const orphanFiles = allAi.filter((r) => !isArchiveRel(r) && !keep.has(r)).sort();

let keepLoc = 0, archiveLoc = 0, orphanLoc = 0;
for (const f of walk(AI)) {
  const rel = norm(path.relative(AI, f));
  const loc = countLoc(f);
  if (isArchiveRel(rel)) archiveLoc += loc;
  else if (keep.has(rel)) keepLoc += loc;
  else orphanLoc += loc;
}

console.log(JSON.stringify({
  keep: { files: keepFiles.length, loc: keepLoc, paths: keepFiles },
  archive: { files: archiveFiles.length, loc: archiveLoc },
  orphan: { files: orphanFiles.length, loc: orphanLoc, paths: orphanFiles },
  total: { files: allAi.length, loc: keepLoc + archiveLoc + orphanLoc },
}, null, 2));

writeStableJson(path.join(ROOT, "scripts/audit/lib-ai-keep-closure.json"), {
  keepFiles,
  archiveFiles,
  orphanFiles,
});
