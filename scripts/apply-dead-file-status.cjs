/**
 * SAFE CLEANUP CLASSIFICATION — prepends // STATUS and moves ARCHIVE under /archive
 *
 * Prerequisite: dead-files.json (run: $env:AUDIT_DEAD_JSON='1'; node audit-v4.cjs)
 * Run: node scripts/apply-dead-file-status.cjs
 *
 * SAFETY: Never move `lib/**` here — dynamic `import("@/lib/...")` is not in the static audit graph.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DEAD_JSON = path.join(ROOT, "dead-files.json");
const ARCHIVE_ROOT = path.join(ROOT, "archive");

function loadDeadFiles() {
  if (!fs.existsSync(DEAD_JSON)) {
    console.error("Missing dead-files.json — run: $env:AUDIT_DEAD_JSON='1'; node audit-v4.cjs");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DEAD_JSON, "utf8"));
}

const MARKETING_ROOT_COMPONENTS = new Set([
  "components/AppHeader.tsx",
  "components/Control.tsx",
  "components/FAQ.tsx",
  "components/FinalCTA.tsx",
  "components/HowItWorks.tsx",
  "components/Pricing.tsx",
  "components/Problem.tsx",
  "components/PublicHeader.tsx",
  "components/Solution.tsx",
  "components/Sustainability.tsx",
]);

function classify(fp) {
  if (fp === "lib/grouping.ts") return "DELETE";
  if (fp === "app/(auth)/login/loginClient.tsx") return "DELETE";
  if (fp === "components/auth/LoginForm.tsx") return "DELETE";

  if (fp.startsWith("lib/")) return "KEEP";

  if (fp.startsWith("app/(backoffice)/backoffice/_shell/")) return "ARCHIVE";
  if (fp === "app/(backoffice)/backoffice/content/ContentPageClient.tsx") return "ARCHIVE";

  if (fp === "app/today/todayClient.tsx" || fp === "app/today/TodayView.tsx") return "ARCHIVE";

  if (MARKETING_ROOT_COMPONENTS.has(fp)) return "ARCHIVE";
  if (fp.startsWith("components/site/")) return "ARCHIVE";

  if (fp === "app/(public)/registrering/components/CreateCompanyForm.tsx") return "ARCHIVE";

  return "KEEP";
}

function insertStatus(content, status) {
  if (/^\/\/ STATUS: (KEEP|ARCHIVE|DELETE)\s*$/m.test(content)) {
    return content;
  }
  const tag = `// STATUS: ${status}`;
  const lines = content.split(/\r?\n/);
  const first = (lines[0] || "").trim();
  if (first === '"use client";' || first === "'use client';") {
    return [lines[0], "", tag, ...lines.slice(1)].join("\n");
  }
  return `${tag}\n\n${content}`;
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const counts = { KEEP: 0, ARCHIVE: 0, DELETE: 0 };
const deleteList = [];

const dead = loadDeadFiles();

for (const rel of dead) {
  const status = classify(rel);
  counts[status]++;
  if (status === "DELETE") deleteList.push(rel);

  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn("Skip missing:", rel);
    continue;
  }

  const raw = fs.readFileSync(abs, "utf8");
  const next = insertStatus(raw, status);

  if (status === "ARCHIVE") {
    const dest = path.join(ARCHIVE_ROOT, rel);
    ensureDirFor(dest);
    fs.writeFileSync(dest, next, "utf8");
    fs.unlinkSync(abs);
  } else {
    fs.writeFileSync(abs, next, "utf8");
  }
}

const reportPath = path.join(ARCHIVE_ROOT, "CLASSIFICATION_REPORT.md");
ensureDirFor(reportPath);
fs.writeFileSync(
  reportPath,
  [
    "# Dead file classification (audit snapshot)",
    "",
    `- Source list: dead-files.json (${dead.length} paths)`,
    "",
    "## Counts",
    "",
    `- **KEEP**: ${counts.KEEP}`,
    `- **ARCHIVE**: ${counts.ARCHIVE}`,
    `- **DELETE**: ${counts.DELETE}`,
    "",
    "## DELETE candidates",
    "",
    ...deleteList.map((p) => `- \`${p}\``),
    "",
  ].join("\n")
);

fs.writeFileSync(
  path.join(ARCHIVE_ROOT, "README.md"),
  [
    "# Archive",
    "",
    "Files here were moved out of the active tree (see `CLASSIFICATION_REPORT.md`).",
    "`tsconfig.json` excludes `archive/**` so broken relative imports inside snapshots do not fail CI.",
    "",
  ].join("\n")
);

console.log(JSON.stringify({ counts, deleteList, reportPath }, null, 2));
