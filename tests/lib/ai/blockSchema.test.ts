import { describe, expect, test } from "vitest";
import { COMPONENTS, COMPONENT_REGISTRY } from "@/lib/cms/blocks/componentRegistry";
import { CORE_COMPONENT_KEYS } from "@/lib/cms/blocks/componentGroups";
import { COMPONENT_TIERS } from "@/lib/cms/components/tierConfig";
import {
  extractBlocksArrayFromModelJson,
  normalizeValidatedBlocksToCmsFlat,
  rejectRawMarkupInModelResponse,
  validateBlocks,
} from "@/lib/ai/blockSchema";

describe("tier + registry alignment", () => {
  test("COMPONENT_TIERS.core lists every COMPONENT_REGISTRY key", () => {
    const reg = new Set(Object.keys(COMPONENT_REGISTRY));
    expect(COMPONENT_TIERS.core.length).toBe(reg.size);
    for (const k of COMPONENT_TIERS.core) {
      expect(reg.has(k)).toBe(true);
    }
  });
});

describe("COMPONENTS registry", () => {
  test("hero_bleed lists expected AI fields", () => {
    expect(COMPONENTS.hero_bleed.fields).toContain("title");
    expect(COMPONENTS.hero_bleed.fields).toContain("backgroundImage");
    expect(COMPONENTS.hero_bleed.fields).toContain("variant");
  });

  test("enterprise registry size matches CORE_COMPONENT_KEYS (single source of truth)", () => {
    expect(Object.keys(COMPONENT_REGISTRY).length).toBe(CORE_COMPONENT_KEYS.length);
  });
});

describe("rejectRawMarkupInModelResponse", () => {
  test("throws on angle brackets (HTML guard)", () => {
    expect(() => rejectRawMarkupInModelResponse('<div class="x">')).toThrow("AI tried to generate HTML");
  });
  test("throws on closing tag token", () => {
    expect(() => rejectRawMarkupInModelResponse("</p>")).toThrow("AI tried to generate HTML");
  });
  test("allows clean JSON", () => {
    expect(() => rejectRawMarkupInModelResponse('{"blocks":[]}')).not.toThrow();
  });
});

function heroBleedFixture(variant: string) {
  return {
    type: "hero_bleed",
    title: "Hei",
    subtitle: "Undertekst",
    backgroundImage: "https://example.com/bg.jpg",
    ctaPrimary: "",
    ctaPrimaryHref: "",
    variant,
  };
}

describe("validateBlocks", () => {
  test("accepts valid hero_bleed with all component fields", () => {
    const out = validateBlocks([heroBleedFixture("center")]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("hero_bleed");
  });

  test("accepts hero_bleed variant minimal", () => {
    const out = validateBlocks([heroBleedFixture("minimal")]);
    expect(out[0].variant).toBe("minimal");
  });

  test("throws Invalid component type for unknown type", () => {
    expect(() =>
      validateBlocks([{ type: "hero", title: "x", subtitle: "y", backgroundImage: "z" }]),
    ).toThrow("Invalid component type");
  });

  test("throws when required field key missing", () => {
    expect(() =>
      validateBlocks([
        {
          type: "hero_bleed",
          title: "T",
          subtitle: "",
          backgroundImage: "x",
          ctaPrimary: "",
          ctaPrimaryHref: "",
        },
      ]),
    ).toThrow("Missing field: variant");
  });

  test("throws on unknown extra field", () => {
    expect(() => validateBlocks([{ ...heroBleedFixture("center"), extra: "nope" }])).toThrow(
      "Invalid field: extra",
    );
  });

  test("accepts banner with layout variant (stored as center after normalize)", () => {
    const out = validateBlocks([
      {
        type: "banner",
        text: "Hei",
        backgroundImage: "cms:x",
        ctaLabel: "",
        ctaHref: "",
        variant: "left",
      },
    ]);
    expect(out).toHaveLength(1);
  });

  test("accepts text_block with variant", () => {
    const out = validateBlocks([{ type: "text_block", title: "H", body: "B", variant: "center" }]);
    expect(out[0].type).toBe("text_block");
  });

  test("accepts grid_2 with all fields", () => {
    const out = validateBlocks([
      {
        type: "grid_2",
        title: "T",
        subtitle: "",
        card1Title: "a",
        card1Image: "",
        card2Title: "b",
        card2Image: "",
        variant: "center",
      },
    ]);
    expect(out[0].type).toBe("grid_2");
  });

  test("maps text_block to richText on normalize (drops variant)", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([{ type: "text_block", title: "H", body: "B", variant: "minimal" }]),
    );
    expect(out[0].type).toBe("richText");
    expect(out[0].heading).toBe("H");
    expect(out[0].body).toBe("B");
    expect(out[0]).not.toHaveProperty("variant");
  });

  test("maps cta_block to cta on normalize", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        { type: "cta_block", title: "T", body: "", ctaLabel: "Go", ctaHref: "/x", variant: "center" },
      ]),
    );
    expect(out[0].type).toBe("cta");
    expect(out[0].buttonLabel).toBe("Go");
    expect(out[0].buttonHref).toBe("/x");
  });

  test("maps hero_split to hero_full", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "hero_split",
          title: "T",
          subtitle: "S",
          image: "cms:img",
          ctaLabel: "X",
          ctaHref: "/y",
          variant: "left",
        },
      ]),
    );
    expect(out[0].type).toBe("hero_full");
    expect(out[0].imageId).toBe("cms:img");
  });

  test("maps grid_2 to grid", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "grid_2",
          title: "G",
          subtitle: "Sub",
          card1Title: "a",
          card1Image: "u1",
          card2Title: "b",
          card2Image: "u2",
          variant: "minimal",
        },
      ]),
    );
    expect(out[0].type).toBe("grid");
    expect(out[0].variant).toBe("center");
    expect(Array.isArray(out[0].items)).toBe(true);
    expect((out[0].items as unknown[])).toHaveLength(2);
  });
});

describe("extractBlocksArrayFromModelJson", () => {
  test("reads blocks key", () => {
    expect(extractBlocksArrayFromModelJson({ blocks: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });
  test("accepts bare array", () => {
    expect(extractBlocksArrayFromModelJson([{ type: "hero_bleed" }])).toEqual([{ type: "hero_bleed" }]);
  });
});

describe("normalizeValidatedBlocksToCmsFlat", () => {
  test("maps backgroundImage to backgroundImageId and assigns id", () => {
    const out = normalizeValidatedBlocksToCmsFlat([heroBleedFixture("center")]);
    expect(out[0].type).toBe("hero_bleed");
    expect(out[0].backgroundImageId).toBe("https://example.com/bg.jpg");
    expect(String(out[0].id ?? "")).toMatch(/^blk_/);
  });

  test("hero_bleed variant minimal persists as center alignment", () => {
    const out = normalizeValidatedBlocksToCmsFlat([heroBleedFixture("minimal")]);
    expect(out[0].variant).toBe("center");
    expect(out[0].textAlign).toBe("center");
  });

  test("banner normalizes to center variant for CMS", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "banner",
          text: "T",
          backgroundImage: "cms:b",
          ctaLabel: "",
          ctaHref: "",
          variant: "minimal",
        },
      ]),
    );
    expect(out[0].variant).toBe("center");
  });

  test("newsletter_signup persists flat with all registry fields", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "newsletter_signup",
          eyebrow: "",
          title: "Tips",
          lede: "Kort tekst.",
          ctaLabel: "Send",
          ctaHref: "https://x.test/signup",
          disclaimer: "",
          submitMethod: "get",
          contentWidth: "narrow",
          variant: "center",
        },
      ]),
    );
    expect(out[0].type).toBe("newsletter_signup");
    expect((out[0] as { lede?: string }).lede).toBe("Kort tekst.");
    expect((out[0] as { submitMethod?: string }).submitMethod).toBe("get");
  });

  test("form_embed persists flat with all registry fields", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "form_embed",
          formId: "",
          iframeSrc: "https://forms.test/embed",
          title: "Bestill demo",
          lede: "Vi kontakter deg innen én virkedag.",
          embedHtml: "",
          contentWidth: "wide",
          variant: "left",
        },
      ]),
    );
    expect(out[0].type).toBe("form_embed");
    expect((out[0] as { iframeSrc?: string }).iframeSrc).toBe("https://forms.test/embed");
    expect((out[0] as { contentWidth?: string }).contentWidth).toBe("wide");
    expect((out[0] as { variant?: string }).variant).toBe("left");
  });

  test("quote_block persists flat with contentWidth and variant", () => {
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "quote_block",
          quote: "Et sitat.",
          author: "Navn",
          role: "Tittel",
          source: "Kilde",
          contentWidth: "normal",
          variant: "minimal",
        },
      ]),
    );
    expect(out[0].type).toBe("quote_block");
    expect((out[0] as { quote?: string }).quote).toBe("Et sitat.");
    expect((out[0] as { contentWidth?: string }).contentWidth).toBe("normal");
    expect((out[0] as { variant?: string }).variant).toBe("center");
  });

  test("testimonial_block persists as testimonial_block with testimonialsJson", () => {
    const row = {
      id: "t-1",
      quote: "Veldig fornøyd.",
      author: "Per",
      role: "Daglig leder",
      company: "Firma AS",
      image: "",
      alt: "",
      logo: "",
    };
    const out = normalizeValidatedBlocksToCmsFlat(
      validateBlocks([
        {
          type: "testimonial_block",
          sectionTitle: "Anbefalinger",
          testimonialsJson: JSON.stringify([row]),
          density: "comfortable",
          variant: "center",
        },
      ]),
    );
    expect(out[0].type).toBe("testimonial_block");
    expect((out[0] as { testimonialsJson?: string }).testimonialsJson).toContain("Veldig fornøyd");
  });
});
