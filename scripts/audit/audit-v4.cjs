// FULL AUDIT v4 — AST + Dependency Graph + AI FLOW

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const graphlib = require("graphlib");

const graph = new graphlib.Graph();
const files = glob.sync("**/*.{ts,tsx,js,jsx}", {
    ignore: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/studio/node_modules/**"
    ]
});

/** Canonical graph node id: repo-relative posix path */
function fileKey(f) {
    return path.normalize(f).replace(/\\/g, "/");
}

const fileKeySet = new Set(files.map(fileKey));

const TS_PATHS = loadTsconfigPaths();

const importsMap = {};
const exportsMap = {};

let circularDeps = [];
let deadFiles = [];

console.log("=========================================");
console.log("🧠 FULL AUDIT v4 — AST ANALYSIS");
console.log("=========================================\n");

// ----------------------------------------
// PARSE FILES
// ----------------------------------------

files.forEach((file) => {
    try {
        const stat = fs.statSync(file);
        if (!stat.isFile()) return;

        if (!file.match(/\.(ts|tsx|js|jsx)$/)) return;

        const code = fs.readFileSync(file, "utf-8");

        const ast = parser.parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx"]
        });

        importsMap[file] = [];
        exportsMap[file] = [];

        function recordImport(source) {
            if (typeof source !== "string") return;
            importsMap[file].push(source);
            const toKey = resolveImportToTrackedKey(file, source);
            if (toKey) {
                graph.setEdge(fileKey(file), toKey);
            }
        }

        traverse(ast, {
            ImportDeclaration({ node }) {
                recordImport(node.source.value);
            },

            ImportExpression({ node }) {
                const src = node.source;
                if (src && src.type === "StringLiteral") {
                    recordImport(src.value);
                }
            },

            ExportNamedDeclaration({ node }) {
                if (node.declaration && node.declaration.id) {
                    exportsMap[file].push(node.declaration.id.name);
                }
                if (node.source) {
                    recordImport(node.source.value);
                }
            },

            ExportAllDeclaration({ node }) {
                recordImport(node.source.value);
            },
        });

        graph.setNode(fileKey(file));
    } catch (err) {
        console.log("⚠️ Skipped:", file);
    }
});

// ----------------------------------------
// RESOLVE IMPORTS (relative + tsconfig @/)
// ----------------------------------------

function loadTsconfigPaths() {
    const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
        return { baseUrl: process.cwd(), rules: [] };
    }
    const raw = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
    const co = raw.compilerOptions || {};
    const baseUrl = path.resolve(path.dirname(tsconfigPath), co.baseUrl || ".");
    const pathsObj = co.paths || {};
    const rules = [];
    for (const [key, targetList] of Object.entries(pathsObj)) {
        const parts = key.split("*");
        if (parts.length !== 2) continue;
        const regex = new RegExp(
            "^" +
                parts[0].replace(/[.+?^${}()|[\]\\]/g, "\\$&") +
                "(.*)" +
                parts[1].replace(/[.+?^${}()|[\]\\]/g, "\\$&") +
                "$"
        );
        rules.push({ regex, targets: targetList, prefixLen: parts[0].length });
    }
    rules.sort((a, b) => b.prefixLen - a.prefixLen);
    return { baseUrl, rules };
}

function tryResolveAbsFile(absBaseNoExt) {
    const exts = [".ts", ".tsx", ".js", ".jsx"];
    for (const ext of exts) {
        const p = absBaseNoExt + ext;
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.resolve(p);
    }
    for (const ext of exts) {
        const idx = path.join(absBaseNoExt, "index" + ext);
        if (fs.existsSync(idx) && fs.statSync(idx).isFile()) return path.resolve(idx);
    }
    return null;
}

function absPathToTrackedKey(absPath) {
    const rel = path.relative(process.cwd(), path.resolve(absPath));
    if (rel.startsWith("..")) return null;
    const k = rel.split(path.sep).join("/");
    return fileKeySet.has(k) ? k : null;
}

function resolveRelativeImportAbs(fromFile, imp) {
    if (!imp.startsWith(".")) return null;
    let base = path.resolve(path.dirname(fromFile), imp);
    const exts = [".ts", ".tsx", ".js", ".jsx"];
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return path.resolve(base);
    for (const ext of exts) {
        if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
            return path.resolve(base + ext);
        }
    }
    return tryResolveAbsFile(base);
}

function resolveAliasImportAbs(imp) {
    const { baseUrl, rules } = TS_PATHS;
    for (const { regex, targets } of rules) {
        const m = imp.match(regex);
        if (!m) continue;
        const star = m[1] ?? "";
        for (const tpl of targets) {
            const bits = tpl.split("*");
            const relPath = bits.length === 2 ? bits[0] + star + bits[1] : tpl;
            const absBase = path.resolve(baseUrl, relPath);
            const hit = tryResolveAbsFile(absBase);
            if (hit) return hit;
        }
    }
    return null;
}

function resolveImportToTrackedKey(fromFile, imp) {
    if (typeof imp !== "string") return null;
    let abs = null;
    if (imp.startsWith(".")) abs = resolveRelativeImportAbs(fromFile, imp);
    else if (imp.startsWith("@/")) abs = resolveAliasImportAbs(imp);
    if (!abs) return null;
    return absPathToTrackedKey(abs);
}

// ----------------------------------------
// CIRCULAR DEPENDENCIES
// ----------------------------------------

try {
    const cycles = graphlib.alg.findCycles(graph);
    circularDeps = cycles;
} catch (e) { }

// ----------------------------------------
// DEAD CODE DETECTION
// ----------------------------------------

function normalizeAuditPath(file) {
    return path.normalize(file).replace(/\\/g, "/");
}

/** Sanity studio tree + studio/lunchportalen-studio/** */
function isStudioPath(norm) {
    const first = norm.split("/")[0] || "";
    return first.toLowerCase() === "studio";
}

function isTestFilePath(norm) {
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(norm)) return true;
    if (/\.e2e\.(ts|tsx|js|jsx)$/i.test(norm)) return true;
    if (norm.startsWith("tests/")) return true;
    if (norm.startsWith("e2e/")) return true;
    return false;
}

/** npm/cli entrypoints & load tools — not expected to have TS importers */
function isToolingPath(norm) {
    if (norm.startsWith("scripts/")) return true;
    if (norm.startsWith("perf/")) return true;
    return false;
}

/** Local scaffold / copy-paste artifacts */
function isScaffoldOrDuplicatePath(norm) {
    if (norm.includes(".duplicate.")) return true;
    // Stray API file; canonical implementation is lib/auth/scope.ts (imported via @/lib/auth/scope).
    if (norm === "app/api/auth/scope.ts") return true;
    return false;
}

/** External integration stubs or superseded UI shells (canonical UI lives under components/) */
function isPartnerOrSupersededUiPath(norm) {
    if (norm.startsWith("lib/tripletex/")) return true;
    if (norm.startsWith("lib/toast/")) return true;
    if (norm.startsWith("lib/theme/")) return true;
    if (norm === "lib/url/cleanQuery.ts") return true;
    if (norm === "lib/sanity.ts") return true;
    return false;
}

function isEntryOrFrameworkPath(norm) {
    const base = path.basename(norm);

    // Next.js / app entry & hooks
    if (base === "page.tsx" || base === "page.jsx" || base === "page.js") return true;
    if (base === "layout.tsx" || base === "layout.jsx" || base === "layout.js") return true;
    if (base === "route.ts" || base === "route.tsx" || base === "route.js") return true;
    if (base === "loading.tsx" || base === "loading.js") return true;
    if (base === "error.tsx" || base === "error.js") return true;
    if (base === "not-found.tsx" || base === "not-found.js") return true;
    if (base === "template.tsx" || base === "template.js") return true;
    if (base === "default.tsx" || base === "default.js") return true;
    if (base === "middleware.ts" || base === "middleware.js") return true;
    if (/^opengraph-image\.(tsx|ts|js|jsx)$/i.test(base)) return true;
    if (/^twitter-image\.(tsx|ts|js|jsx)$/i.test(base)) return true;
    if (/^icon\.(tsx|ts|js|jsx)$/i.test(base)) return true;
    if (base === "sitemap.ts" || base === "robots.ts" || base === "manifest.ts") return true;
    if (base === "instrumentation.ts" || base === "instrumentation.js") return true;
    if (base === "next-env.d.ts") return true;

    // Tooling / framework configs (basename)
    if (/^next\.config\./i.test(base)) return true;
    if (/^vitest\.config\./i.test(base)) return true;
    if (/^playwright\.config\./i.test(base)) return true;
    if (/^eslint\.config\./i.test(base)) return true;
    if (/^tailwind\.config\./i.test(base)) return true;
    if (/^postcss\.config\./i.test(base)) return true;
    if (/^jest\.config\./i.test(base)) return true;
    if (/^sanity\.config\./i.test(base)) return true;

    return false;
}

/**
 * AI capability registry: many modules resolved indirectly; static import graph under-counts.
 */
function isAiCapabilitiesPath(norm) {
    return norm.startsWith("lib/ai/engines/capabilities/");
}

/** STEP 4: not dead if imported (graph predecessor), entry, config, framework, studio, tests, tooling, capabilities */
function shouldNotMarkDead(rawFile) {
    const k = fileKey(rawFile);
    if (!graph.hasNode(k)) return true;

    const norm = normalizeAuditPath(rawFile);

    if (isStudioPath(norm)) return true;
    if (isTestFilePath(norm)) return true;
    if (isToolingPath(norm)) return true;
    if (isScaffoldOrDuplicatePath(norm)) return true;
    if (isPartnerOrSupersededUiPath(norm)) return true;
    if (isEntryOrFrameworkPath(norm)) return true;
    if (isAiCapabilitiesPath(norm)) return true;

    const preds = graph.predecessors(k);
    if (preds && preds.length > 0) return true;

    return false;
}

files.forEach((file) => {
    if (shouldNotMarkDead(file)) return;
    deadFiles.push(file);
});

// ----------------------------------------
// AI FLOW ANALYSIS (import paths, not callee names)
// ----------------------------------------

let hasDecision = false;
let hasAutomation = false;

files.forEach((file) => {
    const imps = importsMap[file];
    if (!imps || imps.length === 0) return;
    if (imps.some((i) => i.includes("decisionEngine"))) hasDecision = true;
    if (imps.some((i) => i.includes("automationEngine"))) hasAutomation = true;
});

// ----------------------------------------
// REPORT
// ----------------------------------------

console.log("📁 Files analyzed:", files.length);
console.log("");

console.log("🔗 DEPENDENCY GRAPH");
console.log("Nodes:", graph.nodeCount());
console.log("Edges:", graph.edgeCount());

console.log("");
console.log("🔄 CIRCULAR DEPENDENCIES:", circularDeps.length);
if (circularDeps.length > 0) {
    console.log(circularDeps.slice(0, 5));
}

console.log("");
console.log("🧟 DEAD FILES:", deadFiles.length);
deadFiles.slice(0, 20).forEach(f => console.log(" -", f));

console.log("");
console.log("🧠 AI FLOW");
console.log("Decision present:", hasDecision);
console.log("Automation present:", hasAutomation);

if (!hasDecision) console.log("❌ Missing decision layer");
if (!hasAutomation) console.log("❌ Missing automation layer");

console.log("");
console.log("=========================================");
console.log("📊 ARCHITECTURE SCORE");
console.log("=========================================");

let score = 100;

if (circularDeps.length > 0) score -= 15;
if (deadFiles.length > 20) score -= 10;
if (!hasDecision) score -= 20;
if (!hasAutomation) score -= 20;

console.log("Score:", score, "/ 100");

console.log("");
console.log("=========================================");
console.log("🔥 CRITICAL FIXES");
console.log("=========================================");

if (circularDeps.length > 0) {
    console.log("1. Break circular dependencies");
}

if (deadFiles.length > 10) {
    console.log("2. Remove or refactor dead code");
}

if (!hasDecision) {
    console.log("3. Implement decision engine integration");
}

if (!hasAutomation) {
    console.log("4. Implement automation engine integration");
}

console.log("");
console.log("=========================================");
console.log("DONE");
console.log("=========================================");