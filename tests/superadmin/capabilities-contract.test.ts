import { describe, expect, test } from "vitest";

import { capabilities, capabilitiesByGroup } from "@/lib/superadmin/capabilities";

describe("superadmin capabilities (IA contract)", () => {
  test("core surface includes companies, agreements, users, system health", () => {
    const ids = new Set(capabilities.map((c) => c.id));
    expect(ids.has("companies")).toBe(true);
    expect(ids.has("agreements")).toBe(true);
    expect(ids.has("users")).toBe(true);
    expect(ids.has("system")).toBe(true);
    expect(ids.has("bo-social-calendar")).toBe(true);
    expect(ids.has("bo-seo-growth")).toBe(true);
    expect(ids.has("bo-esg")).toBe(true);
  });

  test("capabilitiesByGroup returns non-empty groups", () => {
    const g = capabilitiesByGroup();
    expect(g.length).toBeGreaterThan(0);
    expect(g.some((x) => x.group === "core" && x.items.length > 0)).toBe(true);
  });
});
