import { describe, expect, it } from "vitest";
import { getBlockFormLayout } from "@/app/(backoffice)/backoffice/content/_components/blockFieldSchemas";

describe("BlockSchemaQuality (U74)", () => {
  it("hero: innhold vs media/handling grupper og påkrevd tittel", () => {
    const l = getBlockFormLayout("hero");
    expect(l).not.toBeNull();
    const names = l!.groups?.map((g) => g.name) ?? [];
    expect(names.some((n) => n.toLowerCase().includes("innhold"))).toBe(true);
    expect(names.some((n) => n.includes("CTA") || n.toLowerCase().includes("handling"))).toBe(true);
    expect(l!.requiredKeys).toContain("title");
  });

  it("hero_full: presentasjon egen gruppe + gradient-felt", () => {
    const l = getBlockFormLayout("hero_full");
    expect(l?.groups?.some((g) => g.name.toLowerCase().includes("presentasjon"))).toBe(true);
    expect(l?.fields.some((f) => f.key === "useGradient")).toBe(true);
  });

  it("cta: innhold / primær / sekundær grupper og påkrevde primærfelt", () => {
    const l = getBlockFormLayout("cta");
    expect(l?.groups?.length).toBeGreaterThanOrEqual(3);
    expect(l?.requiredKeys).toEqual(expect.arrayContaining(["title", "buttonLabel", "buttonHref"]));
    expect(l?.fields.some((f) => f.key === "secondaryButtonLabel")).toBe(true);
  });

  it("U76: schema-grupper bærer innhold vs presentasjon (section)", () => {
    const hero = getBlockFormLayout("hero");
    const sections = new Set(hero?.groups?.map((g) => g.section).filter(Boolean));
    expect(sections.has("content")).toBe(true);
    expect(sections.has("settings")).toBe(true);

    const cta = getBlockFormLayout("cta");
    expect(cta?.groups?.every((g) => g.section === "content" || g.section === "settings")).toBe(true);
    expect(cta?.groups?.some((g) => g.section === "content")).toBe(true);
    expect(cta?.groups?.filter((g) => g.section === "settings").length).toBeGreaterThanOrEqual(2);
  });

  it("U80: cards / zigzag / grid har structure-seksjon i layout-metadata", () => {
    const cards = getBlockFormLayout("cards");
    expect(cards?.groups?.some((g) => g.section === "structure")).toBe(true);
    const zigzag = getBlockFormLayout("zigzag");
    expect(zigzag?.groups?.some((g) => g.section === "structure")).toBe(true);
    const grid = getBlockFormLayout("grid");
    expect(grid?.groups?.some((g) => g.section === "structure")).toBe(true);
    const related = getBlockFormLayout("relatedLinks");
    expect(related?.groups?.some((g) => g.section === "structure")).toBe(true);
  });
});
