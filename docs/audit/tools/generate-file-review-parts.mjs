/**
 * Reads 02-file-manifest.json and emits path inventory markdown under docs/audit/parts/.
 * Run from repo root: node docs/audit/tools/generate-file-review-parts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const manifestPath = path.join(ROOT, "docs", "audit", "02-file-manifest.json");
const partsDir = path.join(ROOT, "docs", "audit", "parts");
fs.mkdirSync(partsDir, { recursive: true });

const j = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = j.entries.filter((e) => e.analyzedLevel !== "generated_only");

function mdEscape(s) {
  return String(s).replace(/\|/g, "\\|");
}

function writePart(filename, title, predicate) {
  const list = entries.filter(predicate).map((e) => e.path).sort();
  const lines = [
    `# ${title}`,
    "",
    `**Generert:** ${new Date().toISOString()}`,
    `**Antall paths (filer og mapper, ekskl. generert/vendor/cache/system):** ${list.length}`,
    "",
    "Alle paths nedenfor finnes også i `docs/audit/02-file-manifest.json` og `03-file-manifest.csv`.",
    "",
  ];
  for (const p of list) {
    lines.push(`- \`${mdEscape(p)}\``);
  }
  lines.push("");
  fs.writeFileSync(path.join(partsDir, filename), lines.join("\n"), "utf8");
}

writePart("06a-paths-root-config.md", "06a — Root, config og tooling (paths)", (e) => {
  const t = e.topLevelArea;
  return (
    t === "(root)" ||
    t === ".github" ||
    t === ".vscode" ||
    t === ".githooks" ||
    t === "config" ||
    t === "infra" ||
    t === "k8s" ||
    t === "plugins" ||
    t === "domain" ||
    t === "design" ||
    t === "perf" ||
    t === "superadmin"
  );
});

writePart("06b-paths-app.md", "06b — app/ (paths)", (e) => e.topLevelArea === "app");

writePart("06c-paths-lib-utils-components.md", "06c — lib/, utils/, components/, src/ (paths)", (e) =>
  ["lib", "utils", "components", "src"].includes(e.topLevelArea),
);

writePart("06d-paths-public-scripts-workers.md", "06d — public/, scripts/, workers/, audit/, archive/ (paths)", (e) =>
  ["public", "scripts", "workers", "audit", "archive"].includes(e.topLevelArea),
);

writePart("06e-paths-supabase-docs-tests-e2e.md", "06e — supabase/, docs/, tests/, e2e/, øvrig (paths)", (e) => {
  const t = e.topLevelArea;
  return (
    ["supabase", "docs", "tests", "e2e", "repo-intelligence", "evidence", "reports", "playwright-report", "test-results", ".cursor"].includes(
      t,
    ) || t === ".tmp"
  );
});

writePart("06f-paths-studio-misc.md", "06f — studio/ og øvrige top-level (paths)", (e) => {
  const covered = new Set([
    "app",
    "lib",
    "utils",
    "components",
    "src",
    "public",
    "scripts",
    "workers",
    "audit",
    "archive",
    "supabase",
    "docs",
    "tests",
    "e2e",
    "repo-intelligence",
    "evidence",
    "reports",
    "playwright-report",
    "test-results",
    ".cursor",
    ".tmp",
    ".github",
    ".vscode",
    ".githooks",
    "config",
    "infra",
    "k8s",
    "plugins",
    "domain",
    "design",
    "perf",
    "superadmin",
    "(root)",
    "node_modules",
    ".git",
    ".next",
    ".vercel",
  ]);
  return !covered.has(e.topLevelArea);
});

console.log("Wrote parts under docs/audit/parts/");
