import { describe, expect, test } from "vitest";

import { menuContentHasDisplayableCopy } from "@/lib/sanity/menuContentGuards";

describe("menuContentHasDisplayableCopy", () => {
  test("false when missing or empty strings", () => {
    expect(menuContentHasDisplayableCopy(null)).toBe(false);
    expect(menuContentHasDisplayableCopy(undefined)).toBe(false);
    expect(menuContentHasDisplayableCopy({ title: "", description: "" })).toBe(false);
    expect(menuContentHasDisplayableCopy({ title: "   ", description: "  " })).toBe(false);
  });

  test("true for non-empty title", () => {
    expect(menuContentHasDisplayableCopy({ title: "Dagens", description: null })).toBe(true);
  });

  test("true for meaningful description after HTML strip", () => {
    expect(menuContentHasDisplayableCopy({ title: null, description: "<p>Grøt</p>" })).toBe(true);
  });

  test("false for empty HTML-only description", () => {
    expect(menuContentHasDisplayableCopy({ title: "", description: "<p></p><br/>" })).toBe(false);
  });
});
