import { describe, expect, test } from "vitest";

import { menuDayHasDisplayableCopy } from "@/lib/sanity/menuDayGuards";

describe("menuDayHasDisplayableCopy", () => {
  test("false when missing or empty strings", () => {
    expect(menuDayHasDisplayableCopy(null)).toBe(false);
    expect(menuDayHasDisplayableCopy(undefined)).toBe(false);
    expect(menuDayHasDisplayableCopy({ title: "", description: "" })).toBe(false);
    expect(menuDayHasDisplayableCopy({ title: "   ", description: "  " })).toBe(false);
  });

  test("true for non-empty title", () => {
    expect(menuDayHasDisplayableCopy({ title: "Dagens", description: null })).toBe(true);
  });

  test("true for meaningful description after HTML strip", () => {
    expect(menuDayHasDisplayableCopy({ title: null, description: "<p>Grøt</p>" })).toBe(true);
  });

  test("false for empty HTML-only description", () => {
    expect(menuDayHasDisplayableCopy({ title: "", description: "<p></p><br/>" })).toBe(false);
  });
});
