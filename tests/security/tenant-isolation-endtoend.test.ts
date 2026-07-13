/**
 * PHASE 1 — SECURITY AND TENANT ISOLATION (release train).
 *
 * Locks the P0/P1 closures from the 2026-07-13 truth audit:
 *  #20 canAccessCompany/canAccessLocation must never blanket-allow kitchen/driver
 *  #21 /api/kitchen/companies must be tenant-scoped for kitchen role
 *  #23 ai/track requires session; address/* and terms-pdf are rate-limited
 *  #24 support/report tenant deviations are blocking; link-company validates location
 *  #22 anon grant lockdown migration (tables + lp_* functions, RLS untouched)
 *  #27/D4 user_metadata is never an authorization source
 */
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";

import type { AuthContext } from "@/lib/auth/getAuthContext";
import { canAccessCompany, canAccessLocation } from "@/lib/auth/guards";
import { computeRole } from "@/lib/auth/roles";
import { isApiAuthAllowlisted } from "@/lib/server/auth/apiAllowlist";
import { rateLimit } from "@/lib/security/rateLimit";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function ctx(partial: Partial<AuthContext>): AuthContext {
  return {
    ok: true,
    reason: "OK",
    mode: "DB_LOOKUP",
    user: { id: "u1", email: null },
    role: "employee",
    company_id: null,
    location_id: null,
    rid: "rid_test",
    userId: "u1",
    email: null,
    isAuthenticated: true,
    isSessionValid: true,
    isRefreshable: false,
    hasAuthError: false,
    errorType: "NONE",
    source: "SSR_COOKIE",
    sessionOk: true,
    shouldAttemptRefresh: false,
    ...partial,
  } as AuthContext;
}

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOC_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LOC_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("guards — kitchen/driver never get blanket tenant access (#20)", () => {
  it("kitchen: own company true, foreign company FALSE", () => {
    const kitchen = ctx({ role: "kitchen", company_id: COMPANY_A, location_id: LOC_A });
    expect(canAccessCompany(kitchen, COMPANY_A)).toBe(true);
    expect(canAccessCompany(kitchen, COMPANY_B)).toBe(false);
  });

  it("driver: own location true, foreign location FALSE", () => {
    const driver = ctx({ role: "driver", company_id: COMPANY_A, location_id: LOC_A });
    expect(canAccessLocation(driver, LOC_A)).toBe(true);
    expect(canAccessLocation(driver, LOC_B)).toBe(false);
  });

  it("kitchen/driver without assignment: fail-closed FALSE", () => {
    const unassigned = ctx({ role: "kitchen", company_id: null, location_id: null });
    expect(canAccessCompany(unassigned, COMPANY_A)).toBe(false);
    expect(canAccessLocation(unassigned, LOC_A)).toBe(false);
  });

  it("employee foreign company FALSE; company_admin foreign company FALSE (A never reads B)", () => {
    const employee = ctx({ role: "employee", company_id: COMPANY_A });
    const admin = ctx({ role: "company_admin", company_id: COMPANY_A });
    expect(canAccessCompany(employee, COMPANY_B)).toBe(false);
    expect(canAccessCompany(admin, COMPANY_B)).toBe(false);
    expect(canAccessCompany(admin, COMPANY_A)).toBe(true);
  });

  it("superadmin positive control: full access retained", () => {
    const superadmin = ctx({ role: "superadmin" });
    expect(canAccessCompany(superadmin, COMPANY_B)).toBe(true);
    expect(canAccessLocation(superadmin, LOC_B)).toBe(true);
  });

  it("invalid session: always FALSE regardless of role", () => {
    const dead = ctx({ role: "superadmin", sessionOk: false });
    expect(canAccessCompany(dead, COMPANY_A)).toBe(false);
    expect(canAccessLocation(dead, LOC_A)).toBe(false);
  });
});

describe("kitchen companies route — explicit tenant scope (#21)", () => {
  it("kitchen role is filtered on assigned company_id AND location_id", () => {
    const src = read("app/api/kitchen/companies/route.ts");
    expect(src).toContain("tenantCompanyId");
    expect(src).toContain("tenantLocationId");
    expect(src).toMatch(/eq\("company_id",\s*tenantCompanyId\)/);
    expect(src).toMatch(/eq\("location_id",\s*tenantLocationId\)/);
    expect(src).toContain("SCOPE_NOT_ASSIGNED");
  });
});

describe("unauthorized endpoints closed (#23, #24)", () => {
  it("ai/track requires an authenticated session and never trusts client company_id", () => {
    const src = read("app/api/ai/track/route.ts");
    expect(src).toContain("getAuthContext");
    expect(src).toMatch(/sessionOk[\s\S]{0,80}401/);
    expect(src).toContain("baseMeta.company_id = auth.company_id ?? null");
  });

  it("address search/resolve are rate limited per IP", () => {
    for (const rel of ["app/api/address/search/route.ts", "app/api/address/resolve/route.ts"]) {
      const src = read(rel);
      expect(src).toContain('from "@/lib/security/rateLimit"');
      expect(src).toContain("RATE_LIMITED");
      expect(src).toContain("429");
    }
  });

  it("terms-pdf is rate limited with strict input caps", () => {
    const src = read("app/api/onboarding/terms-pdf/route.ts");
    expect(src).toContain("RATE_LIMITED");
    expect(src).toContain(".slice(0, 30)");
    expect(src).toContain(".slice(0, 300)");
  });

  it("support/report blocks tenant deviations (not log-only) and uses profiles.role", () => {
    const src = read("app/api/support/report/route.ts");
    expect(src).toContain("COMPANY_SCOPE_MISMATCH");
    expect(src).toContain("LOCATION_SCOPE_MISMATCH");
    expect(src).not.toMatch(/user_metadata\??\.role/);
  });

  it("link-company verifies location belongs to company", () => {
    const src = read("app/api/superadmin/profiles/link-company/route.ts");
    expect(src).toContain("location_company_mismatch");
    expect(src).toContain("company_locations");
  });

  it("rateLimit denies after the per-key limit", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    for (let i = 0; i < 5; i += 1) expect(rateLimit(key, 5)).toBe(true);
    expect(rateLimit(key, 5)).toBe(false);
  });
});

describe("user_metadata is never an authorization source (D4, #27)", () => {
  it("computeRole ignores user_metadata role claims (no upgrade)", () => {
    const attacker = { email: "user@example.com", user_metadata: { role: "superadmin" } };
    expect(computeRole(attacker, null)).toBe("employee");
    expect(computeRole(attacker, "company_admin")).toBe("company_admin");
  });

  it("superadmin gates read profiles.role, not user_metadata", () => {
    for (const rel of [
      "lib/superadmin/auth.ts",
      "app/api/superadmin/invoices/export/route.ts",
      "app/api/superadmin/invoices/runs/route.ts",
      "app/api/superadmin/invoices/runs/[runId]/route.ts",
      "app/api/superadmin/invoices/runs/[runId]/exports/route.ts",
      "app/api/superadmin/invoices/mapping/bulk/route.ts",
      "app/admin/dashboard/page.tsx",
    ]) {
      const src = read(rel);
      expect(src, `${rel} must not read user_metadata role`).not.toMatch(
        /user_metadata[^,;\n]{0,30}\?\.\s*role/,
      );
    }
    expect(read("lib/superadmin/auth.ts")).toContain('from("profiles")');
  });

  it("no API route reads user_metadata role as a gate (repo scan)", () => {
    const allow = new Set([
      // Diagnostic-only admin-user COUNT in daily sanity cron (no authorization).
      path.join("app", "api", "cron", "daily-sanity", "route.ts"),
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(ent.name)) {
          const rel = path.relative(ROOT, p);
          if (allow.has(rel)) continue;
          const src = fs.readFileSync(p, "utf8");
          if (/user_metadata[^,;\n]{0,30}\)?\?\.\s*role/.test(src)) offenders.push(rel);
        }
      }
    };
    walk(path.join(ROOT, "app", "api"));
    expect(offenders, `user_metadata role reads in API routes:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("anon grant lockdown migration (#22)", () => {
  const MIG = "supabase/migrations/20260818120000_anon_grant_lockdown.sql";

  it("revokes anon on tables/sequences and PUBLIC/anon on lp_ functions", () => {
    const sql = read(MIG);
    expect(sql).toMatch(/REVOKE ALL ON TABLE %I\.%I FROM anon/);
    expect(sql).toMatch(/REVOKE ALL ON SEQUENCE %I\.%I FROM anon/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.%I\(%s\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.%I\(%s\) FROM anon/);
  });

  it("preserves authenticated exactly (snapshot before revoke) and service_role", () => {
    const sql = read(MIG);
    expect(sql).toContain("has_function_privilege('authenticated'");
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.%I\(%s\) TO authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.%I\(%s\) TO service_role/);
  });

  it("re-grants the single verified anon entry point (public /registrer)", () => {
    const sql = read(MIG);
    expect(sql).toContain("lp_company_registration_create");
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.%I\(%s\) TO anon/);
  });

  it("RLS is untouched (grants only — no policy or data mutations)", () => {
    const sql = read(MIG);
    expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP)\s+POLICY\b/i);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM/im);
    expect(sql).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it("fails closed when targets are missing", () => {
    const sql = read(MIG);
    expect(sql).toContain("no tables found (fail-closed)");
    expect(sql).toContain("no lp_ functions found (fail-closed)");
    expect(sql).toContain("lp_company_registration_create not found (fail-closed)");
  });
});

describe("anonymous route matrix — sensitive surfaces never allowlisted", () => {
  it("tenant/commercial routes require session at middleware", () => {
    for (const p of [
      "/api/kitchen/companies",
      "/api/kitchen",
      "/api/driver/stops",
      "/api/orders",
      "/api/admin/metrics",
      "/api/admin/agreement/change-requests",
      "/api/superadmin/invoices/runs",
      "/api/superadmin/invoices/export",
      "/api/superadmin/profiles/link-company",
      "/api/ai/track",
      "/api/week",
      "/api/order/window",
      "/api/support/report",
    ]) {
      expect(isApiAuthAllowlisted(p, "GET"), `${p} must NOT be allowlisted`).toBe(false);
      expect(isApiAuthAllowlisted(p, "POST"), `${p} must NOT be allowlisted (POST)`).toBe(false);
    }
  });

  it("public onboarding endpoints stay reachable (rate-limited in-route)", () => {
    for (const p of ["/api/address/search", "/api/address/resolve", "/api/onboarding/terms-pdf"]) {
      expect(isApiAuthAllowlisted(p, "GET"), `${p} should stay allowlisted`).toBe(true);
    }
  });
});

describe("access-denied audit (no PII) (#12)", () => {
  it("routeGuard audits 403 denials without email", () => {
    const src = read("lib/http/routeGuard.ts");
    expect(src).toContain("ACCESS_DENIED");
    expect(src).toContain("auditAccessDenied");
    // The audit payload must never include the email field.
    const auditFn = src.slice(src.indexOf("function auditAccessDenied"), src.indexOf("function requireKitchenDriverScopeOr403"));
    expect(auditFn).not.toContain("email");
  });
});

describe("employee commercial-data isolation (leakage scan)", () => {
  it("employee week read-paths carry no commercial price fields", () => {
    for (const rel of ["app/api/week/route.ts", "app/api/order/window/route.ts"]) {
      const src = read(rel);
      expect(src, `${rel} must not expose commission/billing fields`).not.toMatch(
        /commission|billing_price|offered_price_cents/,
      );
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
