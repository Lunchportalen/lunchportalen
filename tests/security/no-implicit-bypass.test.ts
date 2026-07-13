// @ts-nocheck
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { API_AUTH_ALLOWLIST_SIZE } from "@/lib/server/auth/apiAllowlist";

describe("no-implicit-bypass (DC-011 middleware)", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
  const configSrc = src.match(/export const config = \{[\s\S]*?\};/)?.[0] ?? "";

  test("middleware does not blanket-bypass all /api/* paths", () => {
    expect(src).not.toMatch(/isApi\s*&&\s*!allowAuthApi/);
    expect(src).toContain("isApiAuthAllowlisted");
  });

  test("config.matcher does not exclude /api/", () => {
    expect(configSrc).not.toMatch(/api.*exclude|exclude.*api/i);
    expect(configSrc).not.toContain("/api/");
  });

  test("no wildcard allowlist Set entries", () => {
    for (const line of src.split("\n")) {
      if (line.includes('"/api/') && (line.includes("*") || line.includes("**"))) {
        throw new Error(`wildcard in allowlist line: ${line}`);
      }
    }
  });

  test("API_AUTH_ALLOWLIST_SIZE is 87", () => {
    // 86 → 88: SEC-001 added /api/webhooks/stripe-billing-payments + stripe-provider-setup.
    // 88 → 85: Fase 3 removed 3 duplicate invite-completion routes.
    // 85 → 87: Fase 4 added /api/public/provider-registration + /api/auth/register-provider-admin.
    expect(API_AUTH_ALLOWLIST_SIZE).toBe(87);
  });

  test("non-allowlisted /api/* returns JSON 401 path exists", () => {
    expect(src).toContain("apiUnauthorizedResponse");
    expect(src).toContain('x-lp-mw-api-auth": "401"');
  });
});
