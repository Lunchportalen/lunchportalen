// tests/tenant-isolation-api-gate.test.ts
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

type RouteSpec = {
  name: string;
  file: string; // repo-relative path
  mustHaveTenantScope: boolean;
  mustNotReadTenantFromClient: boolean;
};

const ROUTES: RouteSpec[] = [
  {
    name: "orders.toggle",
    file: "app/api/orders/toggle/route.ts",
    mustHaveTenantScope: true,
    mustNotReadTenantFromClient: true,
  },
  {
    name: "order.window",
    file: "app/api/order/window/route.ts",
    mustHaveTenantScope: true,
    mustNotReadTenantFromClient: true,
  },
  {
    name: "order.bulk-set",
    file: "app/api/order/bulk-set/route.ts",
    mustHaveTenantScope: true,
    mustNotReadTenantFromClient: true,
  },
];

function readFile(repoRel: string) {
  const p = path.join(process.cwd(), repoRel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${repoRel}`);
  return fs.readFileSync(p, "utf8");
}

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function mustContain(src: string, re: RegExp) {
  expect(src).toMatch(re);
}

function mustNotContain(src: string, re: RegExp) {
  expect(src).not.toMatch(re);
}

/**
 * Accept either:
 *  A) routeGuard: scopeOr401(...)
 *  B) scope engine: getScope(req) + ScopeError
 */
function hasTenantScopeMechanism(src: string) {
  const s = stripComments(src);

  const usesRouteGuard = /\bscopeOr401\b/.test(s);
  const usesScopeEngine =
    /\bgetScope\b/.test(s) && /\bScopeError\b/.test(s) && /from\s+["']@\/lib\/auth\/scope["']/.test(s);

  return { usesRouteGuard, usesScopeEngine, ok: usesRouteGuard || usesScopeEngine };
}

/**
 * Gate: Route must not use tenant identifiers from client body/query.
 * (Heuristics + strict, but avoids false positives by not banning schema fields inside DB writes)
 */
function assertNoTenantFromClient(routeName: string, src: string) {
  const s = stripComments(src);

  // Body reads
  mustNotContain(s, /\bbody\.\s*company_id\b/i);
  mustNotContain(s, /\bbody\.\s*location_id\b/i);
  mustNotContain(s, /\bbody\.\s*companyId\b/i);
  mustNotContain(s, /\bbody\.\s*locationId\b/i);

  // Query reads
  mustNotContain(s, /searchParams\.get\(\s*["']company_id["']\s*\)/i);
  mustNotContain(s, /searchParams\.get\(\s*["']location_id["']\s*\)/i);
  mustNotContain(s, /searchParams\.get\(\s*["']companyId["']\s*\)/i);
  mustNotContain(s, /searchParams\.get\(\s*["']locationId["']\s*\)/i);

  // “Accept body shape” patterns (only for explicit destructuring / schema-type acceptance)
  // Note: We do NOT block DB column names in upserts; only explicit body acceptance patterns.
  mustNotContain(s, /\{\s*[^}]*\bcompany_id\b[^}]*\}\s*=\s*body/i);
  mustNotContain(s, /\{\s*[^}]*\blocation_id\b[^}]*\}\s*=\s*body/i);
  mustNotContain(s, /\{\s*[^}]*\bcompanyId\b[^}]*\}\s*=\s*body/i);
  mustNotContain(s, /\{\s*[^}]*\blocationId\b[^}]*\}\s*=\s*body/i);

  // Optional: stronger rule — do not pass client tenant into requireRule-like calls
  // (If you ever need exceptions, remove these 2 lines.)
  mustNotContain(s, /\brequireRule\b[\s\S]*\bbody\.\s*company/i);
  mustNotContain(s, /\brequireRule\b[\s\S]*\bsearchParams\.get\(\s*["']company/i);

  // Give a helpful message if it fails (Vitest will show pattern; routeName helps pinpoint)
  expect(true, `${routeName}: ok`).toBe(true);
}

describe("TENANT ISOLATION — API gate (static)", () => {
  test("routes must use a tenant scope mechanism (scopeOr401 OR getScope)", () => {
    for (const r of ROUTES) {
      const src = readFile(r.file);
      const { ok, usesRouteGuard, usesScopeEngine } = hasTenantScopeMechanism(src);

      if (r.mustHaveTenantScope) {
        expect(
          ok,
          `${r.name}: must use scopeOr401 (routeGuard) OR getScope+ScopeError (auth/scope)`
        ).toBe(true);

        // Optional debug in failure cases:
        expect(typeof usesRouteGuard).toBe("boolean");
        expect(typeof usesScopeEngine).toBe("boolean");
      }
    }
  });

  test("routes must not take tenant identifiers from client body/query", () => {
    for (const r of ROUTES) {
      if (!r.mustNotReadTenantFromClient) continue;
      const src = readFile(r.file);
      assertNoTenantFromClient(r.name, src);
    }
  });

  test("routes must import either routeGuard or auth/scope (tenant source-of-truth)", () => {
    for (const r of ROUTES) {
      const s = stripComments(readFile(r.file));

      const importsRouteGuard = /from\s+["']@\/lib\/http\/routeGuard["']/.test(s);
      const importsScopeEngine = /from\s+["']@\/lib\/auth\/scope["']/.test(s);

      expect(
        importsRouteGuard || importsScopeEngine,
        `${r.name}: must import @/lib/http/routeGuard OR @/lib/auth/scope`
      ).toBe(true);
    }
  });
});
