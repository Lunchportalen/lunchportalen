import { describe, expect, test, vi } from "vitest";

import { menuDayProviderGroqClause } from "@/lib/cms/menuDayProviderFilter";

describe("menuDayProviderGroqClause", () => {
  test("scopes query when slug provided", () => {
    const r = menuDayProviderGroqClause("melhus-catering");
    expect(r.legacyUnscoped).toBe(false);
    expect(r.clause).toContain("provider->slug.current");
    expect(r.params).toEqual({ providerSlug: "melhus-catering" });
  });

  test("legacy unscoped when slug omitted", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = menuDayProviderGroqClause(undefined);
    expect(r.legacyUnscoped).toBe(true);
    expect(r.clause).toBe("true");
    expect(r.params).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
