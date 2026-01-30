// scripts/audit-api-routes.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");

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

  // 1) Må bruke Dag-10 guard (direkte eller via legacy wrapper)
  if (!usesDag10Guard && !usesWithRole) {
    issues.push("Mangler Dag-10 guard (scopeOr401/requireRoleOr403/readJson).");
  }

  // 2) withRole er legacy – flagg bruk
  if (usesWithRole) {
    issues.push("Bruker withRole (LEGACY) – migrer til Dag-10 template.");
  }

  // 3) Unngå egen cache/no-store logikk i routes
  if (hasAny(src, ["Cache-Control", "no-store", "noStoreHeaders("]) && !src.includes('from "@/lib/http/respond"')) {
    issues.push("Har egen cache/no-store håndtering – standardiser via respond.ts.");
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
for (const f of routes) {
  const src = read(f);
  const issues = auditRoute(f, src);
  if (issues.length) findings.push({ file: rel(f), issues });
}

if (!findings.length) {
  console.log("✅ API AUDIT OK: Ingen avvik funnet.");
  process.exit(0);
}

console.log("❌ API AUDIT: Avvik funnet\n");
for (const it of findings) {
  console.log(`- ${it.file}`);
  for (const msg of it.issues) console.log(`   • ${msg}`);
}
console.log("\n➡️ Fiks disse, eller migrer til app/api/_template/route.ts-standard.\n");

process.exit(1);
