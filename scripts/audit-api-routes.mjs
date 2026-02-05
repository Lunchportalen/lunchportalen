// scripts/audit-api-routes.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");

/* =========================
   PREFIX DEFINITIONS
   ========================= */

// Core RC-approved
const AUDITED_PREFIXES = [
  "app/api/superadmin/",
  "app/api/system/",
  "app/api/enterprise/",
];

// K1–K4 + public platform
const RC_EXTRA_PREFIXES = [
  "app/api/agreements/",
  "app/api/me/",
  "app/api/onboarding/",
  "app/api/order/",
  "app/api/orders/",
  "app/api/outbox/",
  "app/api/profile/",
  "app/api/public/",
  "app/api/register/",
  "app/api/scope/",
  "app/api/support/",
  "app/api/week/",
  "app/api/weekplan/",
];

// Explicitly excluded (INFO only)
const EXCLUDED_PREFIXES = [
  "app/api/admin/",
  "app/api/auth/",
  "app/api/driver/",
  "app/api/cron/",
  "app/api/debug/",
  "app/api/dev/",
  "app/api/health/",
  "app/api/kitchen/",
  "app/api/example/",
  "app/api/template/",
  "app/api/_template/",
  "app/api/accept-invite/",
];

const AUDIT_PREFIXES = [...AUDITED_PREFIXES, ...RC_EXTRA_PREFIXES];

const RC_MODE = process.env.RC_MODE === "true";

console.log("[AUDIT MODE]", {
  RC_MODE,
  CI: process.env.CI,
});

/* =========================
   HELPERS
   ========================= */

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p;
  });
}

const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");
const read = (p) => fs.readFileSync(p, "utf8");

const isRouteFile = (p) =>
  p.endsWith("/route.ts") || p.endsWith("/route.tsx");

const startsWithAny = (p, list) =>
  list.some((prefix) => p.startsWith(prefix));

/* =========================
   AUDIT RULES (WARN ONLY)
   ========================= */

function auditRoute(src) {
  const issues = [];

  const usesDag10 =
    src.includes("scopeOr401(") ||
    src.includes("requireRoleOr403(") ||
    src.includes("requireCompanyScopeOr403(") ||
    src.includes("readJson(");

  if (!usesDag10) {
    issues.push("Mangler Dag-10 guard.");
  }

  if (src.includes("withRole")) {
    issues.push("Bruker withRole (LEGACY).");
  }

  if (
    (src.includes("no-store") || src.includes("Cache-Control")) &&
    !src.includes('from "@/lib/http/respond"')
  ) {
    issues.push("Egen cache/no-store – bruk respond.ts.");
  }

  return issues;
}

/* =========================
   MAIN
   ========================= */

if (!fs.existsSync(API_DIR)) {
  console.error("Fant ikke app/api.");
  process.exit(2);
}

const routes = walk(API_DIR)
  .filter(isRouteFile)
  .map(rel);

const FAIL = [];
const WARN = [];
const INFO = [];

for (const route of routes) {
  // 1️⃣ EXCLUDED → INFO ONLY
  if (startsWithAny(route, EXCLUDED_PREFIXES)) {
    INFO.push(route);
    continue;
  }

  // 2️⃣ NOT AUDITED → FAIL
  if (!startsWithAny(route, AUDIT_PREFIXES)) {
    FAIL.push(route);
    continue;
  }

  // 3️⃣ AUDITED → WARN (heuristics)
  const src = read(path.join(ROOT, route));
  const issues = auditRoute(src);
  if (issues.length) WARN.push({ route, issues });
}

/* =========================
   OUTPUT
   ========================= */

if (FAIL.length === 0) {
  console.log("API AUDIT OK");

  if (INFO.length) {
    console.log("\nINFO:");
    INFO.forEach((r) => console.log(`- ${r} (excluded)`));
  }

  console.log(
    `\nSummary: FAIL 0 | WARN ${WARN.length} | INFO ${INFO.length}`
  );
  process.exit(0);
}

console.log("\nAPI AUDIT: FAIL\n");

FAIL.forEach((r) =>
  console.log(`- ${r} (unknown / not audited)`)
);

console.log(
  `\nSummary: FAIL ${FAIL.length} | WARN ${WARN.length} | INFO ${INFO.length}`
);

process.exit(1);
