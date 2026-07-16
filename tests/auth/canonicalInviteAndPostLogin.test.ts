/**
 * PHASE 3 — Canonical auth, invitation and post-login contracts (fast, no DB).
 * Locks the unified-flow invariants so they cannot regress:
 *  - ONE post-login resolver; invite clients route through it (E5)
 *  - legacy /accept-invite redirects to the canonical /register/employee
 *  - duplicate completion APIs are deprecated (410)
 *  - ONE token/TTL policy (7 days) across all creation sites
 *  - fail-closed acceptance RPCs (source contract) + service-role-only grants
 *  - superadmin pagination locked to 25
 *  - no user_metadata role authorization in AuthStatus
 *  - approval email localized to the recipient
 *  - post-login role landing for every role incl. provider + multi-membership
 */
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPostLoginUrl } from "@/lib/auth/postLoginNav";
import { INVITE_TTL_DAYS, INVITE_TTL_MS, EMPLOYEE_INVITE_TTL_MS } from "@/lib/invites/employeeInviteConstants";
import { roleHomePath, primaryProviderRoleFromMemberships } from "@/lib/auth/roleHome";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("post-login nav helper (E5)", () => {
  it("builds the canonical resolver URL and filters unsafe next", () => {
    expect(buildPostLoginUrl()).toBe("/api/auth/post-login");
    expect(buildPostLoginUrl("/week")).toBe("/api/auth/post-login?next=%2Fweek");
    // Unsafe next targets are dropped (auth pages, api, protocol-relative).
    for (const bad of ["/login", "/register/employee", "/onboarding/x", "//evil.com", "/api/x", "https://evil"]) {
      expect(buildPostLoginUrl(bad)).toBe("/api/auth/post-login");
    }
  });
});

describe("invite clients route through the ONE post-login resolver (E5)", () => {
  it("register/employee + registrer-bruker call goToPostLogin, never a hardcoded home", () => {
    for (const rel of [
      "app/(auth)/register/employee/RegisterEmployeeClient.tsx",
      "app/(auth)/registrer-bruker/RegisterCompanyAdminClient.tsx",
    ]) {
      const src = read(rel);
      expect(src, `${rel} must use goToPostLogin`).toContain("goToPostLogin");
      expect(src, `${rel} must not hardcode /week landing`).not.toContain('router.replace("/week")');
      expect(src, `${rel} must not hardcode /admin landing`).not.toContain('router.replace("/admin")');
    }
  });

  it("login form uses the shared buildPostLoginUrl helper", () => {
    const src = read("app/(auth)/login/LoginForm.tsx");
    expect(src).toContain('from "@/lib/auth/postLoginNav"');
  });
});

describe("legacy invitation routes consolidated", () => {
  it("/accept-invite page redirects to canonical /register/employee", () => {
    const src = read("app/(auth)/accept-invite/page.tsx");
    expect(src).toContain("/register/employee?token=");
    expect(src).toContain("redirect(");
    // The old client component is removed.
    expect(fs.existsSync(path.join(ROOT, "app/(auth)/accept-invite/AcceptInviteClient.tsx"))).toBe(false);
  });

  it("duplicate completion API routes are removed and de-allowlisted", () => {
    for (const rel of [
      "app/api/accept-invite/complete/route.ts",
      "app/api/admin/accept-invite/complete/route.ts",
      "app/api/admin/invites/register/route.ts",
    ]) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} must be deleted`).toBe(false);
    }
    const allow = read("lib/server/auth/apiAllowlist.ts");
    expect(allow).not.toContain('"/api/accept-invite/complete"');
    expect(allow).not.toContain('"/api/admin/accept-invite/complete"');
    expect(allow).not.toContain('"/api/admin/invites/register"');
  });
});

describe("ONE token/TTL policy (7 days)", () => {
  it("canonical constant is 7 days and back-compat alias matches", () => {
    expect(INVITE_TTL_DAYS).toBe(7);
    expect(INVITE_TTL_MS).toBe(1000 * 60 * 60 * 24 * 7);
    expect(EMPLOYEE_INVITE_TTL_MS).toBe(INVITE_TTL_MS);
  });

  it("no invite creation site hardcodes a raw 7-day literal", () => {
    const files = [
      "app/api/admin/invite/route.ts",
      "app/api/admin/employees/invite/route.ts",
      "app/admin/employees/invites/bulk/route.ts",
      "app/api/admin/invites/route.ts",
      "app/api/admin/invites/[id]/route.ts",
      "app/api/admin/employees/invites/resend/route.ts",
      "app/api/admin/employees/invites/link/route.ts",
      "app/api/superadmin/agreements/[agreementId]/approve/route.ts",
    ];
    for (const rel of files) {
      const src = read(rel);
      expect(src, `${rel} must not hardcode TTL literal`).not.toMatch(/1000 \* 60 \* 60 \* 24 \* 7/);
      expect(src, `${rel} must use inviteExpiresAtIso`).toContain("inviteExpiresAtIso");
    }
  });
});

describe("canonical acceptance RPC migration contract", () => {
  const MIG = "supabase/migrations/20260819120000_canonical_invite_accept_rpcs.sql";

  it("both RPCs exist, SECURITY DEFINER, pinned search_path, service-role only", () => {
    const sql = read(MIG);
    for (const fn of ["lp_employee_invite_accept", "lp_company_admin_invite_accept"]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`));
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated`));
    }
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public', 'pg_temp'");
  });

  it("fail-closed error tokens are present", () => {
    const sql = read(MIG);
    for (const tok of [
      "INVITE_INVALID",
      "INVITE_EXPIRED",
      "INVITE_REVOKED",
      "INVITE_USED",
      "INVITE_EMAIL_MISMATCH",
      "COMPANY_MISMATCH",
    ]) {
      expect(sql).toContain(tok);
    }
  });

  it("RPC does profile bind (triggers membership sync) + invite consume, no RLS change", () => {
    const sql = read(MIG);
    expect(sql).toContain("UPDATE public.profiles");
    expect(sql).toMatch(/UPDATE public\.employee_invites/);
    expect(sql).toMatch(/UPDATE public\.company_invites/);
    expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP)\s+POLICY\b/i);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it("acceptance APIs call the canonical RPC and map fail-closed tokens", () => {
    const emp = read("app/api/auth/accept-invite/route.ts");
    expect(emp).toContain("lp_employee_invite_accept");
    expect(emp).toContain("INVITE_ACCEPTED"); // audit
    const adm = read("app/api/auth/register-company-admin/route.ts");
    expect(adm).toContain("lp_company_admin_invite_accept");
    expect(adm).toContain("INVITE_REVOKED");
  });
});

describe("superadmin pagination locked to 25 (A1.1)", () => {
  it("firm/company list defaults are 25", () => {
    expect(read("app/superadmin/superadmin-client.tsx")).toContain("PAGE_LIMIT = 25");
    expect(read("app/superadmin/firms/page.tsx")).toMatch(/sp\.pageSize\) \|\| "25", 25/);
    expect(read("lib/superadmin/queries.ts")).toMatch(/input\.pageSize \?\? 25/);
    expect(read("app/superadmin/companies/[companyId]/companies-client.tsx")).toMatch(/limit \?\? 25/);
  });
});

describe("no user_metadata role authorization (D4)", () => {
  it("AuthStatus does not read user_metadata.role and links to the resolver", () => {
    const src = read("components/auth/AuthStatus.tsx");
    expect(src).not.toMatch(/user_metadata\?\.\s*role/);
    expect(src).toContain('homeHref = "/api/auth/post-login"');
  });
});

describe("approval email localized to recipient", () => {
  it("template accepts locale and route resolves recipient locale", () => {
    const tpl = read("lib/email/templates/companyApproved.ts");
    expect(tpl).toContain("companyApprovedCopy");
    expect(tpl).toMatch(/locale\??:/);
    const route = read("app/api/superadmin/agreements/[agreementId]/approve/route.ts");
    expect(route).toContain("resolveRecipientLocaleForCompany");
    expect(route).toContain("locale: recipientLocale");
  });
});

describe("post-login role landing (all roles incl. provider + multi-membership)", () => {
  it("maps each role to its canonical home", () => {
    expect(roleHomePath({ profileRole: "superadmin" })).toBe("/superadmin");
    expect(roleHomePath({ profileRole: "company_admin", hasActiveAgreement: true })).toBe("/admin");
    expect(roleHomePath({ profileRole: "company_admin", hasActiveAgreement: false })).toBe("/avtale-ikke-aktiv");
    expect(roleHomePath({ profileRole: "employee", hasActiveAgreement: true })).toBe("/week");
    expect(roleHomePath({ profileRole: "employee", hasActiveAgreement: false })).toBe("/avtale-ikke-aktiv");
    expect(roleHomePath({ profileRole: "kitchen" })).toBe("/kitchen");
    expect(roleHomePath({ profileRole: "driver" })).toBe("/driver");
  });

  it("provider membership wins over company profile role", () => {
    expect(roleHomePath({ profileRole: "employee", providerRole: "provider_admin" })).toBe("/leverandor");
    expect(roleHomePath({ profileRole: "company_admin", providerRole: "provider_kitchen" })).toBe("/leverandor/ordrer");
  });

  it("multi-membership picks the highest provider role", () => {
    const primary = primaryProviderRoleFromMemberships([
      { role: "provider_viewer" } as never,
      { role: "provider_admin" } as never,
      { role: "provider_kitchen" } as never,
    ]);
    expect(primary).toBe("provider_admin");
  });

  it("no resolvable role fails closed to login", () => {
    expect(roleHomePath({ profileRole: null })).toContain("/login");
  });
});
