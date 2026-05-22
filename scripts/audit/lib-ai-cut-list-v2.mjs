/**
 * lib/ai cut-list analyzer v2 (FASE A) — read-only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AI = path.join(ROOT, "lib/ai");

function norm(p) {
  return p.split(path.sep).join("/");
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
  return fs.readFileSync(file, "utf8").split("\n").length;
}

function resolveImportToFile(imp) {
  const candidates = [
    path.join(AI, `${imp}.ts`),
    path.join(AI, imp, "index.ts"),
    path.join(AI, ...imp.split("/")) + ".ts",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return norm(path.relative(AI, c));
  }
  return null;
}

/** NARROW archive per user prompt + audit */
const ARCHIVE_PREFIXES = [
  "engines/",
  "reality/",
  "monopoly/",
  "boardroom/",
  "org/",
  "brain/",
];
const ARCHIVE_ROOT = new Set([
  "omniscientContext.ts",
  "omniscientDecisionEngine.ts",
  "automationEngine.ts",
  "generativeEngine.ts",
  "prioritizationEngine.ts",
  "globalIntelligence.ts",
  "opportunityEngine.ts",
  "explainEngine.ts",
  "valueEngine.ts",
  "experienceModel.ts",
  "memoryDecay.ts",
  "businessStateEngine.ts",
  "businessDecisionEngine.ts",
  "growthStrategyEngine.ts",
  "pricingEngine.ts",
  "revenueLeakEngine.ts",
  "marketOpportunityEngine.ts",
  "marketRankingEngine.ts",
  "marketSimulationEngine.ts",
  "expansionEngine.ts",
  "composeGlobalOs.ts",
  "composeOperationsAutonomy.ts",
  "procurementEngine.ts",
  "purchasePlanner.ts",
  "productionPlanner.ts",
  "routePlanner.ts",
  "costOptimizationEngine.ts",
  "supplierPlanner.ts",
  "capabilityRegistry.ts",
  "swarm.ts",
  "consensus.ts",
  "governor.ts",
]);

function isArchiveModule(imp) {
  const resolved = resolveImportToFile(imp);
  if (!resolved) return { archive: false, resolved: null };
  if (ARCHIVE_PREFIXES.some((p) => resolved.startsWith(p))) return { archive: true, resolved };
  if (ARCHIVE_ROOT.has(resolved)) return { archive: true, resolved };
  return { archive: false, resolved };
}

function extractImports(content) {
  const re = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

// --- LOC by set ---
const allAi = walk(AI).map((f) => norm(path.relative(AI, f)));
let narrowArchiveLoc = 0;
let narrowArchiveCount = 0;
for (const f of walk(AI)) {
  const rel = norm(path.relative(AI, f));
  const loc = countLoc(f);
  const isArch =
    ARCHIVE_PREFIXES.some((p) => rel.startsWith(p)) || ARCHIVE_ROOT.has(rel);
  if (isArch) {
    narrowArchiveLoc += loc;
    narrowArchiveCount++;
  }
}

// --- App imports ---
const appFiles = walk(path.join(ROOT, "app"));
const cronAiRoutes = [];
const impactNonCron = new Map();
const allAppImports = [];

for (const file of appFiles) {
  const rel = norm(path.relative(ROOT, file));
  const imports = extractImports(fs.readFileSync(file, "utf8"));
  if (!imports.length) continue;
  const isCron = rel.match(/^app\/api\/cron\//);
  let hasArchive = false;
  for (const imp of imports) {
    const { archive, resolved } = isArchiveModule(imp);
    allAppImports.push({ source: rel, import: imp, resolved, archive });
    if (archive) {
      hasArchive = true;
      if (isCron) cronAiRoutes.push(rel);
      else {
        if (!impactNonCron.has(rel)) impactNonCron.set(rel, []);
        impactNonCron.get(rel).push({ imp, resolved });
      }
    }
  }
}

const uniqueCron = [...new Set(cronAiRoutes)].sort();
const uniqueImpactNonCron = [...impactNonCron.keys()].sort();

// Keep-set seed paths
const KEEP_DIRS = [
  "logging",
  "control",
  "tools",
  "design",
  "context",
  "safety",
  "validation",
  "governance",
  "experiments",
  "intelligence",
  "schema",
  "company",
  "autonomy",
  "analysis",
  "memory",
  "agents",
  "ceo",
  "enterprise",
  "learning",
];
const KEEP_ROOT = [
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
  "dashboard.ts",
  "generateVariant.ts",
  "normalizeCmsBlocks.ts",
  "siteAnalysis.ts",
  "opportunities.ts",
  "prioritization.ts",
  "batchApply.ts",
  "governanceApplySafety.ts",
  "recommendationActions.ts",
  "adaptiveLearning.ts",
  "businessObjective.ts",
  "dashboardEngine.ts",
  "recommendations.ts",
  "decisions.ts",
  "conversionGenerator.ts",
  "ctaOptimizer.ts",
  "getClient.ts",
  "menuToIngredients.ts",
  "operationsFeedback.ts",
  "portionAllocation.ts",
  "siteGrowthLog.ts",
  "autoExecutor.ts",
  "autoExecutorMetrics.ts",
];

let keepLoc = 0;
let keepCount = 0;
const keepFiles = [];
for (const f of walk(AI)) {
  const rel = norm(path.relative(AI, f));
  const isArch =
    ARCHIVE_PREFIXES.some((p) => rel.startsWith(p)) || ARCHIVE_ROOT.has(rel);
  if (isArch) continue;
  const inKeep =
    KEEP_ROOT.includes(rel) ||
    KEEP_DIRS.some((d) => rel.startsWith(`${d}/`));
  if (inKeep) {
    keepLoc += countLoc(f);
    keepCount++;
    keepFiles.push(rel);
  }
}

console.log(
  JSON.stringify(
    {
      loc: {
        totalAiFiles: allAi.length,
        totalAiLoc: allAi.reduce((s, r) => s + countLoc(path.join(AI, r)), 0),
        narrowArchiveFiles: narrowArchiveCount,
        narrowArchiveLoc,
        keepSeedFiles: keepCount,
        keepSeedLoc: keepLoc,
        remainder: allAi.length - narrowArchiveCount - keepCount,
      },
      appImports: {
        uniqueAppFilesWithAiImport: new Set(allAppImports.map((r) => r.source)).size,
        totalImportStatements: allAppImports.length,
        archiveImportStatements: allAppImports.filter((r) => r.archive).length,
        cronRoutesWithArchiveImport: uniqueCron.length,
        nonCronImpactFiles: uniqueImpactNonCron.length,
        totalImpactIncludingCron: uniqueCron.length + uniqueImpactNonCron.length,
      },
      libImports: (() => {
        const libImpact = new Map();
        for (const file of walk(path.join(ROOT, "lib"))) {
          const rel = norm(path.relative(ROOT, file));
          if (rel.startsWith("lib/ai/")) continue;
          const imports = extractImports(fs.readFileSync(file, "utf8"));
          for (const imp of imports) {
            const { archive } = isArchiveModule(imp);
            if (archive) {
              if (!libImpact.has(rel)) libImpact.set(rel, []);
              libImpact.get(rel).push(imp);
            }
          }
        }
        return {
          nonAiLibImpactFiles: libImpact.size,
          files: [...libImpact.keys()].sort(),
        };
      })(),
      stopCondition: {
        rawImpactOver50: uniqueCron.length + uniqueImpactNonCron.length > 50,
        nonCronImpactOver50: uniqueImpactNonCron.length > 50,
        triggered: uniqueCron.length + uniqueImpactNonCron.length > 50,
      },
      cronRoutesToDelete: uniqueCron,
      nonCronImpactFiles: uniqueImpactNonCron.map((f) => ({
        file: f,
        archiveImports: impactNonCron.get(f),
      })),
    },
    null,
    2,
  ),
);
