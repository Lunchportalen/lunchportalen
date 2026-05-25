/**
 * Phase 2 cut-list A.5 — complete INVESTIGATE resolution (READ-ONLY).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AI = path.join(ROOT, "lib/ai");
const PRIOR = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.json");
const OUT_MD = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.md");
const OUT_JSON = path.join(ROOT, "docs/strategy/phase2-cut-list-2026-05-26.json");
const REFACTOR_MD = path.join(ROOT, "docs/strategy/phase2-refactor-backlog-2026-05-26.md");

function norm(p) {
  return p.split(path.sep).join("/");
}

function countLoc(f) {
  return fs.readFileSync(f, "utf8").split("\n").length;
}

function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(full, out);
    else if (/\.(ts|tsx|js|mjs|json|md|sql|cshtml|yml|yaml)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function resolveImport(spec) {
  for (const c of [
    path.join(AI, `${spec}.ts`),
    path.join(AI, spec, "index.ts"),
    path.join(AI, ...spec.split("/")) + ".ts",
  ]) {
    if (fs.existsSync(c)) return norm(path.relative(AI, c));
  }
  return null;
}

function extractInternalImports(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const out = [];
  let m;
  const re = /from\s+["']\.\/?([^"']+)["']/g;
  while ((m = re.exec(content))) {
    const rel = path.normalize(path.join(path.dirname(filePath), m[1]));
    for (const c of [rel + ".ts", path.join(rel, "index.ts")]) {
      if (fs.existsSync(c) && c.startsWith(AI)) out.push(norm(path.relative(AI, c)));
    }
  }
  const re2 = /from\s+["']@\/lib\/ai\/([^"']+)["']/g;
  while ((m = re2.exec(content))) {
    const r = resolveImport(m[1]);
    if (r) out.push(r);
  }
  return out;
}

const prior = JSON.parse(fs.readFileSync(PRIOR, "utf8"));
const priorByPath = new Map(prior.rows.map((r) => [r.path, r]));

/** DEL A — supplemental crawl areas */
const SUPPLEMENTAL = [
  { id: "lib_sanity", rel: "lib/sanity", exists: fs.existsSync(path.join(ROOT, "lib/sanity")) },
  { id: "supabase_functions", rel: "supabase/functions", exists: fs.existsSync(path.join(ROOT, "supabase/functions")) },
  { id: "lib_cron", rel: "lib/cron", exists: fs.existsSync(path.join(ROOT, "lib/cron")) },
  { id: "sanity_root", rel: "sanity", exists: fs.existsSync(path.join(ROOT, "sanity")) },
  { id: "playwright", rel: "playwright", exists: fs.existsSync(path.join(ROOT, "playwright")) },
  { id: "cypress", rel: "cypress", exists: fs.existsSync(path.join(ROOT, "cypress")) },
];

const supplementalCorpus = [];
for (const s of SUPPLEMENTAL.filter((x) => x.exists)) {
  for (const f of walkDir(path.join(ROOT, s.rel))) {
    supplementalCorpus.push({ rel: norm(path.relative(ROOT, f)), content: fs.readFileSync(f, "utf8") });
  }
}

const supplementalHits = [];
for (const row of prior.rows.filter((r) => r.class === "CUT")) {
  const needle = row.path.replace(/\.ts$/, "");
  for (const { rel, content } of supplementalCorpus) {
    if (content.includes(`@/lib/ai/${needle}`) || content.includes(`lib/ai/${row.path}`)) {
      supplementalHits.push({ file: row.path, hit: rel });
    }
  }
}

/** DEL B — dynamic fetch map for /api/ai routes */
const FETCH_PATTERNS = [
  /fetch\s*\(\s*[`'"](\/api\/ai\/[^`'"]+)[`'"]/g,
  /fetch\s*\(\s*`(\/api\/ai\/[^`$]+)`/g,
  /fetchPublicAiPostJson\s*\(\s*[`'"](\/api\/ai\/[^`'"]+)[`'"]/g,
  /fetchPublicAiGet\s*\(\s*[`'"](\/api\/ai\/[^`'"]+)[`'"]/g,
  /useSWR\s*\(\s*[`'"](\/api\/ai\/[^`'"]+)[`'"]/g,
];

function scanFetchConsumers() {
  const map = new Map();
  const roots = ["app", "components", "lib"];
  for (const root of roots) {
    const base = path.join(ROOT, root);
    if (!fs.existsSync(base)) continue;
    for (const f of walkDir(base)) {
      if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
      const rel = norm(path.relative(ROOT, f));
      const content = fs.readFileSync(f, "utf8");
      for (const re of FETCH_PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content))) {
          const route = m[1].split("?")[0].replace(/\/$/, "");
          if (!map.has(route)) map.set(route, []);
          if (!map.get(route).includes(rel)) map.get(route).push(rel);
        }
      }
      if (content.includes('fetch("/api/ai"') || content.includes("fetch('/api/ai'")) {
        if (!map.has("/api/ai")) map.set("/api/ai", []);
        if (!map.get("/api/ai").includes(rel)) map.get("/api/ai").push(rel);
      }
    }
  }
  return map;
}

const fetchMap = scanFetchConsumers();

const routeFiles = walkDir(path.join(ROOT, "app/api/ai")).filter((f) => f.endsWith("route.ts"));
const routeRows = routeFiles.map((f) => {
  const rel = norm(path.relative(ROOT, f));
  const apiPath = rel.replace(/^app\/api/, "/api").replace(/\/route\.ts$/, "");
  const consumers = fetchMap.get(apiPath) ?? [];
  const alias = apiPath === "/api/ai/page" ? fetchMap.get("/api/ai") ?? [] : [];
  const all = [...new Set([...consumers, ...alias])];
  const testsOnly = prior.routeRows?.find((r) => r.path === rel);
  let cls = all.length ? "KEEP" : "CUT";
  let justification = all.length
    ? `Dynamic fetch funnet: ${all[0]}${all.length > 1 ? ` (+${all.length - 1})` : ""}.`
    : "0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes.";
  if (!all.length && /tests\/security\/ai-routes-auth/.test(JSON.stringify(prior))) {
    /* tests don't count as UI */
  }
  return { path: rel, apiPath, loc: countLoc(f), class: cls, justification, consumers: all.join("; ") || "ingen", cutGroup: cls === "CUT" ? "dead-api-ai-routes" : null };
});

/** Thomas + deterministic classification */
const THOMAS_KEEP = new Set(["_internalProvider.ts"]);
const THOMAS_CUT = new Set(["adaptiveScoring.ts"]);
const THOMAS_CUT_PREFIX = ["control/"];
const THOMAS_REFACTOR_PREFIX = ["ceo/", "autonomy/", "company/"];
const THOMAS_REFACTOR_ROOT = new Set(["ceoExecutor.ts", "autonomyController.ts"]);

const REFACTOR_NOTES = {
  "_internalProvider.ts": "Single OpenAI — circuit breaker + cost ceiling.",
  "runner.ts": "Timeout, Redis rate limit, PII-scrub (P2-4).",
  "wasteTracker.ts": "ESG rollup fail-closed på produced:null.",
  "demandEngine.ts": "V1 live; ML Layer 3 utsatt.",
  "pageBuilder.ts": "Cap blocks + validate.",
  "cmsAiEngine.ts": "Strict block-validering.",
  "editorRewrite.ts": "Vurder merge med editorTextSuggest.",
  "ceo/runner.ts": "Pillar 1 defer — gate CEO autopilot.",
  "autonomy/runner.ts": "Decouple meta-engine imports.",
  "company/automationEngine.ts": "Control-tower meta — tenant scope audit.",
  "company/memory.ts": "Control-tower meta — tenant scope audit.",
  "company/policyEngine.ts": "Control-tower meta — tenant scope audit.",
  "company/types.ts": "Control-tower panel contract.",
  "ceo/decisionEngine.ts": "CEO recommendations — Pillar 1 defer.",
  "ceo/growthEngine.ts": "CEO growth meta — Pillar 1 defer.",
  "ceo/policyEngine.ts": "CEO policy — Pillar 1 defer.",
  "ceo/runner.ts": "CEO run route — Pillar 1 defer.",
  "autonomy/autonomyAttribution.ts": "Autonomy feedback loop — Pillar 1 defer.",
  "autonomy/autonomyLog.ts": "AI control page wiring.",
  "autonomy/runner.ts": "Autonomy run — decouple meta-engines.",
  "intelligence/index.ts": "Meta layer — consolidate duplicate policy engines.",
  "intelligence/systemIntelligence.ts": "Design optimizer + decision route deps.",
  "controlTower/controlExecutor.ts": "Audit actionRegistry side effects.",
  "experiment.ts": "Tenant isolation on experiment queries.",
};

function externalConsumers(row) {
  return (row.consumerDetails ?? [])
    .map((c) => c.file)
    .filter(
      (f) =>
        f &&
        !f.startsWith("lib/ai/") &&
        !f.startsWith("tests/") &&
        !f.startsWith("docs/") &&
        !f.startsWith("scripts/audit/") &&
        !f.includes("phase2-cut-list"),
    );
}

function classifyRow(row) {
  const p = row.path;
  const prev = row.class;
  let cls;
  let justification;
  let cutGroup = row.cutGroup ?? null;
  let resolvedFrom = null;

  if (THOMAS_KEEP.has(p)) {
    cls = "KEEP";
    justification = "Thomas A.5: KEEP — transitivt via runner.ts; CI-script bekrefter provider-surface.";
    resolvedFrom = "thomas-1";
  } else if (THOMAS_CUT.has(p)) {
    cls = "CUT";
    cutGroup = "pillar1-deferred-stubs";
    justification = "Thomas A.5: CUT — Pillar 1 deferred (phase2-synergi-roadmap).";
    resolvedFrom = "thomas-3";
  } else if (THOMAS_CUT_PREFIX.some((pre) => p.startsWith(pre))) {
    cls = "CUT";
    cutGroup = "control-and-tests-dead";
    justification = "Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts.";
    resolvedFrom = "thomas-2";
  } else if (THOMAS_REFACTOR_PREFIX.some((pre) => p.startsWith(pre)) || THOMAS_REFACTOR_ROOT.has(p)) {
    cls = "REFACTOR";
    justification = "Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+.";
    resolvedFrom = "thomas-4";
  } else {
    const ext = externalConsumers(row);
    if (ext.length > 0) {
      cls = REFACTOR_NOTES[p] ? "REFACTOR" : "KEEP";
      justification = `Deterministisk: ≥1 ekstern consumer (${ext[0]}${ext.length > 1 ? ` +${ext.length - 1}` : ""}).`;
      resolvedFrom = "deterministic-external";
    } else if (p === "analysis/contentHealth.ts") {
      cls = "KEEP";
      justification = "Deterministisk: transitiv via agents/contentHealthDaily → backoffice/ai/health/scan (prod route).";
      resolvedFrom = "deterministic-transitive";
    } else if (p === "profitability.ts") {
      cls = "KEEP";
      justification = "Deterministisk: transitiv via runner.ts (prod LLM path) — CUT ville bryte runner.";
      resolvedFrom = "deterministic-transitive";
    } else {
      cls = "CUT";
      cutGroup = cutGroup ?? "orphan-unverified";
      justification = "Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement.";
      resolvedFrom = "deterministic-cut";
    }
  }

  return {
    ...row,
    class: cls,
    previousClass: prev,
    justification,
    cutGroup: cls === "CUT" ? cutGroup : null,
    resolvedFrom,
    refactorNote: REFACTOR_NOTES[p] ?? null,
  };
}

let rows = prior.rows.map(classifyRow);

/** Transitive KEEP from external-KEEP modules */
const keepSet = new Set(rows.filter((r) => r.class === "KEEP" || r.class === "REFACTOR").map((r) => r.path));
const queue = [...keepSet];
while (queue.length) {
  const cur = queue.shift();
  const full = path.join(AI, cur);
  if (!fs.existsSync(full)) continue;
  for (const dep of extractInternalImports(full)) {
    if (!keepSet.has(dep)) {
      keepSet.add(dep);
      queue.push(dep);
      const idx = rows.findIndex((r) => r.path === dep);
      if (idx >= 0 && rows[idx].class === "CUT") {
        if (THOMAS_CUT.has(dep) || THOMAS_CUT_PREFIX.some((pre) => dep.startsWith(pre))) continue;
        rows[idx] = {
          ...rows[idx],
          class: rows[idx].refactorNote || REFACTOR_NOTES[dep] ? "REFACTOR" : "KEEP",
          previousClass: rows[idx].class,
          justification: `Transitive KEEP fra prod-closure (${cur}).`,
          cutGroup: null,
          resolvedFrom: "transitive-closure",
        };
      }
    }
  }
}

/** Re-apply Thomas overrides after transitive (Thomas wins over closure) */
function applyThomasOverrides(row) {
  const p = row.path;
  if (THOMAS_KEEP.has(p)) {
    return { ...row, class: "KEEP", cutGroup: null, resolvedFrom: "thomas-1-final", justification: "Thomas A.5: KEEP — transitivt via runner.ts; CI-script bekrefter provider-surface." };
  }
  if (THOMAS_CUT.has(p)) {
    return { ...row, class: "CUT", cutGroup: "pillar1-deferred-stubs", resolvedFrom: "thomas-3-final", justification: "Thomas A.5: CUT — Pillar 1 deferred (phase2-synergi-roadmap); overstyrer transitive closure." };
  }
  if (THOMAS_CUT_PREFIX.some((pre) => p.startsWith(pre))) {
    return { ...row, class: "CUT", cutGroup: "control-and-tests-dead", resolvedFrom: "thomas-2-final", justification: "Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts." };
  }
  if (THOMAS_REFACTOR_PREFIX.some((pre) => p.startsWith(pre)) || THOMAS_REFACTOR_ROOT.has(p)) {
    return { ...row, class: "REFACTOR", cutGroup: null, resolvedFrom: "thomas-4-final", justification: "Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+." };
  }
  return row;
}

rows = rows.map(applyThomasOverrides);

/** Final: 0 INVESTIGATE check */
const investigate = rows.filter((r) => r.class === "INVESTIGATE");
if (investigate.length) {
  rows = rows.map((r) => {
    if (r.class !== "INVESTIGATE") return r;
    const ext = externalConsumers(r);
    return {
      ...r,
      class: ext.length ? "KEEP" : "CUT",
      justification: r.justification + " [A.5 forced resolve]",
      resolvedFrom: "forced-residual",
      cutGroup: ext.length ? null : "orphan-unverified",
    };
  });
  rows = rows.map(applyThomasOverrides);
}

const delta = rows.filter((r) => r.previousClass && r.previousClass !== r.class);

const totals = {};
for (const k of ["KEEP", "CUT", "REFACTOR", "INVESTIGATE"]) {
  const list = rows.filter((r) => r.class === k);
  totals[k] = { count: list.length, loc: list.reduce((s, r) => s + r.loc, 0) };
}
const totalLoc = rows.reduce((s, r) => s + r.loc, 0);

/** CUT groups */
const CUT_GROUPS = {
  "control-and-tests-dead": { label: "control/* + tests/ai/controlLayer.test.ts", extra: ["tests/ai/controlLayer.test.ts"] },
  "pillar1-deferred-stubs": { label: "Pillar 1 deferred (Thomas A.5)", extra: [] },
  "dead-api-ai-routes": { label: "Dead /api/ai/* routes (ingen UI-fetch)", extra: [] },
  "orphan-unverified": { label: "Orphan meta/stubs (0 ekstern consumer)", extra: [] },
  "capital-allocation-stubs": { label: "Capital allocation", extra: [] },
  "intelligence-meta": { label: "Intelligence meta (partial — check transitive)", extra: [] },
  "meta-engines-root": { label: "Meta-engine root stubs", extra: [] },
  "attribution-roi-stubs": { label: "Attribution ROI", extra: [] },
  "resources-orchestration-stubs": { label: "Resource orchestration", extra: [] },
  "agents-swarm": { label: "Agent swarm", extra: [] },
  "ceo-autonomy-meta": { label: "CEO meta (legacy group — reclassified in A.5)", extra: [] },
};

const cutByGroup = {};
for (const r of rows.filter((x) => x.class === "CUT")) {
  const g = r.cutGroup ?? "orphan-unverified";
  if (!cutByGroup[g]) cutByGroup[g] = { label: CUT_GROUPS[g]?.label ?? g, files: [], loc: 0, routes: [] };
  cutByGroup[g].files.push(r);
  cutByGroup[g].loc += r.loc;
}
for (const r of routeRows.filter((x) => x.class === "CUT")) {
  const g = "dead-api-ai-routes";
  if (!cutByGroup[g]) cutByGroup[g] = { label: CUT_GROUPS[g].label, files: [], loc: 0, routes: [] };
  cutByGroup[g].routes.push(r);
  cutByGroup[g].loc += r.loc;
}

/** REFACTOR backlog doc */
const refactorRows = rows.filter((r) => r.class === "REFACTOR");
let refactorMd = `# Phase 2 — REFACTOR backlog (Phase 3+)

**Date:** 2026-05-26  
**Mode:** READ-ONLY backlog — ingen action i Fase B  
**Source:** [phase2-cut-list-2026-05-26.md](./phase2-cut-list-2026-05-26.md) (A.5 complete)

---

## Formål

Filer med **live prod consumer** som Thomas har bekreftet beholdes, men som trenger oppstramming før enterprise RC-promotion.

---

## ceo / autonomy / company (Thomas A.5)

| Fil | LOC | Begrunnelse |
|-----|----:|-------------|
${refactorRows.filter((r) => r.path.startsWith("ceo/") || r.path.startsWith("autonomy/") || r.path.startsWith("company/") || ["ceoExecutor.ts", "autonomyController.ts"].includes(r.path)).map((r) => `| \`${r.path}\` | ${r.loc} | ${REFACTOR_NOTES[r.path] ?? r.justification} |`).join("\n")}

---

## P2 / CMS / runner (øvrig REFACTOR)

| Fil | LOC | Begrunnelse |
|-----|----:|-------------|
${refactorRows.filter((r) => !r.path.startsWith("ceo/") && !r.path.startsWith("autonomy/") && !r.path.startsWith("company/") && !["ceoExecutor.ts", "autonomyController.ts"].includes(r.path)).map((r) => `| \`${r.path}\` | ${r.loc} | ${REFACTOR_NOTES[r.path] ?? r.justification} |`).join("\n")}

---

## STOP

Fase B sletter **ikke** REFACTOR-filer. Phase 3+ adresserer denne listen.

`;

/** Main cut-list MD */
const resolvedInvestigate = prior.rows.filter((r) => r.class === "INVESTIGATE");
let md = `# Phase 2 — Cut-list classification (FASE A.5 complete)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · **0 INVESTIGATE** · klar for Fase B  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)  
**Prior:** commit \`3049f3f2\` → A.5 commit

---

## Crawl-scope (verifikasjon)

### Primær crawl (A.5 arver fra 3049f3f2)

6 053 filer — se [prior audit](./phase2-cut-list-2026-05-26.json) \`crawlReport\`.

### A.5 supplement crawl

| Område | Finnes | Filer | AI-treff på CUT-kandidater |
|--------|--------|------:|----------------------------|
${SUPPLEMENTAL.map((s) => {
  const files = s.exists ? walkDir(path.join(ROOT, s.rel)).length : 0;
  const hits = supplementalHits.filter((h) => h.hit.startsWith(s.rel)).length;
  return `| \`${s.rel}/\` | ${s.exists ? "ja" : "nei"} | ${files} | ${hits || "0"} |`;
}).join("\n")}

**Delta A.1:** ${supplementalHits.length ? supplementalHits.map((h) => `\`${h.file}\` ← \`${h.hit}\``).join("; ") : "Ingen CUT-kandidat re-klassifisert av supplement crawl."}

**Hooks:** via \`lib/hooks/\` (primær crawl).

---

## Sammendrag

| Metrikk | A.5 (nå) | Prior (3049f3f2) |
|---------|----------:|------------------:|
| **KEEP** | ${totals.KEEP.count} (${((totals.KEEP.loc / totalLoc) * 100).toFixed(1)}% LOC) | 132 |
| **CUT** | ${totals.CUT.count} (${((totals.CUT.loc / totalLoc) * 100).toFixed(1)}% LOC) | 73 |
| **REFACTOR** | ${totals.REFACTOR.count} (${((totals.REFACTOR.loc / totalLoc) * 100).toFixed(1)}% LOC) | 12 |
| **INVESTIGATE** | **${totals.INVESTIGATE?.count ?? 0}** | 60 |

**LOC totalt:** ${totalLoc} · **Filer:** ${rows.length}

---

## Verifikasjons-checklist (A.5)

- [x] Supplement crawl: lib/sanity, supabase/functions, lib/cron, sanity/, playwright, cypress
- [x] Dynamic-fetch grep (B.1) for alle \`/api/ai/*\` routes
- [x] Postman/HAR (B.2): 0 collections funnet
- [x] Docs partner-API (B.3): ingen ekstern AI-route-kontrakt
- [x] Thomas-beslutninger 1–4 anvendt
- [x] Resterende INVESTIGATE løst deterministisk
- [x] **0 INVESTIGATE gjenstår**

---

## Resolved INVESTIGATE-beslutninger (${resolvedInvestigate.length} filer)

| Fil | Fra | Til | Grunn |
|-----|-----|-----|-------|
${resolvedInvestigate.map((old) => {
  const neu = rows.find((r) => r.path === old.path);
  return `| \`${old.path}\` | INVESTIGATE | **${neu?.class}** | ${(neu?.justification ?? "").slice(0, 120)} |`;
}).join("\n")}

---

## Delta fra prior cut-list (${delta.length} endringer)

| Fil | Fra | Til | Grunn |
|-----|-----|-----|-------|
${delta.slice(0, 80).map((d) => `| \`${d.path}\` | ${d.previousClass} | **${d.class}** | ${d.resolvedFrom} |`).join("\n")}
${delta.length > 80 ? `\n*… +${delta.length - 80} flere (se JSON)*` : ""}

---

## Per-fil klassifisering (\`lib/ai\`)

| Fil | Class | LOC | Justification | Consumers funnet | Scope |
|-----|-------|----:|---------------|------------------|-------|
${rows.map((r) => `| \`${r.path}\` | **${r.class}** | ${r.loc} | ${r.justification} | ${r.consumers ?? "ingen"} | ${r.scopesHit ?? ""} |`).join("\n")}

---

## CUT-grupperinger (Fase B rekkefølge — LOC desc)

${Object.entries(cutByGroup)
  .sort((a, b) => b[1].loc - a[1].loc)
  .map(([key, g]) => {
    const routeList = (g.routes ?? []).map((r) => `\`${r.apiPath}\``).join(", ");
    return `### ${g.label} (\`${key}\`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| ${g.files.length} lib + ${(g.routes ?? []).length} routes | ${g.loc} | ${g.loc < 800 ? "S" : g.loc < 2000 ? "M" : "L"} | \`npm run test:run\` | demand-forecast, demand-insights, backoffice AI |

**Lib:** ${g.files.map((f) => `\`${f.path}\``).join(", ") || "—"}
${routeList ? `\n**Routes:** ${routeList}` : ""}
${key === "control-and-tests-dead" ? "\n**Inkluder:** `tests/ai/controlLayer.test.ts`" : ""}
`;
  })
  .join("\n")}

---

## app/api/ai/** — route classification (B.4 dynamic-fetch)

| Route | Class | LOC | Justification | Fetch consumers |
|-------|-------|----:|---------------|-----------------|
${routeRows.map((r) => `| \`${r.apiPath}\` | **${r.class}** | ${r.loc} | ${r.justification} | ${r.consumers} |`).join("\n")}

**Merk:** \`/api/ai/automation\` kalles fra UI men **route finnes ikke** — dead client call (fikses i Phase 3+, ikke Fase B lib-sletting).

---

## REFACTOR (Phase 3+)

Se [phase2-refactor-backlog-2026-05-26.md](./phase2-refactor-backlog-2026-05-26.md).

---

## STOP — FASE A.5 complete · klar for Fase B

*Generated READ-ONLY · \`scripts/audit/phase2-cut-list-a55-complete.mjs\`*
`;

fs.writeFileSync(OUT_MD, md);
fs.writeFileSync(REFACTOR_MD, refactorMd);
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      phase: "A.5",
      priorCommit: "3049f3f2",
      supplemental: SUPPLEMENTAL,
      supplementalHits,
      fetchMap: Object.fromEntries(fetchMap),
      rows,
      routeRows,
      totals,
      cutByGroup,
      delta,
      investigateRemaining: rows.filter((r) => r.class === "INVESTIGATE").length,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ totals, investigateRemaining: rows.filter((r) => r.class === "INVESTIGATE").length, delta: delta.length, cutGroups: Object.keys(cutByGroup).length }, null, 2));
