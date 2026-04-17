import { describe, expect, test } from "vitest";

import {
  mergeDesignSettingsIntoGlobalContentData,
  mergeFullDesign,
  marketingContainerClassString,
  marketingSectionClassString,
  parseDesignSettingsFromSettingsData,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

const DEFAULT_PARSED = {
  card: {} as Record<string, never>,
  surface: { section: "default" as const },
  spacing: { section: "normal" as const },
  typography: { heading: "default" as const, body: "default" as const },
  layout: { container: "normal" as const },
};

describe("parseDesignSettingsFromSettingsData", () => {
  test("returns defaults when missing", () => {
    expect(parseDesignSettingsFromSettingsData(null)).toEqual(DEFAULT_PARSED);
    expect(parseDesignSettingsFromSettingsData({})).toEqual(DEFAULT_PARSED);
    expect(parseDesignSettingsFromSettingsData({ designSettings: {} })).toEqual(DEFAULT_PARSED);
  });

  test("parses card entries", () => {
    const out = parseDesignSettingsFromSettingsData({
      designSettings: {
        card: {
          default: { variant: "default", hover: "lift" },
          hero: { variant: "glass", hover: "none" },
          bad: { variant: "nope" },
        },
      },
    });
    expect(out.card.default).toEqual({ variant: "default", hover: "lift" });
    expect(out.card.hero).toEqual({ variant: "glass", hover: "none" });
    expect(out.card.bad).toBeUndefined();
  });

  test("parses surface, spacing, typography, layout", () => {
    const out = parseDesignSettingsFromSettingsData({
      designSettings: {
        surface: { section: "alt" },
        spacing: { section: "wide" },
        typography: { heading: "display", body: "compact" },
        layout: { container: "full" },
      },
    });
    expect(out.surface.section).toBe("alt");
    expect(out.spacing.section).toBe("wide");
    expect(out.typography).toEqual({ heading: "display", body: "compact" });
    expect(out.layout.container).toBe("full");
  });
});

describe("mergeFullDesign", () => {
  test("block overrides global surface and container", () => {
    const ds = parseDesignSettingsFromSettingsData({
      designSettings: {
        surface: { section: "alt" },
        layout: { container: "normal" },
      },
    });
    const m = mergeFullDesign({ surface: { section: "contrast" }, container: "wide" }, ds, "hero");
    expect(m.surface.section).toBe("contrast");
    expect(m.container.container).toBe("wide");
    expect(marketingContainerClassString(m)).toBe("lp-container-wide");
    expect(marketingSectionClassString(m)).toContain("lp-section");
    expect(marketingSectionClassString(m)).toContain("lp-section--contrast");
  });
});

describe("resolvedCardForBlockType + global layer", () => {
  test("preset when no CMS and no block", () => {
    const r = resolvedCardForBlockType("pricing", undefined, null);
    expect(r).toEqual({ variant: "default", hover: "lift" });
  });

  test("global default then type-specific", () => {
    const ds = parseDesignSettingsFromSettingsData({
      designSettings: {
        card: {
          default: { variant: "flat", hover: "none" },
          pricing: { variant: "elevated", hover: "glow" },
        },
      },
    });
    const r = resolvedCardForBlockType("pricing", undefined, ds);
    expect(r).toEqual({ variant: "elevated", hover: "glow" });
  });

  test("block.config.card overrides global", () => {
    const ds = parseDesignSettingsFromSettingsData({
      designSettings: {
        card: {
          hero: { variant: "glass", hover: "lift" },
        },
      },
    });
    const r = resolvedCardForBlockType("hero", { variant: "flat", hover: "none" }, ds);
    expect(r).toEqual({ variant: "flat", hover: "none" });
  });
});

describe("mergeDesignSettingsIntoGlobalContentData", () => {
  test("merges nested card without dropping siblings", () => {
    const next = mergeDesignSettingsIntoGlobalContentData(
      { social: { location: "oslo" }, designSettings: { card: { hero: { variant: "glass" } } } },
      { card: { pricing: { variant: "elevated", hover: "lift" } } },
    );
    expect(next.social).toEqual({ location: "oslo" });
    expect((next.designSettings as { card: Record<string, unknown> }).card.hero).toEqual({ variant: "glass" });
    expect((next.designSettings as { card: Record<string, unknown> }).card.pricing).toEqual({
      variant: "elevated",
      hover: "lift",
    });
  });

  test("merges layout without wiping card", () => {
    const next = mergeDesignSettingsIntoGlobalContentData(
      { designSettings: { card: { hero: { variant: "glass" } }, layout: { container: "normal" } } },
      { layout: { container: "wide" } },
    );
    const ds = next.designSettings as { card: unknown; layout: unknown };
    expect(ds.layout).toEqual({ container: "wide" });
    expect((ds.card as Record<string, unknown>).hero).toEqual({ variant: "glass" });
  });
});
