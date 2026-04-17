import { describe, expect, it } from "vitest";

import { applyInferredPageKeys, inferPageKeyFromSlug, isMissingColumnError } from "@/lib/cms/contentTreePageKey";

describe("contentTreePageKey", () => {
  it("inferPageKeyFromSlug maps known slugs", () => {
    expect(inferPageKeyFromSlug("home")).toBe("home");
    expect(inferPageKeyFromSlug("week")).toBe("employee_week");
    expect(inferPageKeyFromSlug("unknown")).toBe(null);
  });

  it("isMissingColumnError detects postgres page_key message", () => {
    expect(inferPageKeyFromSlug("x")).toBe(null);
    expect(
      isMissingColumnError({ message: 'column "page_key" of relation "content_pages" does not exist' }, "page_key")
    ).toBe(true);
    expect(isMissingColumnError({ message: "something else" }, "page_key")).toBe(false);
  });

  it("applyInferredPageKeys fills from slug when page_key null", () => {
    const out = applyInferredPageKeys([
      { page_key: null, slug: "home" },
      { page_key: "x", slug: "nope" },
    ]);
    expect(out[0]?.page_key).toBe("home");
    expect(out[1]?.page_key).toBe("x");
  });
});
