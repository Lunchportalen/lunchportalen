import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  ALLOWED_TEST_EMAIL_DOMAINS,
  FIXTURE_DATE,
  FIXTURE_MENU_CATEGORY_SANITY,
  FIXTURE_TIER,
  PROD_PROJECT_REF,
  PROVIDER_A,
  PROVIDER_B,
  STAGING_PROJECT_REF,
} from "../../scripts/smoke/fixtures/provider-ab-staging.constants.mjs";
import {
  buildProviderAbFixtureSql,
  ORGANIZATION_FIXTURE_INSERT_COLUMNS,
  ORGANIZATION_PROVIDER_LINK_COLUMN,
  validateOrganizationFixtureSql,
  validateProviderAbFixtureConstants,
} from "../../scripts/smoke/provider-ab-fixture-core.mjs";
import {
  assertSanityStagingDataset,
  buildProviderAbSanityDocs,
} from "../../scripts/smoke/provider-ab-sanity-core.mjs";

const ROOT = process.cwd();
const FIXTURE_SCRIPT = path.join(ROOT, "scripts/smoke/seed-provider-ab-fixture.mjs");
const SANITY_SCRIPT = path.join(ROOT, "scripts/smoke/seed-provider-ab-sanity.mjs");
const CONSTANTS_FILE = path.join(ROOT, "scripts/smoke/fixtures/provider-ab-staging.constants.mjs");

function readUtf8(file: string) {
  return fs.readFileSync(file, "utf8");
}

function collectEmailsFromConstantsSource() {
  const src = readUtf8(CONSTANTS_FILE);
  const matches = src.match(/[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

describe("provider-ab-staging constants", () => {
  test("provider A and B IDs are distinct", () => {
    expect(PROVIDER_A.providerId).not.toBe(PROVIDER_B.providerId);
    expect(PROVIDER_A.companyId).not.toBe(PROVIDER_B.companyId);
    expect(PROVIDER_A.locationId).not.toBe(PROVIDER_B.locationId);
    expect(PROVIDER_A.agreementId).not.toBe(PROVIDER_B.agreementId);
  });

  test("coverage ranges do not overlap", () => {
    const v = validateProviderAbFixtureConstants();
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  test("fixture date and tier/category align for A/B menu proof", () => {
    expect(PROVIDER_A.sanityMenuDayDocId).toContain(FIXTURE_DATE);
    expect(PROVIDER_B.sanityMenuDayDocId).toContain(FIXTURE_DATE);
    expect(PROVIDER_A.sanityMenuDayDocId).toContain(FIXTURE_TIER);
    expect(PROVIDER_B.sanityMenuDayDocId).toContain(FIXTURE_TIER);
    expect(PROVIDER_A.sanityMenuDayDocId).toContain(FIXTURE_MENU_CATEGORY_SANITY);
    expect(PROVIDER_B.sanityMenuDayDocId).toContain(FIXTURE_MENU_CATEGORY_SANITY);
    expect(PROVIDER_A.menuLabel).not.toBe(PROVIDER_B.menuLabel);
  });

  test("constants contain no prod URLs, secrets, or passwords", () => {
    const src = readUtf8(CONSTANTS_FILE);
    expect(src).not.toMatch(/https:\/\/app\.lunchportalen\.no/);
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    expect(PROD_PROJECT_REF).toBe("hkpokyapzarefrgqzkos");
    expect(STAGING_PROJECT_REF).toBe("uigxsboqeruxflgzqztl");
  });

  test("email literals use allowed test domains only", () => {
    for (const email of collectEmailsFromConstantsSource()) {
      const domain = email.split("@")[1] ?? "";
      expect(ALLOWED_TEST_EMAIL_DOMAINS).toContain(domain);
    }
  });
});

describe("seed-provider-ab-fixture.mjs (static guards)", () => {
  const sql = buildProviderAbFixtureSql();
  const script = readUtf8(FIXTURE_SCRIPT);
  const core = readUtf8(path.join(ROOT, "scripts/smoke/provider-ab-fixture-core.mjs"));

  test("SQL uses deterministic fixture IDs", () => {
    expect(sql).toContain(PROVIDER_A.agreementId);
    expect(sql).toContain(PROVIDER_B.providerId);
    expect(sql).toContain(PROVIDER_B.companyId);
  });

  test("SQL contains no DELETE or TRUNCATE", () => {
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  test("script uses resolveStagingDatabaseUrl, not raw DATABASE_URL as source of truth", () => {
    expect(script).toContain("resolveStagingDatabaseUrl");
    expect(script).toContain("assertStagingDatabaseUrl");
    expect(script).not.toMatch(/process\.env\.DATABASE_URL\s*\|\|/);
  });

  test("script guards staging ref and refuses prod", () => {
    expect(core).toContain("STAGING_PROJECT_REF");
    expect(core).toContain("PROD_PROJECT_REF");
    expect(core).toContain("assertStagingDatabaseUrl");
    expect(script).toContain("assertDbTarget");
    expect(script).toContain("resolveStagingDatabaseUrl");
  });

  test("script scopes Provider A correction to fixture agreement/company IDs", () => {
    expect(sql).toContain(`where id = '${PROVIDER_A.companyId}'`);
    expect(sql).toContain(`where id = '${PROVIDER_A.agreementId}'`);
  });

  test("Provider A correction sets Melhus provider_id", () => {
    expect(sql).toContain(`provider_id = '${PROVIDER_A.providerId}'`);
  });

  test("fixture SQL does not reference customer_provider_org_id (R3 rename)", () => {
    expect(sql).not.toContain("customer_provider_org_id");
    expect(core).not.toMatch(/insert into public\.organizations[\s\S]*customer_provider_org_id/i);
  });

  test("fixture SQL links customer org via legacy_provider_id", () => {
    expect(sql).toContain(ORGANIZATION_PROVIDER_LINK_COLUMN);
    expect(sql).toContain(`legacy_provider_id = excluded.${ORGANIZATION_PROVIDER_LINK_COLUMN}`);
    const v = validateOrganizationFixtureSql(sql);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  test("provider org insert keeps legacy_provider_id NULL; customer org points at provider B", () => {
    const providerBlock = sql.match(
      /insert into public\.organizations[\s\S]*?'provider'::public\.org_type[\s\S]*?on conflict \(id\)/i,
    )?.[0];
    const customerBlock = sql.match(
      /insert into public\.organizations[\s\S]*?'customer'::public\.org_type[\s\S]*?on conflict \(id\)/i,
    )?.[0];
    expect(providerBlock).toMatch(/'provider',\s*\n\s*null,/);
    expect(customerBlock).toMatch(new RegExp(`'company',\\s*\\n\\s*'${PROVIDER_B.providerId}'::uuid`));
  });

  test("organization INSERT columns match staging fixture contract", () => {
    for (const col of ORGANIZATION_FIXTURE_INSERT_COLUMNS) {
      expect(sql).toContain(col);
    }
    expect(ORGANIZATION_FIXTURE_INSERT_COLUMNS).toContain("legacy_provider_id");
    expect(ORGANIZATION_FIXTURE_INSERT_COLUMNS).not.toContain("customer_provider_org_id");
  });

  test("script does not log secrets", () => {
    expect(script).not.toMatch(/console\.log\([^)]*password/i);
    expect(script).not.toMatch(/console\.log\([^)]*DATABASE_URL/i);
    expect(script).not.toMatch(/console\.log\([^)]*connectionString/i);
  });
});

describe("seed-provider-ab-sanity.mjs (static guards)", () => {
  const script = readUtf8(SANITY_SCRIPT);

  test("defaults to dry-run; execute is explicit", () => {
    expect(script).toContain("--execute");
    expect(script).toContain("dry-run");
  });

  test("refuses production Sanity dataset", () => {
    expect(() => assertSanityStagingDataset("production")).toThrow(/refuse/i);
    expect(assertSanityStagingDataset("staging")).toBe("staging");
  });

  test("buildProviderAbSanityDocs uses provider constants", () => {
    const docs = buildProviderAbSanityDocs();
    expect(docs.providerB._id).toBe(PROVIDER_B.providerId);
    expect(docs.menuDayB.provider._ref).toBe(PROVIDER_B.providerId);
    expect(docs.menuDayA.provider._ref).toBe(PROVIDER_A.providerId);
    expect(docs.menuDayB.mealTitle).toBe(PROVIDER_B.menuLabel);
  });
});
