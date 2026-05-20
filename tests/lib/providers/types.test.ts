import { describe, expect, test } from "vitest";

import {
  BILLING_MODELS,
  isBillingModel,
  isProviderRole,
  isProviderStatus,
  PROVIDER_ROLES,
  PROVIDER_STATUSES,
  type BillingModel,
  type ProviderRole,
  type ProviderStatus,
} from "@/lib/providers/types";

describe("isProviderStatus", () => {
  test.each(["ACTIVE", "PAUSED", "SUSPENDED", "CLOSED"] as const)(
    "returns true for valid status %s",
    (status) => {
      expect(isProviderStatus(status)).toBe(true);
    },
  );

  test.each(["active", "PENDING", "", "ACTIVE "])("returns false for invalid string %j", (value) => {
    expect(isProviderStatus(value)).toBe(false);
  });

  test.each([null, undefined, 1, {}, []])("returns false for non-string %j", (value) => {
    expect(isProviderStatus(value)).toBe(false);
  });
});

describe("isProviderRole", () => {
  test.each(["provider_admin", "provider_kitchen", "provider_viewer"] as const)(
    "returns true for valid role %s",
    (role) => {
      expect(isProviderRole(role)).toBe(true);
    },
  );

  test.each(["admin", "provider_admin ", "company_admin"])("returns false for invalid string %j", (value) => {
    expect(isProviderRole(value)).toBe(false);
  });

  test.each([null, undefined, false, { role: "provider_admin" }])("returns false for non-string %j", (value) => {
    expect(isProviderRole(value)).toBe(false);
  });
});

describe("isBillingModel", () => {
  test.each(["SAAS_FIXED", "SAAS_PER_COMPANY", "CUSTOM"] as const)("returns true for valid model %s", (model) => {
    expect(isBillingModel(model)).toBe(true);
  });

  test.each(["saas_fixed", "PER_COMPANY", ""])("returns false for invalid string %j", (value) => {
    expect(isBillingModel(value)).toBe(false);
  });

  test.each([null, undefined, 0, ["SAAS_FIXED"]])("returns false for non-string %j", (value) => {
    expect(isBillingModel(value)).toBe(false);
  });
});

describe("PROVIDER_STATUSES const array", () => {
  test("includes all 4 statuses", () => {
    expect(PROVIDER_STATUSES).toHaveLength(4);
    expect([...PROVIDER_STATUSES].sort()).toEqual(["ACTIVE", "CLOSED", "PAUSED", "SUSPENDED"]);
  });

  test("is readonly at type level", () => {
    const _check: readonly ProviderStatus[] = PROVIDER_STATUSES;
    expect(_check).toBe(PROVIDER_STATUSES);
  });
});

describe("PROVIDER_ROLES const array", () => {
  test("includes all 3 roles", () => {
    expect(PROVIDER_ROLES).toHaveLength(3);
    expect([...PROVIDER_ROLES]).toEqual(["provider_admin", "provider_kitchen", "provider_viewer"]);
  });

  test("is readonly at type level", () => {
    const _check: readonly ProviderRole[] = PROVIDER_ROLES;
    expect(_check).toBe(PROVIDER_ROLES);
  });
});

describe("BILLING_MODELS const array", () => {
  test("includes all 3 models", () => {
    expect(BILLING_MODELS).toHaveLength(3);
    expect([...BILLING_MODELS]).toEqual(["SAAS_FIXED", "SAAS_PER_COMPANY", "CUSTOM"]);
  });

  test("is readonly at type level", () => {
    const _check: readonly BillingModel[] = BILLING_MODELS;
    expect(_check).toBe(BILLING_MODELS);
  });
});
