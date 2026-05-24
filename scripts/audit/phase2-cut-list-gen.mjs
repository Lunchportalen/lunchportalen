/**
 * Phase 2 cut-list generator (FASE A) — READ-ONLY.
 * Output: docs/strategy/phase2-cut-list-2026-05-26.md + .json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AI = path.join(ROOT, "lib/ai");
const OUT_MD = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.md");
const OUT_JSON = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.json");

function norm(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, out = [], ext = ".ts") {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory() && !["node_modules", ".next", ".git"].includes(ent.name)) {
      walk(full, out, ext);
    } else if (ent.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

function countLoc(file) {
  return fs.readFileSync(file, "utf8").split("\n").length;
}

function resolveImport(imp) {
  const cands = [
    path.join(AI, `${imp}.ts`),
    path.join(AI, imp, "index.ts"),
    path.join(AI, ...imp.split("/")) + ".ts",
  ];
  for (const c of cands) {
    if (fs.existsSync(c)) return norm(path.relative(AI, c));
  }
  return null;
}

function extractAiImports(content) {
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
    for (const c of [rel + ".ts", path.join(rel, "index.ts")]) {
      if (fs.existsSync(c) && c.startsWith(AI)) {
        out.push(norm(path.relative(AI, c)));
        break;
      }
    }
  }
  for (const imp of extractAiImports(content)) {
    const r = resolveImport(imp);
    if (r) out.push(r);
  }
  return out;
}

/** CUT groups for Phase B atomic deletion */
const CUT_GROUPS = {
  "meta-engines-core": {
    label: "Meta-engines (root stubs)",
    dirs: [],
    roots: [
      "automationEngine.ts", "autonomousGenerator.ts", "autonomousOpportunityEngine.ts",
      "autonomyLoop.ts", "businessDecisionEngine.ts", "businessStateEngine.ts",
      "composeGlobalOs.ts", "composeOperationsAutonomy.ts", "costOptimizationEngine.ts",
      "expansionEngine.ts", "generativeEngine.ts", "globalIntelligence.ts",
      "globalLearningLoop.ts", "globalOrchestrator.ts", "growthStrategyEngine.ts",
      "marketOpportunityEngine.ts", "marketRankingEngine.ts", "marketSimulationEngine.ts",
      "monetizationGapEngine.ts", "multiCityEngine.ts", "offerEngine.ts",
      "omniscientContext.ts", "omniscientDecisionEngine.ts", "opportunityEngine.ts",
      "orchestration.ts", "outcomeEvaluator.ts", "pricingEngine.ts", "pricingSimulationEngine.ts",
      "prioritizationEngine.ts", "procurementEngine.ts", "productionPlanner.ts",
      "purchasePlanner.ts", "revenueDecisionEngine.ts", "revenueEngine.ts",
      "revenueIntelligenceEngine.ts", "revenueLeakEngine.ts", "roadmapEngine.ts",
      "routePlanner.ts", "saasIntelligenceEngine.ts", "saasPriorityEngine.ts",
      "saasStateEngine.ts", "simulationEngine.ts", "strategicPrioritizer.ts",
      "strategyEngine.ts", "supplierConnector.ts", "supplierNetworkEngine.ts",
      "supplierPlanner.ts", "swarm.ts", "swarmVote.ts", "valueEngine.ts",
      "experienceModel.ts", "memoryDecay.ts", "autoExecutor.ts", "autoExecutorMetrics.ts",
      "predictiveModel.ts", "predictiveRiskEngine.ts", "predictor.ts",
      "strategicCeoDecision.ts", "experimentGenerator.ts", "crossSurfaceLearning.ts",
      "pageIntent.ts", "policy.ts", "pre-evaluate.ts",
    ],
  },
  "meta-engines-dirs": {
    label: "Meta-engine directories (engines/reality/monopoly/…)",
    dirs: [
      "engines", "reality", "monopoly", "boardroom", "org", "brain",
      "strategic", "market", "scaling", "forecast", "churn", "contract",
      "culture", "behaviour", "creativity", "delivery", "events", "experience",
      "health", "insights", "jobs", "knowledge", "marketing", "media", "menu",
      "nutrition", "pairing", "personalization", "procurement", "radar", "retention",
      "revenue", "sales", "traffic", "ui", "utils", "ux", "architecture", "pageIntent",
      "block", "content",
    ],
    roots: [],
  },
  "capital-allocation-stubs": {
    label: "Capital / allocation stubs (Pillar 1)",
    dirs: ["capital"],
    roots: [],
  },
  "attribution-roi-stubs": {
    label: "Attribution ROI stubs",
    dirs: [],
    roots: ["attribution/aggregationEngine.ts", "attribution/insightEngine.ts", "attribution/roiEngine.ts"],
  },
  "resources-orchestration-stubs": {
    label: "Resource orchestration stubs",
    dirs: ["resources"],
    roots: [],
  },
  "profit-segmentation-stubs": {
    label: "Profit / segmentation stubs",
    dirs: ["profit", "segmentation"],
    roots: [],
  },
  "lead-gen-stubs": {
    label: "Lead-gen / CRO growth stubs",
    dirs: ["growth", "cro"],
    roots: ["siteGrowthLog.ts", "conversionGenerator.ts", "ctaOptimizer.ts", "improveContent.ts"],
  },
  "ceo-autonomy-meta": {
    label: "CEO / autonomy meta-dashboard (Pillar 1 defer)",
    dirs: ["ceo"],
    roots: ["ceoExecutor.ts", "autonomyController.ts"],
  },
  "agents-boardroom": {
    label: "Agent swarm / boardroom",
    dirs: ["agents"],
    roots: [],
  },
  "control-tower-meta": {
    label: "Control-tower meta (non-core lunch)",
    dirs: ["controlTower"],
    roots: [],
  },
  "enterprise-meta": {
    label: "Enterprise meta engines",
    dirs: ["enterprise"],
    roots: [],
  },
  "intelligence-meta": {
    label: "Intelligence layer meta",
    dirs: ["intelligence"],
    roots: [],
  },
  "autonomy-loop": {
    label: "Autonomy loop modules",
    dirs: ["autonomy"],
    roots: [],
  },
  "company-meta-engine": {
    label: "Company meta-engine",
    dirs: ["company"],
    roots: [],
  },
  "kitchen-ai-duplicate": {
    label: "lib/ai/kitchen duplicate",
    dirs: ["kitchen"],
    roots: [],
  },
  "waste-subdir-stubs": {
    label: "lib/ai/waste subdir (use wasteTracker.ts)",
    dirs: ["waste"],
    roots: [],
  },
  "pricing-subdir-stubs": {
    label: "lib/ai/pricing subdir (use pricing.ts)",
    dirs: ["pricing"],
    roots: [],
  },
  "orphan-unwired": {
    label: "Orphan — zero prod/lib importers",
    dirs: [],
    roots: ["editorRewrite.ts", "attribution.ts"],
  },
};

function cutGroupFor(rel) {
  for (const [key, g] of Object.entries(CUT_GROUPS)) {
    if (g.roots.includes(rel)) return key;
    const top = rel.split("/")[0];
    if (rel.includes("/") && g.dirs.includes(top)) return key;
  }
  return null;
}

const LIVE_ROUTE_SEEDS = [
  "app/api/kitchen/demand-forecast/route.ts",
  "app/api/admin/demand-insights/route.ts",
  "app/api/admin/operations-tower/route.ts",
];

const ESG_P2_CORE = new Set([
  "demandEngine.ts", "demandData.ts", "demandInsights.ts", "wasteTracker.ts",
  "portionAllocation.ts", "operationsFeedback.ts", "menuToIngredients.ts", "menuEngine.ts",
]);

const ALWAYS_KEEP_DIRS = new Set([
  "control", "tools", "design", "logging", "validation", "safety", "schema", "governance",
]);

const PILLAR1_ROUTE_PATTERNS = [
  /^app\/api\/sales\//,
  /^app\/api\/social\//,
  /^app\/api\/ai\/growth\//,
  /^app\/api\/ai\/business-engine/,
  /^app\/api\/ai\/copilot/,
  /^app\/api\/backoffice\/ceo\//,
  /^app\/api\/backoffice\/autonomy\//,
  /^app\/api\/backoffice\/revenue\//,
  /^app\/api\/control-tower/,
];

const REFACTOR_NOTES = {
  "wasteTracker.ts": "ESG rollup fail-closed on produced:null — needs production qty.",
  "runner.ts": "Add timeout, Redis rate limit, PII scrub (P2-4).",
  "runnerGovernance.ts": "Profitability gate not enterprise-hardened.",
  "_internalProvider.ts": "Single OpenAI provider — circuit breaker + cost ceiling.",
  "demandEngine.ts": "V1 heuristic live; ML Layer 3 deferred.",
  "demandInsights.ts": "Dish signals live; no CO₂ weighting yet.",
  "cmsAiEngine.ts": "Strict block validation on every LLM response.",
  "pageBuilder.ts": "High token surface — cap blocks + validate.",
  "editorTextSuggest.ts": "Align with responseSafety scrub rules.",
  "anomaly.ts": "Not wired to customer SLA alerts.",
  "pricing.ts": "10% heuristic only — not agreement-linked.",
  "ceo/runner.ts": "Pillar 1 defer — gate CEO autopilot behind explicit env.",
  "autonomy/runner.ts": "Imports meta-engines — decouple before prod expand.",
  "experiment.ts": "Verify tenant isolation on experiment queries.",
  "conversionGenerator.ts": "Pillar 1 — gate LLM cost.",
  "seoEngine.ts": "Clarify deterministic vs LLM paths.",
  "funnelEngine.ts": "Growth funnel — confirm consumer before expand.",
  "adsEngine.ts": "No proven prod UI consumer.",
};

function resolveLibFile(spec) {
  const cands = [
    path.join(ROOT, "lib", `${spec}.ts`),
    path.join(ROOT, "lib", `${spec}.tsx`),
    path.join(ROOT, "lib", spec, "index.ts"),
    path.join(ROOT, "lib", ...spec.split("/")) + ".ts",
    path.join(ROOT, "lib", ...spec.split("/")) + ".tsx",
  ];
  for (const c of cands) {
    if (fs.existsSync(c)) return norm(path.relative(ROOT, c));
  }
  return null;
}

function extractLibImports(content) {
  const out = [];
  const re = /from\s+["']@\/lib\/([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) out.push(m[1]);
  return out;
}

/** Transitive closure: app/lib → lib/* → lib/ai/* */
function buildClosure(scanRoots, seedPatterns = null) {
  const aiKeep = new Set();
  const libQueue = [];

  for (const root of scanRoots) {
    const base = path.join(ROOT, root);
    if (!fs.existsSync(base)) continue;
    for (const file of walk(base, [], ".ts").concat(walk(base, [], ".tsx"))) {
      const rel = norm(path.relative(ROOT, file));
      if (rel.startsWith("lib/ai/")) continue;
      if (seedPatterns && !seedPatterns.some((p) => (typeof p === "string" ? rel === p : p.test(rel)))) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const imp of extractAiImports(content)) {
        const resolved = resolveImport(imp);
        if (resolved) aiKeep.add(resolved);
      }
      for (const spec of extractLibImports(content)) {
        if (spec.startsWith("ai/")) continue;
        const libRel = resolveLibFile(spec);
        if (libRel && !libRel.startsWith("lib/ai/")) libQueue.push(libRel);
      }
    }
  }

  const libSeen = new Set();
  while (libQueue.length) {
    const libRel = libQueue.shift();
    if (libSeen.has(libRel)) continue;
    libSeen.add(libRel);
    const full = path.join(ROOT, libRel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    for (const imp of extractAiImports(content)) {
      const resolved = resolveImport(imp);
      if (resolved) aiKeep.add(resolved);
    }
    for (const spec of extractLibImports(content)) {
      if (spec.startsWith("ai/")) continue;
      const next = resolveLibFile(spec);
      if (next && !next.startsWith("lib/ai/") && !libSeen.has(next)) libQueue.push(next);
    }
  }

  const queue = [...aiKeep];
  while (queue.length) {
    const cur = queue.shift();
    const full = path.join(AI, cur);
    if (!fs.existsSync(full)) continue;
    for (const dep of extractInternalImports(full)) {
      if (!aiKeep.has(dep)) {
        aiKeep.add(dep);
        queue.push(dep);
      }
    }
  }
  return aiKeep;
}

/** Precompute direct importers from app+lib (non-ai) */
function buildImporterMap() {
  const map = new Map();
  for (const root of ["app", "lib"]) {
    const base = path.join(ROOT, root);
    for (const file of walk(base, [], ".ts").concat(walk(base, [], ".tsx"))) {
      const fRel = norm(path.relative(ROOT, file));
      if (fRel.startsWith("lib/ai/")) continue;
      for (const imp of extractAiImports(fs.readFileSync(file, "utf8"))) {
        const resolved = resolveImport(imp);
        if (!resolved) continue;
        if (!map.has(resolved)) map.set(resolved, []);
        map.get(resolved).push(fRel);
      }
    }
  }
  return map;
}

const allAiFiles = walk(AI).map((f) => norm(path.relative(AI, f))).sort();
const liveClosure = buildClosure(["app"], LIVE_ROUTE_SEEDS);
const prodClosure = buildClosure(["app"]);
const fullClosure = prodClosure;
const importerMap = buildImporterMap();

function directImporters(rel) {
  return importerMap.get(rel) ?? [];
}

function isPillar1OnlyImporter(importers) {
  if (!importers.length) return false;
  return importers.every((f) => PILLAR1_ROUTE_PATTERNS.some((p) => p.test(f)));
}

function classifyLib(rel) {
  const importers = directImporters(rel);
  const inLive = liveClosure.has(rel);
  const inProd = prodClosure.has(rel);
  const inFull = fullClosure.has(rel);
  const esgCore = ESG_P2_CORE.has(rel);
  const cutGroup = cutGroupFor(rel);
  const topDir = rel.split("/")[0];
  const refactorNote = REFACTOR_NOTES[rel] ?? REFACTOR_NOTES[`${topDir}/${path.basename(rel)}`];

  if (esgCore) {
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: inLive
        ? "Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM."
        : "Pillar 2/ESG foundation module for demand-waste pipeline.",
      cutGroup: null,
      refactorNote: refactorNote ?? null,
    };
  }

  if (!inFull && !inProd) {
    if (cutGroup) {
      return {
        class: "CUT",
        justification: `No prod/lib consumer; ${CUT_GROUPS[cutGroup].label}.`,
        cutGroup,
        refactorNote: null,
      };
    }
    return {
      class: "CUT",
      justification: "No reachable importer from app/lib — safe orphan for Phase B.",
      cutGroup: "orphan-unwired",
      refactorNote: null,
    };
  }

  if (ALWAYS_KEEP_DIRS.has(topDir) && inFull) {
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: `Core ${topDir}/ infrastructure in prod import closure.`,
      cutGroup: null,
      refactorNote: refactorNote ?? null,
    };
  }

  if (inLive) {
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: "Transitive dependency of live P2 route (200 without LLM).",
      cutGroup: null,
      refactorNote: refactorNote ?? null,
    };
  }

  if (cutGroup && isPillar1OnlyImporter(importers)) {
    return {
      class: "INVESTIGATE",
      justification: `${CUT_GROUPS[cutGroup].label} — only Pillar 1 routes import; defer per strategy.`,
      cutGroup,
      refactorNote: refactorNote ?? null,
    };
  }

  if (cutGroup && (cutGroup.includes("ceo") || cutGroup.includes("autonomy") || cutGroup.includes("agents") || cutGroup.includes("meta-engines"))) {
    if (inProd) {
      return {
        class: "INVESTIGATE",
        justification: `${CUT_GROUPS[cutGroup].label} still in app closure — delete importer routes in Phase B first.`,
        cutGroup,
        refactorNote: refactorNote ?? null,
      };
    }
  }

  if (inProd) {
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: importers[0]?.startsWith("app/")
        ? "Imported by prod app route/component on path to user response."
        : "Supporting module in prod closure via lib hook or backoffice stack.",
      cutGroup: null,
      refactorNote: refactorNote ?? null,
    };
  }

  if (inFull && !inProd) {
    return {
      class: "INVESTIGATE",
      justification: `Only lib-layer consumer (${importers[0] ?? "?"}); no direct app route — confirm 200 path.`,
      cutGroup: cutGroup,
      refactorNote: refactorNote ?? null,
    };
  }

  return {
    class: "INVESTIGATE",
    justification: "Edge case in import graph — manual review.",
    cutGroup: cutGroup,
    refactorNote: null,
  };
}

const PUBLIC_AI_ROUTES = walk(path.join(ROOT, "app/api/ai"))
  .filter((f) => f.endsWith("route.ts"))
  .map((f) => norm(path.relative(ROOT, f)));

function classifyPublicRoute(routeRel) {
  const routePath = routeRel.replace(/^app\/api/, "/api").replace(/\/route\.ts$/, "");
  const uiConsumers = [];
  for (const file of walk(path.join(ROOT, "app"), [], ".tsx")) {
    const c = fs.readFileSync(file, "utf8");
    if (c.includes(routePath)) uiConsumers.push(norm(path.relative(ROOT, file)));
  }

  if (routeRel.includes("/api/ai/usage") && uiConsumers.length) {
    return { class: "KEEP", justification: "Backoffice AI overview reads usage — confirmed UI consumer." };
  }

  if (/^app\/api\/ai\/growth\//.test(routeRel) || routeRel.includes("business-engine") || routeRel.includes("copilot")) {
    return { class: "CUT", justification: "Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy." };
  }

  if (PILLAR1_ROUTE_PATTERNS.some((p) => p.test(routeRel))) {
    return { class: "INVESTIGATE", justification: "Pillar 1 surface — verify auth, cost gate, and UI before keep." };
  }

  if (uiConsumers.length) {
    return { class: "INVESTIGATE", justification: `Referenced in UI (${uiConsumers[0]}) — confirm prod auth and 200 path.` };
  }

  const content = fs.readFileSync(path.join(ROOT, routeRel), "utf8");
  const hasMetaImport = extractAiImports(content).some((imp) => {
    const r = resolveImport(imp);
    return r && cutGroupFor(r);
  });
  if (hasMetaImport) {
    return { class: "CUT", justification: "Imports CUT-group lib modules with no stable UI consumer." };
  }

  return { class: "INVESTIGATE", justification: "Public /api/ai endpoint — no confirmed fetch from app UI." };
}

const libRows = allAiFiles.map((rel) => ({
  path: rel,
  loc: countLoc(path.join(AI, rel)),
  ...classifyLib(rel),
}));

const routeRows = PUBLIC_AI_ROUTES.sort().map((rel) => ({
  path: rel,
  loc: countLoc(path.join(ROOT, rel)),
  ...classifyPublicRoute(rel),
}));

function summarize(rows) {
  const byClass = { KEEP: [], CUT: [], REFACTOR: [], INVESTIGATE: [] };
  for (const r of rows) byClass[r.class].push(r);
  const totals = {};
  for (const k of Object.keys(byClass)) {
    totals[k] = { count: byClass[k].length, loc: byClass[k].reduce((s, r) => s + r.loc, 0) };
  }
  return { byClass, totals };
}

const libSummary = summarize(libRows);
const routeSummary = summarize(routeRows);

const cutByGroup = {};
for (const r of libRows.filter((x) => x.class === "CUT")) {
  const g = r.cutGroup ?? "ungrouped";
  if (!cutByGroup[g]) cutByGroup[g] = { label: CUT_GROUPS[g]?.label ?? g, files: [], loc: 0 };
  cutByGroup[g].files.push(r);
  cutByGroup[g].loc += r.loc;
}

function tableRows(rows) {
  return rows
    .map((r) => {
      const extra = r.refactorNote ? ` *(refactor: ${r.refactorNote})*` : "";
      return `| \`${r.path}\` | ${r.loc} | ${r.justification}${extra} |`;
    })
    .join("\n");
}

let md = `# Phase 2 — Cut-list classification (FASE A)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · no deletions until Thomas review  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)

---

## Executive summary

| Scope | Files | LOC |
|-------|------:|----:|
| \`lib/ai/**/*.ts\` | **${allAiFiles.length}** | **${libRows.reduce((s, r) => s + r.loc, 0)}** |
| \`app/api/ai/**/route.ts\` | **${routeRows.length}** | **${routeRows.reduce((s, r) => s + r.loc, 0)}** |

### \`lib/ai\` by class

| Class | Files | LOC | Meaning |
|-------|------:|----:|---------|
| **KEEP** | ${libSummary.totals.KEEP.count} | ${libSummary.totals.KEEP.loc} | Prod path → 200 (live P2 or backoffice CMS) |
| **CUT** | ${libSummary.totals.CUT.count} | ${libSummary.totals.CUT.loc} | No prod consumer; not P2/ESG — atomic delete in Phase B |
| **REFACTOR** | ${libSummary.totals.REFACTOR.count} | ${libSummary.totals.REFACTOR.loc} | Keep but tighten (note in table) |
| **INVESTIGATE** | ${libSummary.totals.INVESTIGATE.count} | ${libSummary.totals.INVESTIGATE.loc} | Uncertain — review before delete |

### \`app/api/ai/**\` routes by class

| Class | Routes | LOC |
|-------|-------:|----:|
| **KEEP** | ${routeSummary.totals.KEEP.count} | ${routeSummary.totals.KEEP.loc} |
| **CUT** | ${routeSummary.totals.CUT.count} | ${routeSummary.totals.CUT.loc} |
| **REFACTOR** | ${routeSummary.totals.REFACTOR.count} | ${routeSummary.totals.REFACTOR.loc} |
| **INVESTIGATE** | ${routeSummary.totals.INVESTIGATE.count} | ${routeSummary.totals.INVESTIGATE.loc} |

**Live P2 (not under \`/api/ai/\`):** \`/api/kitchen/demand-forecast\`, \`/api/admin/demand-insights\`, \`/api/admin/operations-tower\` → **KEEP** via \`lib/ai\` closure.

**Baseline delta:** inventory cited **279** files; crawl **${allAiFiles.length}** \`.ts\` paths.

---

## CUT groups (Phase B atomic deletion)

Order: drop **importer routes** first, then **lib groups** bottom-up.

`;

for (const [key, g] of Object.entries(cutByGroup).sort((a, b) => b[1].loc - a[1].loc)) {
  md += `### ${g.label} (\`${key}\`)

| Files | LOC |
|-------|----:|
| ${g.files.length} | ${g.loc} |

`;
  for (const f of g.files.sort((a, b) => a.path.localeCompare(b.path))) {
    md += `- \`${f.path}\` (${f.loc} LOC)\n`;
  }
  md += "\n";
}

for (const cls of ["KEEP", "REFACTOR", "INVESTIGATE", "CUT"]) {
  const rows = libSummary.byClass[cls].sort((a, b) => a.path.localeCompare(b.path));
  md += `---

## lib/ai — ${cls} (${rows.length} files, ${libSummary.totals[cls].loc} LOC)

| File | LOC | Justification |
|------|----:|---------------|
${tableRows(rows)}

`;
}

md += `---

## app/api/ai/** — route classification

`;

for (const cls of ["KEEP", "REFACTOR", "INVESTIGATE", "CUT"]) {
  const rows = routeSummary.byClass[cls].sort((a, b) => a.path.localeCompare(b.path));
  if (!rows.length) continue;
  md += `### ${cls} (${rows.length})

| Route | LOC | Justification |
|-------|----:|---------------|
${rows.map((r) => `| \`${r.path}\` | ${r.loc} | ${r.justification} |`).join("\n")}

`;
}

md += `---

## Appendix — AI routes outside \`/api/ai/**\`

| Route | Class | Notes |
|-------|-------|-------|
| \`app/api/kitchen/demand-forecast/route.ts\` | **KEEP** | Live 200 · KitchenView |
| \`app/api/admin/demand-insights/route.ts\` | **KEEP** | Live 200 · AdminInsightsClient |
| \`app/api/admin/operations-tower/route.ts\` | **KEEP** | Live 200 · OperationsTowerClient |
| \`app/api/backoffice/ai/**\` (31) | **KEEP** / **REFACTOR** | Conditional LLM · CMS UI |
| \`app/api/sales/ai/route.ts\` | **INVESTIGATE** | Pillar 1 defer |
| \`app/api/social/ai/**\` | **INVESTIGATE** | Pillar 1 defer |
| \`app/api/system/ai/**\` | **KEEP** | Ops diagnostics |
| \`app/api/edge/ai/route.ts\` | **INVESTIGATE** | Edge runtime |

---

## STOP — FASE A complete

Thomas review → FASE B atomic deletion per CUT groups.

*Generated READ-ONLY · \`scripts/audit/phase2-cut-list-gen.mjs\`*
`;

fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_MD, md);
fs.writeFileSync(OUT_JSON, JSON.stringify({ lib: libRows, routes: routeRows, libSummary, routeSummary, cutByGroup }, null, 2));

console.log("Wrote", OUT_MD);
console.log("lib totals:", libSummary.totals);
console.log("route totals:", routeSummary.totals);
