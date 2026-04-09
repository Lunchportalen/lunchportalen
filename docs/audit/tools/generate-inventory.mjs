/**
 * One-off audit inventory generator. Not production code.
 * Run from repo root: node docs/audit/tools/generate-inventory.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
process.chdir(ROOT);

/** Any path segment in this set marks the subtree as generated/vendor/cache/system (any depth). */
const GENERATED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "out",
  ".cache",
]);

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".webm",
  ".node",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sqlite",
  ".db",
]);

function isUnderGenerated(parts) {
  return parts.some((p) => GENERATED_SEGMENTS.has(p));
}

function topLevel(rel) {
  const p = rel.split("/")[0] || "";
  return p || "(root)";
}

function extOf(rel) {
  const base = path.posix.basename(rel);
  const i = base.lastIndexOf(".");
  if (i <= 0) return base.startsWith(".") && i > 0 ? base.slice(i) : "";
  return base.slice(i);
}

function classifyPath(rel, isDir) {
  const parts = rel.split("/");
  if (parts.includes("node_modules")) return "vendor";
  if (parts[0] === ".git" || parts.includes(".git")) return "system";
  if (parts[0] === ".next" || parts.includes(".next")) return "generated_next";
  if (parts.some((p) => ["dist", "build", "out", "coverage", ".turbo", ".vercel", ".cache"].includes(p)))
    return "generated_build";
  if (rel === ".env" || (rel.startsWith(".env.") && !rel.endsWith(".example"))) return "secrets_candidate";
  if (parts[0] === "app") return "app_router";
  if (parts[0] === "lib") return "library";
  if (parts[0] === "components") return "components";
  if (parts[0] === "public") return "static_assets";
  if (parts[0] === "supabase") return "database_supabase";
  if (parts[0] === "tests" || rel.includes("/__tests__/")) return "tests";
  if (parts[0] === "scripts") return "scripts";
  if (parts[0] === "workers") return "workers";
  if (parts[0] === "docs") return "docs";
  if (parts[0] === ".github") return "ci_cd";
  if (parts[0] === "e2e") return "e2e";
  if (isDir) return "directory_other";
  return "source_other";
}

function authRelated(rel) {
  return /auth|session|middleware|post-login|logout|login|supabase|cookie|bypass|getAuthContext|invite/i.test(rel);
}
function dbRelated(rel) {
  return /supabase|migration|\.sql|database|rpc|postgres|rls/i.test(rel);
}
function buildRelated(rel) {
  return /next\.config|tsconfig|tailwind|postcss|eslint|vitest|playwright|package\.json|lock|instrumentation/i.test(
    rel,
  );
}
function runtimeRelated(rel) {
  return /middleware|instrumentation|route\.ts|\/api\//i.test(rel);
}
function testRelated(rel) {
  return /tests\/|__tests__|\.test\.|\.spec\.|e2e\//i.test(rel);
}

function secretsRisk(rel) {
  if (rel === ".env") return "possible";
  if (rel.startsWith(".env.") && !rel.endsWith(".example")) return "possible";
  if (/secret|credential/i.test(rel)) return "possible";
  return "none";
}

function binaryOrText(rel, size, isDir) {
  if (isDir) return "n/a";
  const e = extOf(rel).toLowerCase();
  if (BINARY_EXT.has(e)) return "binary";
  if (size > 2_000_000) return "binary_or_large";
  return "text_probable";
}

function analyzedLevel(rel, isDir, parts, size) {
  if (isUnderGenerated(parts)) return "generated_only";
  if (rel === ".env") return "redacted";
  if (secretsRisk(rel) === "possible" && !rel.endsWith(".example")) return "metadata_only";
  if (!isDir && size > 500_000) return "metadata_only";
  return "full";
}

const entries = [];

function walk(abs, relPosix) {
  let stat;
  try {
    stat = fs.lstatSync(abs);
  } catch (e) {
    entries.push({
      path: relPosix,
      type: "unknown",
      extension: "",
      size: null,
      topLevelArea: topLevel(relPosix),
      classification: "unknown",
      binaryOrText: "n/a",
      analyzedLevel: "not_read",
      authRelated: false,
      dbRelated: false,
      buildRelated: false,
      runtimeRelated: false,
      testRelated: false,
      secretsRisk: "none",
      notes: `lstat_error:${String(e?.message || e)}`,
    });
    return;
  }

  const isSym = stat.isSymbolicLink();
  const isDir = stat.isDirectory() && !isSym;
  const isFile = stat.isFile();

  let type = "unknown";
  if (isSym) type = "symlink";
  else if (isDir) type = "dir";
  else if (isFile) type = "file";

  const parts = relPosix ? relPosix.split("/") : [];
  const rel = relPosix;
  const size = isFile ? stat.size : null;
  const ext = isFile ? extOf(rel) : "(dir)";
  const classification = classifyPath(rel, isDir);
  const sr0 = secretsRisk(rel);
  const bo = binaryOrText(rel, size || 0, isDir);
  const al = analyzedLevel(rel, isDir, parts, size || 0);

  entries.push({
    path: rel || ".",
    type,
    extension: ext,
    size,
    topLevelArea: topLevel(rel || "."),
    classification,
    binaryOrText: bo,
    analyzedLevel: al,
    authRelated: authRelated(rel),
    dbRelated: dbRelated(rel),
    buildRelated: buildRelated(rel),
    runtimeRelated: runtimeRelated(rel),
    testRelated: testRelated(rel),
    secretsRisk: sr0,
    notes: isSym ? "symlink" : "",
  });

  if (!isDir) return;

  let names;
  try {
    names = fs.readdirSync(abs);
  } catch (e) {
    return;
  }
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const nextAbs = path.join(abs, name);
    const nextRel = rel ? `${rel}/${name}` : name;
    walk(nextAbs, nextRel.split(path.sep).join("/"));
  }
}

walk(ROOT, "");

const dirs = entries.filter((e) => e.type === "dir").length;
const files = entries.filter((e) => e.type === "file").length;
const syms = entries.filter((e) => e.type === "symlink").length;
const summary = { totalEntries: entries.length, dirs, files, symlinks: syms };

const outDir = path.join(ROOT, "docs", "audit");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "02-file-manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), root: ROOT, summary, entries }, null, 2),
);

const lines = entries.map((e) => e.path).sort();
fs.writeFileSync(path.join(outDir, "01-repo-tree-full.txt"), `${lines.join("\n")}\n`);

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csvHeader = [
  "path",
  "type",
  "extension",
  "size",
  "topLevelArea",
  "classification",
  "binaryOrText",
  "analyzedLevel",
  "authRelated",
  "dbRelated",
  "buildRelated",
  "runtimeRelated",
  "testRelated",
  "secretsRisk",
  "notes",
];

const csvRows = [csvHeader.join(",")];
for (const e of entries) {
  csvRows.push(
    [
      e.path,
      e.type,
      e.extension,
      e.size ?? "",
      e.topLevelArea,
      e.classification,
      e.binaryOrText,
      e.analyzedLevel,
      e.authRelated,
      e.dbRelated,
      e.buildRelated,
      e.runtimeRelated,
      e.testRelated,
      e.secretsRisk,
      e.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
}
fs.writeFileSync(path.join(outDir, "03-file-manifest.csv"), csvRows.join("\n"));

console.log(JSON.stringify(summary));
