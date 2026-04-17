import { describe, expect, it } from "vitest";

import { anonymizeUser } from "@/lib/compliance/gdpr";

describe("anonymizeUser", () => {
  it("returns null for empty input", () => {
    expect(anonymizeUser(null)).toBeNull();
    expect(anonymizeUser(undefined)).toBeNull();
    expect(anonymizeUser("  ")).toBeNull();
  });

  it("prefixes non-empty ids", () => {
    expect(anonymizeUser("abc")).toBe("hashed_abc");
  });
});
