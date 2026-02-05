// scripts/audit-api-routes.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");
const AUDITED_PREFIXES = [
  "app/api/superadmin/",
  "app/api/system/",
  "app/api/enterprise/",
];
const RC_EXTRA_PREFIXES = [
  // K1-K4 routes introduced after RC should be added here explicitly.
];
const EXCLUDED_PREFIXES = ["app/api/admin/", "app/api/auth/", "app/api/driver/"];
const AUDIT_PREFIXES = [...AUDITED_PREFIXES, ...RC_EXTRA_PREFIXES];
// NOTE: Full Dag-10 migration of admin APIs is planned post-RC.

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function hasAny(src, needles) {
  return needles.some((n) => src.includes(n));
}

function isAuditedRoute(file) {
  const r = rel(file);
  return AUDIT_PREFIXES.some((prefix) => r.startsWith(prefix));
}

function isExcludedRoute(file) {
  const r = rel(file);
  return EXCLUDED_PREFIXES.some((prefix) => r.startsWith(prefix));
}

function auditRoute(file, src) {
  const issues = [];

  const isRoute = file.endsWith("/route.ts") || file.endsWith("/route.tsx");
  if (!isRoute) return issues;

  const usesDag10Guard = hasAny(src, [
    "scopeOr401(",
    "requireRoleOr403(",
    "requireCompanyScopeOr403(",
    "readJson(",
  ]);

  const usesWithRole = src.includes("withRole");

  // 1) MÃ¥ bruke Dag-10 guard (direkte eller via legacy wrapper)
  if (!usesDag10Guard && !usesWithRole) {
    issues.push("Mangler Dag-10 guard (scopeOr401/requireRoleOr403/readJson).");
  }

  // 2) withRole er legacy â€“ flagg bruk
  if (usesWithRole) {
    issues.push("Bruker withRole (LEGACY) â€“ migrer til Dag-10 template.");
  }

  // 3) UnngÃ¥ egen cache/no-store logikk i routes
  if (
    hasAny(src, ["Cache-Control", "no-store", "noStoreHeaders("]) &&
    !src.includes('from "@/lib/http/respond"')
  ) {
    issues.push("Har egen cache/no-store hÃ¥ndtering â€“ standardiser via respond.ts.");
  }

  // 4) Heuristikk: template-kontrakt for OK-svar
  if (src.includes("jsonOk(") && !src.includes("ok: true")) {
    issues.push('Returnerer jsonOk uten "ok: true" (template-kontrakt).');
  }
  if (src.includes("jsonOk(") && !src.includes("rid:")) {
    issues.push('Returnerer jsonOk uten "rid:" (template-kontrakt).');
  }

  return issues;
}

if (!fs.existsSync(API_DIR)) {
  console.error("Fant ikke app/api. Avbryter.");
  process.exit(2);
}

const files = walk(API_DIR).filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
const routes = files.filter((p) => p.endsWith("route.ts") || p.endsWith("route.tsx"));

const findings = [];
const outOfScope = [];
for (const f of routes) {
  const src = read(f);
  if (!isAuditedRoute(f)) {
    outOfScope.push({
      file: rel(f),
      reason: isExcludedRoute(f) ? "Explicitly excluded for RC." : "Out of scope for RC.",
    });
    continue;
  }
  const issues = auditRoute(f, src);
  if (issues.length) findings.push({ file: rel(f), issues });
}

if (!findings.length) {
  console.log("API AUDIT OK");
  if (outOfScope.length) {
    console.log("\nOut of scope for RC:");
    for (const it of outOfScope) {
      console.log(`- ${it.file} (${it.reason})`);
    }
  }
  process.exit(0);
}

console.log("API AUDIT: Avvik funnet\n");
for (const it of findings) {
  console.log(`- ${it.file}`);
  for (const msg of it.issues) console.log(`   â€¢ ${msg}`);
}
if (outOfScope.length) {
  console.log("\nOut of scope for RC:");
  for (const it of outOfScope) {
    console.log(`- ${it.file} (${it.reason})`);
  }
}
console.log("\nFiks disse, eller migrer til app/api/_template/route.ts-standard.\n");

process.exit(1);
