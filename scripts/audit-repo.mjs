import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXCLUDE_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
]);

const EMAIL_ALLOWLIST_PATH = path.join("lib", "system", "emails.ts").replaceAll("\\", "/");
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const issues = [];

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext);
}

function walk(dir, list) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), list);
      continue;
    }
    const full = path.join(dir, entry.name);
    if (isTextFile(full)) list.push(full);
  }
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function addIssue(code, filePath, line, message) {
  issues.push({ code, filePath: rel(filePath), line, message });
}

function hasUseClient(lines) {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("//")) continue;
    if (line.startsWith("/*")) continue;
    if (line === '"use client";' || line === "'use client';") return true;
    break;
  }
  return false;
}

const files = [];
walk(ROOT, files);

let SYSTEM_EMAILS = [];
try {
  const allowlistAbs = path.join(ROOT, EMAIL_ALLOWLIST_PATH);
  const allowlistContent = fs.readFileSync(allowlistAbs, "utf8");
  SYSTEM_EMAILS = Array.from(new Set(allowlistContent.match(EMAIL_REGEX) ?? []));
} catch {
  SYSTEM_EMAILS = [];
}
if (SYSTEM_EMAILS.length === 0) {
  addIssue("ALLOWLIST_MISSING", path.join(ROOT, EMAIL_ALLOWLIST_PATH), 1, "System email allowlist missing or empty.");
}

for (const file of files) {
  const relPath = rel(file);
  let content = "";
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);

  // 1) No @/app/components imports
  if (relPath !== "scripts/audit-repo.mjs" && content.includes("@/app/components/")) {
    lines.forEach((line, idx) => {
      if (line.includes("@/app/components/")) {
        addIssue("IMPORT_PATH", file, idx + 1, "Use @/components/* instead of @/app/components/*.");
      }
    });
  }

  // 2) No console.log in client components
  if (hasUseClient(lines)) {
    lines.forEach((line, idx) => {
      if (line.includes("console.log(")) {
        addIssue("CLIENT_CONSOLE", file, idx + 1, "console.log is not allowed in client components.");
      }
    });
  }

  // 3) No hardcoded system emails outside allowlist
  if (relPath !== EMAIL_ALLOWLIST_PATH) {
    for (const email of SYSTEM_EMAILS) {
      if (!content.includes(email)) continue;
      lines.forEach((line, idx) => {
        if (line.includes(email)) {
          addIssue("SYSTEM_EMAIL", file, idx + 1, "System email must live in lib/system/emails.ts.");
        }
      });
    }
  }

  // 4) No TODO/FIXME in app/api and lib
  if (relPath.startsWith("app/api/") || relPath.startsWith("lib/")) {
    lines.forEach((line, idx) => {
      if (/\b(TODO|FIXME)\b/.test(line)) {
        addIssue("TODO_FIXME", file, idx + 1, "Remove TODO/FIXME in production-critical paths.");
      }
    });
  }
}

if (issues.length) {
  const byCode = issues.reduce((acc, i) => {
    acc[i.code] = (acc[i.code] ?? 0) + 1;
    return acc;
  }, {});

  console.error("audit:repo failed");
  console.error(
    Object.entries(byCode)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
  );
  for (const i of issues) {
    console.error(`${i.code} ${i.filePath}:${i.line} ${i.message}`);
  }
  process.exit(1);
} else {
  console.log("audit:repo ok");
}
