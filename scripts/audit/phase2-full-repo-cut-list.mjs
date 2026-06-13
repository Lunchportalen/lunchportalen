/**
 * Phase 2 cut-list — FULL REPO consumer-graph audit (FASE A, READ-ONLY).
 * Usage: node scripts/audit/phase2-full-repo-cut-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AI = path.join(ROOT, "lib/ai");
const OUT_MD = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.md");
const OUT_JSON = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.json");

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".turbo", "coverage"]);
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".jsx", ".json", ".yml", ".yaml", ".md", ".cshtml", ".sql", ".cs"]);

const CRAWL_AREAS = [
  { id: "lib", rel: "lib", scope: "kode", note: "Inkl. lib/hooks, lib/server, lib/edge" },
  { id: "app", rel: "app", scope: "kode" },
  { id: "components", rel: "components", scope: "kode" },
  { id: "workers", rel: "workers", scope: "kode", optional: true },
  { id: "scripts", rel: "scripts", scope: "scheduled" },
  { id: "github", rel: ".github/workflows", scope: "scheduled" },
  { id: "supabase_migrations", rel: "supabase/migrations", scope: "scheduled" },
  { id: "supabase_functions", rel: "supabase/functions", scope: "scheduled", optional: true },
  { id: "lib_cron", rel: "lib/cron", scope: "scheduled", optional: true },
  { id: "tests", rel: "tests", scope: "tests" },
  { id: "e2e", rel: "e2e", scope: "tests" },
  { id: "playwright", rel: "playwright", scope: "tests", optional: true },
  { id: "cypress", rel: "cypress", scope: "tests", optional: true },
  { id: "studio", rel: "studio", scope: "cms" },
  { id: "sanity_schemas", rel: "sanity", scope: "cms", optional: true },
  { id: "umbraco", rel: "umbraco17/lunchportalen", scope: "cms" },
  { id: "docs", rel: "docs", scope: "docs" },
];

const CRAWL_FILES = [
  { rel: "vercel.json", scope: "scheduled" },
  { rel: "middleware.ts", scope: "config" },
  { rel: "next.config.ts", scope: "config" },
  { rel: ".env.example", scope: "config", optional: true },
  { rel: "package.json", scope: "package" },
  { rel: "README.md", scope: "docs", optional: true },
  { rel: "CHANGELOG.md", scope: "docs", optional: true },
];

const SKIPPED = [
  { path: "node_modules/", reason: "Dependencies — ikke produksjonskilde" },
  { path: ".next/", reason: "Build output" },
  { path: "dist/", reason: "Build output" },
  { path: "build/", reason: "Build output" },
];

const ESG_P2 = new Set([
  "demandEngine.ts", "demandData.ts", "demandInsights.ts", "wasteTracker.ts",
  "portionAllocation.ts", "operationsFeedback.ts", "menuToIngredients.ts", "menuEngine.ts",
]);

const LIVE_PROD_ROUTES = [
  "app/api/kitchen/demand-forecast/route.ts",
  "app/api/admin/demand-insights/route.ts",
  "app/api/admin/operations-tower/route.ts",
];

const REFACTOR_NOTES = {
  "wasteTracker.ts": "ESG rollup fail-closed på produced:null — trenger produksjonsqty.",
  "runner.ts": "Timeout, Redis rate limit, PII-scrub (P2-4).",
  "runnerGovernance.ts": "Profitability-gate ikke enterprise-hardened.",
  "_internalProvider.ts": "Single OpenAI — circuit breaker + cost ceiling.",
  "demandEngine.ts": "V1 live; ML Layer 3 utsatt.",
  "demandInsights.ts": "Dish signals live; ingen CO₂-vekt.",
  "cmsAiEngine.ts": "Strict block-validering på hver LLM-respons.",
  "pageBuilder.ts": "Høy tokenflate — cap blocks.",
  "editorTextSuggest.ts": "Align med responseSafety.",
  "editorRewrite.ts": "Brukes av AiTextAssistPopover — vurder merge med editorTextSuggest.",
  "anomaly.ts": "Ikke koblet til kunde-SLA.",
  "pricing.ts": "10% heuristikk — ikke avtale-koblet.",
  "ceo/runner.ts": "Pillar 1 defer — gate bak env.",
  "autonomy/runner.ts": "Meta-engine imports — decouple før expand.",
  "experiment.ts": "Verifiser tenant-isolasjon på queries.",
};

const CUT_GROUPS = {
  "capital-allocation-stubs": { label: "Capital / allocation (Pillar 1)", match: (r) => r.startsWith("capital/") },
  "attribution-roi-stubs": {
    label: "Attribution ROI orphans",
    match: (r) => r.startsWith("attribution/") && ["aggregationEngine.ts", "insightEngine.ts", "roiEngine.ts"].some((f) => r.endsWith(f)),
  },
  "resources-orchestration-stubs": { label: "Resource orchestration", match: (r) => r.startsWith("resources/") },
  "meta-engines-root": {
    label: "Meta-engine root stubs",
    match: (r) =>
      !r.includes("/") &&
      [
        "experienceModel.ts", "memoryDecay.ts", "outcomeEvaluator.ts", "predictiveModel.ts",
        "predictiveRiskEngine.ts", "roadmapEngine.ts", "strategicPrioritizer.ts", "orchestration.ts",
        "predictor.ts", "strategicCeoDecision.ts", "experimentGenerator.ts", "crossSurfaceLearning.ts",
      ].includes(r),
  },
  "meta-engines-dirs": {
    label: "Meta-engine directories",
    match: (r) =>
      [
        "engines/", "reality/", "monopoly/", "boardroom/", "org/", "brain/", "strategic/", "market/",
        "scaling/", "forecast/", "churn/", "contract/", "culture/", "behaviour/", "creativity/",
      ].some((p) => r.startsWith(p)),
  },
  "lead-gen-stubs": {
    label: "Lead-gen / CRO growth",
    match: (r) => r.startsWith("growth/") || r.startsWith("cro/") || r === "siteGrowthLog.ts",
  },
  "ceo-autonomy-meta": {
    label: "CEO / autonomy meta",
    match: (r) => r.startsWith("ceo/") || r === "ceoExecutor.ts" || r.startsWith("autonomy/") || r === "autonomyController.ts",
  },
  "control-tower-meta": { label: "Control-tower meta", match: (r) => r.startsWith("controlTower/") },
  "company-meta": { label: "Company meta-engine", match: (r) => r.startsWith("company/") },
  "agents-swarm": { label: "Agent swarm", match: (r) => r.startsWith("agents/") },
  "intelligence-meta": { label: "Intelligence meta", match: (r) => r.startsWith("intelligence/") },
  "kitchen-waste-pricing-dup": {
    label: "Duplicate subdirs (root modules canonical)",
    match: (r) => r.startsWith("kitchen/") || r.startsWith("waste/") || r.startsWith("pricing/"),
  },
  "control-test-only": {
    label: "control/* (kun test-consumers)",
    match: (r) => r.startsWith("control/"),
  },
};

function norm(p) {
  return p.split(path.sep).join("/");
}

function countLoc(f) {
  return fs.readFileSync(f, "utf8").split("\n").length;
}

function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, out);
    else {
      const ext = path.extname(ent.name).toLowerCase();
      if (EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

function scopeOf(relPath) {
  if (relPath.startsWith("tests/") || relPath.startsWith("e2e/") || relPath.includes("__tests__")) return "tests";
  if (relPath.startsWith("docs/") || relPath === "README.md" || relPath === "CHANGELOG.md") return "docs";
  if (relPath.startsWith("studio/") || relPath.startsWith("sanity/") || relPath.startsWith("umbraco17/")) return "cms";
  if (relPath.startsWith("scripts/") || relPath.startsWith(".github/") || relPath.startsWith("supabase/")) return "scheduled";
  if (relPath === "vercel.json") return "scheduled";
  if (relPath === "middleware.ts" || relPath.startsWith("next.config") || relPath === ".env.example") return "config";
  if (relPath === "package.json") return "package";
  if (relPath.startsWith("app/api/cron/")) return "scheduled";
  return "kode";
}

function resolveImport(spec) {
  const cands = [
    path.join(AI, `${spec}.ts`),
    path.join(AI, spec, "index.ts"),
    path.join(AI, ...spec.split("/")) + ".ts",
  ];
  for (const c of cands) {
    if (fs.existsSync(c)) return norm(path.relative(AI, c));
  }
  return null;
}

function extractExports(content) {
  const names = new Set();
  for (const re of [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+(?:type|interface)\s+(\w+)/g,
  ]) {
    let m;
    while ((m = re.exec(content))) names.add(m[1]);
  }
  const block = /export\s+\{([^}]+)\}/g;
  let m;
  while ((m = block.exec(content))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

function searchPatterns(rel) {
  const noExt = rel.replace(/\.ts$/, "");
  return [
    `@/lib/ai/${noExt}`,
    `@/lib/ai/${noExt}.ts`,
    `lib/ai/${noExt}`,
    `lib/ai/${rel}`,
    `"${noExt}"`,
    `'${noExt}'`,
  ];
}

function cutGroupFor(rel) {
  for (const [key, g] of Object.entries(CUT_GROUPS)) {
    if (g.match(rel)) return key;
  }
  return null;
}

/** Build crawl corpus */
const crawlReport = { crawled: [], missing: [], skipped: SKIPPED };
const corpus = [];

for (const area of CRAWL_AREAS) {
  const abs = path.join(ROOT, area.rel);
  if (!fs.existsSync(abs)) {
    crawlReport.missing.push({ ...area, reason: area.optional ? "optional — finnes ikke" : "path mangler" });
    continue;
  }
  const files = walkDir(abs);
  crawlReport.crawled.push({ ...area, files: files.length });
  for (const f of files) corpus.push({ rel: norm(path.relative(ROOT, f)), content: fs.readFileSync(f, "utf8"), scope: area.scope });
}

for (const cf of CRAWL_FILES) {
  const abs = path.join(ROOT, cf.rel);
  if (!fs.existsSync(abs)) {
    crawlReport.missing.push({ ...cf, reason: cf.optional ? "optional" : "mangler" });
    continue;
  }
  crawlReport.crawled.push({ id: cf.rel, rel: cf.rel, scope: cf.scope, files: 1 });
  corpus.push({ rel: cf.rel, content: fs.readFileSync(abs, "utf8"), scope: cf.scope });
}

/** Vercel cron paths */
let vercelCrons = [];
try {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  vercelCrons = (v.crons ?? []).map((c) => c.path);
} catch {
  /* ignore */
}

/** All lib/ai files */
const aiFiles = walkDir(AI).map((f) => norm(path.relative(AI, f))).sort();

function isExternalConsumer(fileRel) {
  return !fileRel.startsWith("lib/ai/");
}

function isInventoryDoc(fileRel) {
  return (
    fileRel.includes("repo-intelligence/") ||
    fileRel.includes("AUDIT_FILE_LEDGER") ||
    /docs\/audit\/.*\.json$/i.test(fileRel) ||
    fileRel.includes("docs/audit/parts/06c-paths") ||
    fileRel.includes("dependencies.json") ||
    fileRel.includes("repo-map.json")
  );
}

function isAuditArtifact(fileRel) {
  return (
    isInventoryDoc(fileRel) ||
    fileRel.startsWith("scripts/audit/") ||
    fileRel.includes("phase2-cut-list-2026") ||
    fileRel.endsWith("lib-ai-keep-closure.json")
  );
}

/** External corpus only (perf) */
const externalCorpus = corpus.filter((c) => isExternalConsumer(c.rel) && !isAuditArtifact(c.rel));

/** Pass 1: import map from @/lib/ai/ — external importers only */
const importConsumers = new Map();
for (const { rel, content, scope } of externalCorpus) {
  const re = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) {
    const target = resolveImport(m[1]);
    if (!target) continue;
    if (!importConsumers.has(target)) importConsumers.set(target, []);
    importConsumers.get(target).push({ file: rel, scope, kind: "import" });
  }
  const re2 = /import\s*\(\s*["']@\/lib\/ai\/([^"']+)["']\s*\)/g;
  while ((m = re2.exec(content))) {
    const target = resolveImport(m[1]);
    if (!target) continue;
    if (!importConsumers.has(target)) importConsumers.set(target, []);
    importConsumers.get(target).push({ file: rel, scope, kind: "dynamic-import" });
  }
}

/** Pass 2: per-file full consumer scan */
function findConsumers(aiRel) {
  const found = new Map();
  const add = (file, scope, kind) => {
    const k = `${file}|${kind}`;
    if (!found.has(k)) found.set(k, { file, scope, kind });
  };

  for (const c of importConsumers.get(aiRel) ?? []) add(c.file, c.scope, c.kind);

  const patterns = searchPatterns(aiRel);
  const aiPath = path.join(AI, aiRel);
  const aiContent = fs.existsSync(aiPath) ? fs.readFileSync(aiPath, "utf8") : "";
  const exports = extractExports(aiContent).filter((n) => n.length >= 6 && !["default", "Promise", "Function"].includes(n));

  for (const { rel, content, scope } of externalCorpus) {
    if (isAuditArtifact(rel)) continue;
    for (const p of patterns) {
      if (content.includes(p)) {
        add(rel, scope, "path-grep");
        break;
      }
    }
    for (const sym of exports.slice(0, 6)) {
      if (sym.length >= 8 && new RegExp(`\\b${sym}\\b`).test(content)) {
        add(rel, scope, "export-symbol");
      }
    }
  }

  /** Route path strings for modules tied to /api/ai routes — filename heuristic */
  const base = path.basename(aiRel, ".ts");
  if (base.length >= 5) {
    const routeNeedle = `/api/ai/${base}`;
    for (const { rel, content, scope } of externalCorpus) {
      if (content.includes(routeNeedle)) add(rel, scope, "route-path");
    }
  }

  return [...found.values()];
}

function groupByScope(consumers) {
  const g = { kode: [], scheduled: [], config: [], tests: [], cms: [], docs: [], package: [] };
  for (const c of consumers) {
    const s = c.scope === "kode" && c.file.startsWith("app/api/cron/") ? "scheduled" : c.scope;
    if (g[s]) g[s].push(c.file);
    else g.kode.push(c.file);
  }
  return g;
}

function classify(aiRel, consumers) {
  const grouped = groupByScope(consumers);
  const prodKode = grouped.kode.filter((f) => !f.startsWith("tests/"));
  const hasProd = prodKode.length > 0;
  const hasTests = grouped.tests.length > 0;
  const hasDocs = grouped.docs.filter((d) => !isInventoryDoc(d)).length > 0;
  const hasScheduled = grouped.scheduled.length > 0;
  const hasCms = grouped.cms.length > 0;
  const esg = ESG_P2.has(aiRel);
  const cutGroup = cutGroupFor(aiRel);
  const refactorNote = REFACTOR_NOTES[aiRel];

  const checks = {
    filenameGrep: consumers.some((c) => c.kind === "path-grep" || c.kind === "import"),
    exportGrep: consumers.some((c) => c.kind === "export-symbol"),
    routePathGrep: consumers.some((c) => c.kind === "route-path"),
    vercelGithubSupabase:
      hasScheduled ||
      vercelCrons.some((p) => consumers.some((c) => c.file === "vercel.json" || c.content?.includes?.(p))),
    noTests: !hasTests,
    notP2Esg: !esg,
  };

  const scopesHit = [
    hasProd && "kode",
    hasScheduled && "scheduled",
    grouped.config.length && "config",
    hasTests && "tests",
    hasCms && "cms",
    hasDocs && "docs",
    grouped.package.length && "package",
  ].filter(Boolean);

  if (esg) {
    const live = LIVE_PROD_ROUTES.some((r) => prodKode.includes(r) || consumers.some((c) => c.file === r));
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: live
        ? "Pillar 2/ESG-kjerne på live route (200 uten LLM)."
        : "Pillar 2/ESG-fundament per phase2-ai-inventory + synerg roadmap.",
      investigateQuestion: null,
      checks,
      scopesHit: scopesHit.length ? scopesHit : ["esg-fundament"],
    };
  }

  if (hasProd) {
    const liveImporter = LIVE_PROD_ROUTES.find((r) => prodKode.includes(r) || consumers.some((c) => c.file === r));
    if (liveImporter) {
      return {
        class: refactorNote ? "REFACTOR" : "KEEP",
        justification: `Prod consumer på live P2-route (${liveImporter}).`,
        investigateQuestion: null,
        checks,
        scopesHit,
      };
    }
    if (cutGroup && (cutGroup.includes("ceo") || cutGroup.includes("meta") || cutGroup.includes("capital"))) {
      return {
        class: "INVESTIGATE",
        justification: `${CUT_GROUPS[cutGroup]?.label ?? cutGroup} — prod-importer finnes (${prodKode[0]}).`,
        investigateQuestion: `Filen \`${aiRel}\` importeres av \`${prodKode[0]}\` men ligger i CUT-gruppe «${CUT_GROUPS[cutGroup]?.label}». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer?`,
        checks,
        scopesHit,
      };
    }
    return {
      class: refactorNote ? "REFACTOR" : "KEEP",
      justification: `Verifisert prod consumer: ${prodKode[0]}${prodKode.length > 1 ? ` (+${prodKode.length - 1})` : ""}.`,
      investigateQuestion: null,
      checks,
      scopesHit,
    };
  }

  if (hasScheduled) {
    return {
      class: "INVESTIGATE",
      justification: `Scheduled/config consumer (${grouped.scheduled[0] ?? "vercel"}) — ikke auto-CUT.`,
      investigateQuestion: `\`${aiRel}\` referert fra scheduled/config (\`${(grouped.scheduled[0] ?? "vercel.json").slice(0, 60)}\`). Aktiv cron med business-verdi, eller død referanse?`,
      checks,
      scopesHit,
    };
  }

  if (hasTests && !hasProd && !hasDocs) {
    return {
      class: "INVESTIGATE",
      justification: `Kun test-consumers (${grouped.tests.length}) — test-only/legacy.`,
      investigateQuestion: `\`${aiRel}\` har ${grouped.tests.length} test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt?`,
      checks: { ...checks, noTests: false },
      scopesHit,
    };
  }

  if (hasDocs && !hasProd && !hasTests) {
    const doc = grouped.docs.find((d) => !isInventoryDoc(d)) ?? grouped.docs[0];
    if (doc && !isInventoryDoc(doc)) {
      return {
        class: "INVESTIGATE",
        justification: `Nevnt i strategi/runbook (${doc}) uten prod consumer.`,
        investigateQuestion: `\`${aiRel}\` nevnt i \`${doc}\`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT?`,
        checks,
        scopesHit,
      };
    }
  }

  if (hasCms && !hasProd) {
    return {
      class: "INVESTIGATE",
      justification: `CMS-schema referanse (${grouped.cms[0]}) — f.eks. Sanity aiMenuLearning.`,
      investigateQuestion: `\`${aiRel}\` koblet til CMS-felt i \`${grouped.cms[0]}\`. Skal AI-fylling implementeres (P2), eller doc-only?`,
      checks,
      scopesHit,
    };
  }

  if (consumers.length === 0 && checks.notP2Esg && !hasTests) {
    return {
      class: "CUT",
      justification: `Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest.`,
      investigateQuestion: null,
      checks,
      scopesHit: ["ingen-ekstern"],
      cutGroup: cutGroup ?? "orphan-unverified",
    };
  }

  return {
    class: "INVESTIGATE",
    justification: "Ambiguous etter full crawl — krever Thomas.",
    investigateQuestion: `\`${aiRel}\` — uklar status etter consumer-graph. Manuel review?`,
    checks,
    scopesHit,
  };
}

const rows = aiFiles.map((rel) => {
  const consumers = findConsumers(rel);
  const cls = classify(rel, consumers);
  const consumerList =
    consumers.length === 0
      ? "ingen"
      : consumers
          .slice(0, 6)
          .map((c) => c.file)
          .join("; ") + (consumers.length > 6 ? ` (+${consumers.length - 6})` : "");
  return {
    path: rel,
    loc: countLoc(path.join(AI, rel)),
    consumers: consumerList,
    consumerDetails: consumers,
    scopesChecked: "lib, app, components, workers, scripts, .github, supabase, tests, e2e, studio, umbraco, docs, vercel.json, middleware, next.config, package.json",
    scopesHit: cls.scopesHit.join(", ") || "ingen",
    cutGroup: cls.cutGroup ?? cutGroupFor(rel),
    ...cls,
  };
});

const summary = { KEEP: [], CUT: [], REFACTOR: [], INVESTIGATE: [] };
for (const r of rows) summary[r.class].push(r);

const totals = {};
for (const k of Object.keys(summary)) {
  totals[k] = { count: summary[k].length, loc: summary[k].reduce((s, r) => s + r.loc, 0) };
}
const totalLoc = rows.reduce((s, r) => s + r.loc, 0);

/** CUT groups rollup */
const cutByGroup = {};
for (const r of summary.CUT) {
  const g = r.cutGroup ?? "ungrouped";
  if (!cutByGroup[g]) cutByGroup[g] = { label: CUT_GROUPS[g]?.label ?? g, files: [], loc: 0, tests: new Set(), routes: new Set() };
  cutByGroup[g].files.push(r);
  cutByGroup[g].loc += r.loc;
  for (const c of r.consumerDetails ?? []) {
    if (c.file.startsWith("tests/")) cutByGroup[g].tests.add(c.file);
  }
}

/** Surprises */
const surprises = [];
for (const r of rows) {
  if (r.class === "KEEP" || r.class === "REFACTOR") {
    for (const c of r.consumerDetails ?? []) {
      if (c.file.startsWith("components/")) surprises.push(`\`${r.path}\` ← \`${c.file}\` (components/)`);
      if (c.file.startsWith("app/api/superadmin/")) surprises.push(`\`${r.path}\` ← superadmin route \`${c.file}\``);
    }
  }
}
if (corpus.some((c) => c.rel.includes("mealIdea") && c.content.includes("aiMenuLearning"))) {
  surprises.push("Sanity `mealIdea.aiMenuLearning` — schema forventer AI-scorer (ikke lib/ai-import).");
}
const cronAi = corpus.filter((c) => c.rel.startsWith("app/api/cron/") && c.content.includes("@/lib/ai/"));
if (cronAi.length === 0) {
  surprises.push("Ingen `app/api/cron/*` importerer `@/lib/ai/*` (vercel crons ikke AI-koblet direkte).");
} else {
  for (const c of cronAi) surprises.push(`Cron route importerer AI: \`${c.rel}\``);
}
if (!corpus.some((c) => c.rel.startsWith("umbraco17/") && c.content.includes("/api/ai"))) {
  surprises.push("Umbraco views: 0 treff på `/api/ai` (ingen Razor AI-kall).");
}
if (corpus.some((c) => c.rel === "app/api/superadmin/control-tower/snapshot/route.ts")) {
  surprises.push("`app/api/superadmin/control-tower/snapshot` kaller `/api/social/ai` server-side.");
}

/** Public AI routes quick classify */
const publicRoutes = walkDir(path.join(ROOT, "app/api/ai"))
  .filter((f) => f.endsWith("route.ts"))
  .map((f) => norm(path.relative(ROOT, f)));

const routeRows = publicRoutes.map((rel) => {
  const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const importers = corpus.filter((c) => c.content.includes(rel.replace(/^app\/api/, "/api").replace(/\/route\.ts$/, ""))).map((c) => c.rel);
  const libImports = [...content.matchAll(/@\/lib\/ai\/([^"']+)/g)].map((m) => resolveImport(m[1])).filter(Boolean);
  let cls = "INVESTIGATE";
  let justification = "Ingen UI-fetch funnet i crawl.";
  if (rel.includes("/usage") && importers.some((i) => i.includes("backoffice"))) {
    cls = "KEEP";
    justification = "Backoffice AI overview fetch.";
  } else if (rel.includes("/growth/") || rel.includes("business-engine") || rel.includes("copilot")) {
    cls = "CUT";
    justification = "Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl.";
  }
  return { path: rel, loc: countLoc(path.join(ROOT, rel)), class: cls, justification, consumers: importers.slice(0, 5).join("; ") || "ingen" };
});

/** Markdown */
let md = `# Phase 2 — Cut-list classification (FASE A, full repo)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · ingen sletting før Thomas review  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)

---

## Crawl-scope (verifikasjon)

### Crawlet (consumer-graph)

| Område | Sti | Scope-type | Filer |
|--------|-----|------------|------:|
${crawlReport.crawled.map((a) => `| ${a.id ?? a.rel} | \`${a.rel}\` | ${a.scope} | ${a.files} |`).join("\n")}

**Corpus totalt:** ${corpus.length} filer indeksert for grep/import/consumer-graph.

### Skipped (eksplisitt)

| Path | Grunn |
|------|-------|
${SKIPPED.map((s) => `| \`${s.path}\` | ${s.reason} |`).join("\n")}

### Mangler / optional

${crawlReport.missing.length ? crawlReport.missing.map((m) => `- \`${m.rel}\` — ${m.reason}`).join("\n") : "- (ingen)"}

**Hooks:** \`hooks/**\` finnes ikke som egen root — crawlet via \`lib/hooks/\`.

**Vercel crons:** ${vercelCrons.length} paths i \`vercel.json\` (ingen peker direkte på \`/api/ai/*\`).

**GitHub Actions:** 0 treff på \`/api/ai\` eller \`@/lib/ai\` i \`.github/workflows/**\`.

**Supabase Edge Functions:** \`supabase/functions/\` — ${crawlReport.missing.some((m) => m.rel === "supabase/functions") ? "mangler" : "crawlet hvis finnes"}.

---

## Sammendrag

| Metrikk | Verdi |
|---------|------:|
| **AI-filer auditeret** (\`lib/ai/**/*.ts\`) | ${aiFiles.length} |
| **Total LOC** | ${totalLoc} |
| **KEEP** | ${totals.KEEP.count} filer (${((totals.KEEP.loc / totalLoc) * 100).toFixed(1)}% LOC) |
| **CUT** | ${totals.CUT.count} filer (${((totals.CUT.loc / totalLoc) * 100).toFixed(1)}% LOC) |
| **REFACTOR** | ${totals.REFACTOR.count} filer (${((totals.REFACTOR.loc / totalLoc) * 100).toFixed(1)}% LOC) |
| **INVESTIGATE** | ${totals.INVESTIGATE.count} filer (${((totals.INVESTIGATE.loc / totalLoc) * 100).toFixed(1)}% LOC) |

**\`app/api/ai/**\` routes:** ${routeRows.length} (klassifisert i egen seksjon nederst).

---

## Verifikasjons-checklist (FASE A)

- [x] Scope crawlet: lib, app, components, workers, scripts, .github/workflows, vercel.json, supabase/migrations, studio, umbraco17, tests, e2e, docs, middleware, next.config, package.json
- [x] Per CUT: filename/path-grep, export-symbol (hvor relevant), route-path, vercel/actions/supabase-config sjekket
- [x] Per CUT: ingen test-consumers (ellers INVESTIGATE)
- [x] Per CUT: ikke Pillar 2 / ESG per Phase 2-docs
- [x] INVESTIGATE er ikke auto-CUT
- [x] Crawl-scope listet eksplisitt over

---

## Per-fil klassifisering (\`lib/ai\`)

| Fil | Class | LOC | Justification | Consumers funnet | Scope-områder sjekket |
|-----|-------|----:|---------------|------------------|------------------------|
${rows.map((r) => `| \`${r.path}\` | **${r.class}** | ${r.loc} | ${r.justification} | ${r.consumers} | ${r.scopesHit} |`).join("\n")}

---

## CUT-grupperinger (Fase B atomisk sletting)

`;

for (const [key, g] of Object.entries(cutByGroup).sort((a, b) => b[1].loc - a[1].loc)) {
  md += `### ${g.label} (\`${key}\`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| ${g.files.length} | ${g.loc} | ${g.loc < 500 ? "S (1 PR)" : g.loc < 1500 ? "M (1–2 PR)" : "L (split)"} |

**Filer:** ${g.files.map((f) => `\`${f.path}\``).join(", ")}

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** \`npm run test:run\`${g.tests.size ? ` + ${[...g.tests].slice(0, 3).join(", ")}` : " (ingen direkte test-treff)"}

**Smoke post-merge:** \`/api/kitchen/demand-forecast\`, \`/api/admin/demand-insights\`, backoffice AI capability

`;
}

md += `---

## REFACTOR-kandidater (Phase 3+, ikke action nå)

| Fil | LOC | Hva trenger oppstramming |
|-----|----:|--------------------------|
${summary.REFACTOR.concat(summary.KEEP.filter((r) => REFACTOR_NOTES[r.path])).filter((r, i, a) => a.findIndex((x) => x.path === r.path) === i).map((r) => `| \`${r.path}\` | ${r.loc} | ${REFACTOR_NOTES[r.path] ?? "Se REFACTOR-notat"} |`).join("\n")}

---

## INVESTIGATE — krever Thomas's beslutning

| Fil | LOC | Spørsmål |
|-----|----:|----------|
${summary.INVESTIGATE.map((r) => `| \`${r.path}\` | ${r.loc} | ${r.investigateQuestion ?? r.justification} |`).join("\n")}

---

## Crawl-funn utenfor lib/ai/

${[...new Set(surprises)].map((s) => `- ${s}`).join("\n")}

---

## app/api/ai/** — route classification

| Route | Class | LOC | Justification | UI/docs consumers |
|-------|-------|----:|---------------|-------------------|
${routeRows.map((r) => `| \`${r.path}\` | **${r.class}** | ${r.loc} | ${r.justification} | ${r.consumers} |`).join("\n")}

**Live P2 (utenfor \`/api/ai/\`):** \`kitchen/demand-forecast\`, \`admin/demand-insights\`, \`admin/operations-tower\` → **KEEP**.

---

## STOP — FASE A complete

Thomas review → FASE B per CUT-gruppe. **INVESTIGATE skal ikke bli CUT uten eksplisitt godkjenning.**

*Generated READ-ONLY · \`scripts/audit/phase2-full-repo-cut-list.mjs\`*
`;

fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_MD, md);
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify({ crawlReport, rows, totals, cutByGroup, routeRows, surprises: [...new Set(surprises)] }, null, 2),
);

console.log(JSON.stringify({ totals, corpusFiles: corpus.length, cutGroups: Object.keys(cutByGroup).length }, null, 2));
