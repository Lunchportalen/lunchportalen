import { describe, expect, test } from "vitest";

import {
  buildEffectiveParsedDesignSettingsLayered,
  CMS_META_PAGE_DESIGN_KEY,
  CMS_META_SECTION_DESIGN_KEY,
  mergeFullDesign,
  parseBlockConfig,
  parseDesignSettingsFromSettingsData,
} from "@/lib/cms/design/designContract";

const globalRoot = {
  designSettings: {
    surface: { section: "default" },
    spacing: { section: "normal" },
    typography: { heading: "default", body: "default" },
    layout: { container: "normal" },
  },
};

describe("buildEffectiveParsedDesignSettingsLayered", () => {
  test("global-only matches parseDesignSettingsFromSettingsData when meta empty", () => {
    const a = parseDesignSettingsFromSettingsData(globalRoot);
    const b = buildEffectiveParsedDesignSettingsLayered(globalRoot, {}, null);
    expect(b.surface.section).toBe(a.surface.section);
    expect(b.layout.container).toBe(a.layout.container);
  });

  test("page meta overrides global tokens", () => {
    const meta = {
      [CMS_META_PAGE_DESIGN_KEY]: {
        surface: { section: "contrast" },
      },
    };
    const m = buildEffectiveParsedDesignSettingsLayered(globalRoot, meta, null);
    expect(m.surface.section).toBe("contrast");
  });

  test("section overlay wins over page for same token", () => {
    const meta = {
      [CMS_META_PAGE_DESIGN_KEY]: { surface: { section: "alt" } },
      [CMS_META_SECTION_DESIGN_KEY]: { hero: { surface: { section: "contrast" } } },
    };
    const m = buildEffectiveParsedDesignSettingsLayered(globalRoot, meta, "hero");
    expect(m.surface.section).toBe("contrast");
  });

  test("section scopes are isolated by id", () => {
    const meta = {
      [CMS_META_SECTION_DESIGN_KEY]: {
        a: { spacing: { section: "wide" } },
        b: { spacing: { section: "tight" } },
      },
    };
    const ma = buildEffectiveParsedDesignSettingsLayered(globalRoot, meta, "a");
    const mb = buildEffectiveParsedDesignSettingsLayered(globalRoot, meta, "b");
    expect(ma.spacing.section).toBe("wide");
    expect(mb.spacing.section).toBe("tight");
  });
});

describe("mergeFullDesign after layered effective DS", () => {
  test("block config still overrides merged global/page/section for surface", () => {
    const meta = {
      [CMS_META_PAGE_DESIGN_KEY]: { surface: { section: "contrast" } },
    };
    const effective = buildEffectiveParsedDesignSettingsLayered(globalRoot, meta, null);
    const merged = mergeFullDesign(
      { surface: { section: "default" } },
      effective,
      "richText",
    );
    expect(merged.surface.section).toBe("default");
  });
});

describe("parseBlockConfig sectionId", () => {
  test("persists trimmed sectionId", () => {
    const c = parseBlockConfig({ sectionId: "  sec_a  " });
    expect(c?.sectionId).toBe("sec_a");
  });
});
