// @ts-nocheck
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  API_AUTH_ALLOWLIST,
  API_AUTH_ALLOWLIST_GET_ONLY,
  API_AUTH_ALLOWLIST_SIZE,
  isApiAuthAllowlisted,
} from "@/lib/server/auth/apiAllowlist";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");

/** Routes fixed in PR-X1 Fase 3 — must have explicit fail-closed gate in route file. */
const CRITICAL_INLINE_AUTH: Array<{ url: string; file: string; pattern: RegExp }> = [
  { url: "/api/system/outbox/process", file: "app/api/system/outbox/process/route.ts", pattern: /requireCronAuth/ },
  { url: "/api/superadmin/users/set-company-admin", file: "app/api/superadmin/users/set-company-admin/route.ts", pattern: /requireSuperadmin/ },
  { url: "/api/auth/profile", file: "app/api/auth/profile/route.ts", pattern: /denyUnlessSession/ },
  { url: "/api/auth/debug-cookies", file: "app/api/auth/debug-cookies/route.ts", pattern: /devRouteBlocked|LP_DEBUG_AUTH/ },
  { url: "/api/auth/dev-bypass", file: "app/api/auth/dev-bypass/route.ts", pattern: /LP_DEV_BYPASS/ },
  { url: "/api/public/search", file: "app/api/public/search/route.ts", pattern: /anonRateLimitOk|publicSearchQuerySchema/ },
  { url: "/api/revenue/lead", file: "app/api/revenue/lead/route.ts", pattern: /denyUnlessSuperadmin/ },
  { url: "/api/system/freeze", file: "app/api/system/freeze/route.ts", pattern: /denyUnlessSuperadmin/ },
  { url: "/api/edge/ai", file: "app/api/edge/ai/route.ts", pattern: /denyUnlessEdgeSession/ },
];

const CRITICAL_ALLOWLISTED = [
  "/api/public/search",
  "/api/public/demo-interest",
  "/api/public/ai-demo-cta/assign",
  "/api/system/outbox/process",
  "/api/cron/meal-learning",
];

function walkRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkRouteFiles(full, acc);
    else if (ent.name === "route.ts") acc.push(full);
  }
  return acc;
}

function fileToApiPath(file: string): string {
  const rel = path.relative(API_ROOT, file).replace(/\\/g, "/");
  const segs = rel.split("/");
  segs.pop();
  return `/api/${segs.map((s) => (s.startsWith("[") && s.endsWith("]") ? "[id]" : s)).join("/")}`;
}

function scanRoutesContaining(patterns: string[], files: string[]): string[] {
  const hits = new Set<string>();
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    if (patterns.some((p) => src.includes(p))) {
      hits.add(fileToApiPath(file));
    }
  }
  return [...hits].sort();
}

/** Dynamic segments → sample path for allowlist dynamic matchers. */
function isRouteAllowlisted(apiPath: string): boolean {
  if (isApiAuthAllowlisted(apiPath)) return true;
  const sample = apiPath.replace(/\[id\]/g, "sample-id");
  return sample !== apiPath && isApiAuthAllowlisted(sample);
}

const CRON_AUTH = /requireCronAuth\s*\(/;
const WEBHOOK_AUTH = /(verifyWebhook|webhook.*secret|x-sanity-signature|tripletex.*signature|timingSafeEqual|stripe-signature|handleStripeWebhook|INVALID_SIGNATURE)/i;
const ANON_VALIDATION =
  /(anonRateLimitOk|\.safeParse\(|scopeOr401|getAuthContext|signInWithPassword|register-company|onboarding|missing_token|token_hash|employee_invites|company_invites|isEmail|INVALID_EMAIL|sha256Hex|Mangler id|BAD_REQUEST|ws\.geonorge|jsonErr\(|Ugyldig JSON|jsonExactErr|isPlainObject|globalPublicGetResponse|assignVariant|isUuid\(|DEPRECATED|Europe\/Oslo|osloToday)/i;
const API_KEY_AUTH = /(x-api-key|API_KEY|apiKey|v1\/public\/orders)/i;

describe("api-allowlist-regression (DC-011)", () => {
  const routeFiles = walkRouteFiles(API_ROOT);

  test("allowlist size matches canonical count (85)", () => {
    expect(API_AUTH_ALLOWLIST_SIZE).toBe(85);
    expect(API_AUTH_ALLOWLIST.size + API_AUTH_ALLOWLIST_GET_ONLY.size + 3).toBe(85);
  });

  test("every allowlisted static path maps to a route file with category auth evidence", () => {
    for (const url of API_AUTH_ALLOWLIST) {
      expect(isApiAuthAllowlisted(url)).toBe(true);
      const file = routeFiles.find((f) => fileToApiPath(f) === url);
      expect(file, `missing route file for allowlist entry ${url}`).toBeTruthy();
      const src = fs.readFileSync(file!, "utf8");
      const isCron = url.startsWith("/api/cron/") || url === "/api/system/outbox/process";
      const isWebhook = url.startsWith("/api/webhooks/") || url.endsWith("/webhook");
      const isApiKey = url === "/api/v1/public/orders";
      if (isCron) expect(src).toMatch(CRON_AUTH);
      else if (isWebhook) expect(src).toMatch(WEBHOOK_AUTH);
      else if (isApiKey) expect(src).toMatch(API_KEY_AUTH);
      else expect(src).toMatch(ANON_VALIDATION);
    }
    for (const url of API_AUTH_ALLOWLIST_GET_ONLY) {
      expect(isApiAuthAllowlisted(url, "GET")).toBe(true);
      expect(isApiAuthAllowlisted(url, "POST")).toBe(false);
      const file = routeFiles.find((f) => fileToApiPath(f) === url);
      expect(file, `missing route file for GET-only allowlist entry ${url}`).toBeTruthy();
      const src = fs.readFileSync(file!, "utf8");
      expect(src).toMatch(/scopeOr401/);
      expect(src).toMatch(/requireRoleOr403/);
    }
  });

  test("dynamic allowlist patterns match documented segment routes", () => {
    expect(isApiAuthAllowlisted("/api/public/forms/abc-123")).toBe(true);
    expect(isApiAuthAllowlisted("/api/public/forms/abc-123/schema")).toBe(true);
    expect(isApiAuthAllowlisted("/api/webhooks/tripletex-provider/acme")).toBe(true);
    expect(isApiAuthAllowlisted("/api/orders")).toBe(false);
  });

  for (const entry of CRITICAL_INLINE_AUTH) {
    test(`critical inline auth: ${entry.url}`, () => {
      const src = fs.readFileSync(entry.file, "utf8");
      expect(src).toMatch(entry.pattern);
      expect(isApiAuthAllowlisted(entry.url)).toBe(CRITICAL_ALLOWLISTED.includes(entry.url));
    });
  }
});

describe("allowlist invariant: routes with own auth must be allowlisted", () => {
  const routeFiles = walkRouteFiles(API_ROOT);

  test("every route with requireCronAuth is in cron-secret allowlist", () => {
    const cronRoutes = scanRoutesContaining(["requireCronAuth("], routeFiles);
    const missing = cronRoutes.filter((r) => !isRouteAllowlisted(r));
    expect(missing).toEqual([]);
  });

  test("every route with webhook-verify is in webhook-sig allowlist", () => {
    const webhookRoutes = scanRoutesContaining(
      [
        "verifySanityWebhookSignature",
        "verifyTripletexWebhookSignature",
        "handleStripeWebhook",
        "Stripe.webhooks.constructEvent(",
      ],
      routeFiles,
    );
    const missing = webhookRoutes.filter((r) => !isRouteAllowlisted(r));
    expect(missing).toEqual([]);
  });

  test("every route with api-key validation is in api-key allowlist", () => {
    const apiKeyRoutes = scanRoutesContaining(["validateApiKey(", "requireApiKey(", "getTenantContext("], routeFiles);
    const missing = apiKeyRoutes.filter((r) => !isRouteAllowlisted(r));
    expect(missing).toEqual([]);
  });
});
