/**
 * lib/ai cut-list analyzer (FASE A) — read-only.
 * Usage: node scripts/audit/lib-ai-cut-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Archive: folders (relative to lib/ai) */
const ARCHIVE_DIRS = [
  "engines",
  "reality",
  "monopoly",
  "boardroom",
  "org",
  "brain",
  "capital",
  "strategic",
  "market",
  "scaling",
  "attribution",
  "profit",
  "resources",
  "segmentation",
  "forecast",
  "churn",
  "contract",
  "culture",
  "behaviour",
  "creativity",
  "cro",
  "delivery",
  "enterprise",
  "events",
  "experience",
  "forecast",
  "governance",
  "growth",
  "health",
  "insights",
  "jobs",
  "kitchen",
  "knowledge",
  "marketing",
  "media",
  "menu",
  "nutrition",
  "pairing",
  "personalization",
  "pricing",
  "procurement",
  "radar",
  "retention",
  "revenue",
  "sales",
  "traffic",
  "ui",
  "utils",
  "ux",
  "waste",
  "architecture",
  "autonomy",
  "agents",
  "analysis",
  "block",
  "ceo",
  "company",
  "content",
  "controlTower",
  "conversion",
  "experiments",
  "layout",
  "learning",
  "memory",
  "pageIntent",
  "safety",
  "schema",
  "validation",
  "learning",
];

/** Archive: root-level files (growth/automation meta-engines) */
const ARCHIVE_ROOT_FILES = new Set([
  "automationEngine.ts",
  "autonomousGenerator.ts",
  "autonomousOpportunityEngine.ts",
  "autonomyController.ts",
  "autonomyLoop.ts",
  "businessDecisionEngine.ts",
  "businessMetrics.ts",
  "businessStateEngine.ts",
  "composeGlobalOs.ts",
  "composeOperationsAutonomy.ts",
  "costOptimizationEngine.ts",
  "expansionEngine.ts",
  "explainEngine.ts",
  "generativeEngine.ts",
  "globalIntelligence.ts",
  "globalLearningLoop.ts",
  "globalOrchestrator.ts",
  "growthStrategyEngine.ts",
  "marketOpportunityEngine.ts",
  "marketRankingEngine.ts",
  "marketSimulationEngine.ts",
  "monetizationGapEngine.ts",
  "multiCityEngine.ts",
  "offerEngine.ts",
  "omniscientContext.ts",
  "omniscientDecisionEngine.ts",
  "opportunityEngine.ts",
  "orchestration.ts",
  "outcomeEvaluator.ts",
  "pricingEngine.ts",
  "pricingSimulationEngine.ts",
  "prioritizationEngine.ts",
  "procurementEngine.ts",
  "productionPlanner.ts",
  "purchasePlanner.ts",
  "revenueDecisionEngine.ts",
  "revenueEngine.ts",
  "revenueIntelligenceEngine.ts",
  "revenueLeakEngine.ts",
  "roadmapEngine.ts",
  "routePlanner.ts",
  "saasIntelligenceEngine.ts",
  "saasPriorityEngine.ts",
  "saasStateEngine.ts",
  "simulationEngine.ts",
  "strategicContext.ts",
  "strategicPrioritizer.ts",
  "strategyEngine.ts",
  "supplierConnector.ts",
  "supplierNetworkEngine.ts",
  "supplierPlanner.ts",
  "swarm.ts",
  "swarmVote.ts",
  "valueEngine.ts",
  "experienceModel.ts",
  "memoryDecay.ts",
  "autoExecutor.ts",
  "autoExecutorMetrics.ts",
  "businessObjective.ts",
  "recommendationActions.ts",
  "adaptiveLearning.ts",
  "dashboardEngine.ts",
  "consensus.ts",
  "governor.ts",
  "capabilityRegistry.ts",
]);

/** Explicit KEEP (seed — expanded by closure from app imports of non-archive) */
const KEEP_SEED_DIRS = ["logging", "control", "tools", "design"];
const KEEP_SEED_FILES = new Set([
  "demandEngine.ts",
  "demandData.ts",
  "demandInsights.ts",
  "wasteTracker.ts",
  "runner.ts",
  "_internalProvider.ts",
  "suggestMotor.ts",
  "pageBuilder.ts",
  "pageBuilderPrompts.ts",
  "pageBuilderTypes.ts",
  "pageBuilderValidate.ts",
  "cmsAiEngine.ts",
  "cmsAiTenant.ts",
  "cmsAiActions.ts",
  "cmsAiTypes.ts",
  "cmsAiPrompts.ts",
  "cmsOptimizer.ts",
  "autoImprove.ts",
  "editorTextSuggest.ts",
  "editorRewrite.ts",
  "blockSchema.ts",
  "designTokens.ts",
  "types.ts",
  "context.ts",
  "copilot.ts",
  "rateLimit.ts",
  "responseSafety.ts",
  "policyEngine.ts",
  "runnerGovernance.ts",
  "profitability.ts",
  "usage.ts",
  "usageOverview.ts",
  "entitlements.ts",
  "billing.ts",
  "pricing.ts",
  "run.ts",
  "getClient.ts",
  "image.ts",
  "layout.ts",
  "generator.ts",
  "rewrite.ts",
  "ghostText.ts",
  "inline.ts",
  "continuation.ts",
  "debounce.ts",
  "industry.ts",
  "role.ts",
  "socialStrategy.ts",
  "resolveRunnerCompanyForBackoffice.ts",
  "insertAiSuggestionRow.ts",
  "resolveAiSuggestionFkIds.ts",
  "aiEntrypointContext.ts",
  "logActivity.ts",
  "tracking.ts",
  "learning.ts",
  "experiment.ts",
  "experimentWinnerDecision.ts",
  "decisionEngine.ts",
  "decisionLog.ts",
  "engine.ts",
  "optimizer.ts",
  "seoEngine.ts",
  "seoAnalyzer.ts",
  "funnelEngine.ts",
  "adsEngine.ts",
  "designGenerator.ts",
  "designAnalyzer.ts",
  "designEngine.ts",
  "dashboard.ts",
  "generateVariant.ts",
  "normalizeCmsBlocks.ts",
  "enrichPageBuilderBlocks.ts",
  "strictBlockValidator.ts",
  "validateComponentOutput.ts",
  "validate.ts",
  "config.ts",
  "prompts.ts",
  "feedback.ts",
  "portionAllocation.ts",
  "menuToIngredients.ts",
  "operationsFeedback.ts",
  "menuEngine.ts",
  "portionAllocation.ts",
  "siteAnalysis.ts",
  "siteGrowthLog.ts",
  "opportunities.ts",
  "prioritization.ts",
  "batchApply.ts",
  "governanceApplySafety.ts",
  "surfaceAiGovernance.ts",
  "safeApply.ts",
  "transientAiJsonCache.ts",
  "aiPageGuardrails.ts",
  "buildHomeFromIntentBody.ts",
  "blockFactory.ts",
  "componentFactory.ts",
  "layoutRules.ts",
  "recommendations.ts",
  "decisions.ts",
  "conversionGenerator.ts",
  "ctaOptimizer.ts",
  "improveContent.ts",
  "fallbackHandler.ts",
  "pre-evaluate.ts",
  "runAiAction.ts",
]);

function norm(p) {
  return p.split(path.sep).join("/");
}

function isArchivePath(rel) {
  const parts = rel.split("/");
  if (parts.length > 1 && ARCHIVE_DIRS.includes(parts[0])) return true;
  if (parts.length === 1 && ARCHIVE_ROOT_FILES.has(parts[0])) return true;
  return false;
}

function isKeepSeed(rel) {
  const parts = rel.split("/");
  if (parts.length > 1 && KEEP_SEED_DIRS.includes(parts[0])) return true;
  if (parts.length === 1 && KEEP_SEED_FILES.has(parts[0])) return true;
  return false;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function countLoc(file) {
  const t = fs.readFileSync(file, "utf8");
  return t.split("\n").length;
}

function extractImports(content) {
  const re = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

function classifyImport(imp) {
  const withExt = imp.endsWith(".ts") ? imp : imp.includes("/") ? imp : `${imp}.ts`;
  const asDir = imp;
  if (isArchivePath(imp) || isArchivePath(withExt)) return "archive";
  if (isKeepSeed(imp) || isKeepSeed(withExt)) return "keep";
  // index imports
  if (imp === "intelligence" || imp.startsWith("intelligence/")) return "archive";
  if (imp === "context" || imp.startsWith("context/")) return "keep";
  if (ARCHIVE_ROOT_FILES.has(`${imp.split("/").pop()}.ts`)) return "archive";
  if (KEEP_SEED_FILES.has(`${imp.split("/").pop()}.ts`)) return "keep";
  return "review";
}

const aiRoot = path.join(ROOT, "lib/ai");
const allFiles = walk(aiRoot);
const relFiles = allFiles.map((f) => norm(path.relative(aiRoot, f)));

let archiveLoc = 0;
let keepLoc = 0;
let reviewLoc = 0;
const archiveFiles = [];
const keepFiles = [];
const reviewFiles = [];

for (const f of allFiles) {
  const rel = norm(path.relative(aiRoot, f));
  const loc = countLoc(f);
  if (isArchivePath(rel)) {
    archiveLoc += loc;
    archiveFiles.push(rel);
  } else if (isKeepSeed(rel)) {
    keepLoc += loc;
    keepFiles.push(rel);
  } else {
    reviewLoc += loc;
    reviewFiles.push(rel);
  }
}

const scanRoots = ["app", "tests", "lib"];
const importRows = [];
const impactFiles = new Map();

for (const root of scanRoots) {
  const base = path.join(ROOT, root);
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    if (root === "lib" && norm(file).includes("/lib/ai/")) continue;
    const content = fs.readFileSync(file, "utf8");
    const imports = extractImports(content);
    if (!imports.length) continue;
    const relFile = norm(path.relative(ROOT, file));
    for (const imp of imports) {
      const cls = classifyImport(imp);
      importRows.push({ source: relFile, import: imp, class: cls });
      if (root === "app" && cls === "archive") {
        if (!impactFiles.has(relFile)) impactFiles.set(relFile, []);
        impactFiles.get(relFile).push(imp);
      }
    }
  }
}

const appImports = importRows.filter((r) => r.source.startsWith("app/"));
const uniqueAppFiles = new Set(appImports.map((r) => r.source));
const archiveAppImports = appImports.filter((r) => r.class === "archive");

console.log(JSON.stringify({
  totals: {
    files: relFiles.length,
    archiveFiles: archiveFiles.length,
    keepSeedFiles: keepFiles.length,
    reviewFiles: reviewFiles.length,
    archiveLoc,
    keepSeedLoc: keepLoc,
    reviewLoc,
    totalLoc: archiveLoc + keepLoc + reviewLoc,
  },
  imports: {
    appUniqueFiles: uniqueAppFiles.size,
    appImportStatements: appImports.length,
    archiveImportStatements: archiveAppImports.length,
    impactFiles: impactFiles.size,
  },
  stopCondition: impactFiles.size > 50,
  impactFileList: [...impactFiles.keys()].sort(),
}, null, 2));
