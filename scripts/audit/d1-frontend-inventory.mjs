#!/usr/bin/env node
/**
 * Fase D.1 inventory: pages, routes, loading/error, auth patterns, mobile signals
 */
import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";

const root = process.cwd();

function walk(pattern) {
  return globSync(pattern, { cwd: root, windowsPathsNoEscape: true }).map((p) => p.replace(/\\/g, "/"));
}

const pages = walk("app/**/page.tsx");
const routes = walk("app/**/route.ts").filter((p) => !p.startsWith("lib/"));
const loading = walk("app/**/loading.tsx");
const error = walk("app/**/error.tsx");
const notFound = walk("app/**/not-found.tsx");

const tier1Paths = [
  "app/(auth)/login/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/week/page.tsx",
  "app/(app)/home/page.tsx",
  "app/kitchen/page.tsx",
  "app/admin/orders/page.tsx",
  "app/admin/dashboard/page.tsx",
  "app/api/orders/route.ts",
  "app/api/auth/me/route.ts",
  "app/api/auth/post-login/route.ts",
  "app/api/week/route.ts",
  "app/api/kitchen/batch/route.ts",
];

function readSafe(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

function authPattern(src) {
  if (!src) return "MISSING";
  const patterns = [];
  if (/requireAuth|requireRole|requireSession|getUser\(|getSession\(/.test(src)) patterns.push("inline-auth");
  if (/from\s+["']@\/lib\/auth|from\s+["'].*auth\/guard|requireApiAuth|assertRole/.test(src)) patterns.push("helper");
  if (/createServerClient|createClient/.test(src)) patterns.push("supabase-client");
  if (/CRON_SECRET|service_role|adminClient/.test(src)) patterns.push("service/cron");
  if (/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/.test(src) && patterns.length === 0) patterns.push("none-detected");
  return patterns.length ? patterns.join("+") : "unknown";
}

function mobileSignals(src) {
  if (!src) return {};
  return {
    max_sm: (src.match(/\bmax-sm:/g) || []).length,
    min_md: (src.match(/\bmd:/g) || []).length,
    min_lg: (src.match(/\blg:/g) || []).length,
    mx_auto: /\bmx-auto\b/.test(src),
    px4: /\bpx-4\b/.test(src),
    min_w_full: /\bmin-w-full\b/.test(src),
    overflow_x: /\boverflow-x-(auto|scroll|hidden)\b/.test(src),
    use_client: /^["']use client["']/m.test(src),
  };
}

const routeAuth = {};
for (const r of routes) {
  routeAuth[r] = authPattern(readSafe(r));
}

const authCounts = {};
for (const v of Object.values(routeAuth)) authCounts[v] = (authCounts[v] || 0) + 1;

const tier1Deep = tier1Paths.map((rel) => {
  const src = readSafe(rel);
  return { path: rel, exists: !!src, lines: src ? src.split("\n").length : 0, auth: authPattern(src), mobile: mobileSignals(src) };
});

// loading/error coverage by segment
function segmentOf(p) {
  const parts = p.split("/");
  if (parts.includes("(app)")) return "employee-app";
  if (parts.includes("admin")) return "admin";
  if (parts.includes("superadmin")) return "superadmin";
  if (parts.includes("kitchen")) return "kitchen";
  if (parts.includes("driver")) return "driver";
  if (parts.includes("leverandor")) return "leverandor";
  if (parts.includes("(auth)")) return "auth";
  if (parts.includes("(backoffice)")) return "backoffice";
  if (parts.includes("(public)")) return "public";
  return "other";
}

const pagesBySeg = {};
for (const p of pages) {
  const s = segmentOf(p);
  pagesBySeg[s] = (pagesBySeg[s] || 0) + 1;
}

const out = {
  generated_at: new Date().toISOString().slice(0, 10),
  counts: { pages: pages.length, routes: routes.length, loading: loading.length, error: error.length, notFound: notFound.length },
  pagesBySegment: pagesBySeg,
  authCounts,
  tier1Deep,
  loadingFiles: loading,
  errorFiles: error,
  routesNoAuthDetected: routes.filter((r) => routeAuth[r].includes("none-detected")).slice(0, 30),
};

fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(".tmp/d1-frontend-inventory.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ counts: out.counts, authCounts, tier1Deep: out.tier1Deep.map((t) => ({ path: t.path, auth: t.auth, mobile: t.mobile })) }, null, 2));
