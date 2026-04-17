import { describe, expect, it } from "vitest";
import { blockCollapsedPreviewSummary } from "@/app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

/** U75: nøkkelblokker skal ha tydelig forskjellige preview-signaler (tekstlig sammendrag). */
describe("BlockPreviewIdentityParity (U75)", () => {
  const hero = normalizeBlock({
    id: "h1",
    type: "hero",
    title: "Velkommen",
    subtitle: "Undertekst",
    imageId: "https://x.test/a.jpg",
    ctaLabel: "Bestill",
    ctaHref: "/x",
  }) as Block;

  const cards = normalizeBlock({
    id: "c1",
    type: "cards",
    title: "Verdi",
    text: "Ingress her",
    presentation: "feature",
    items: [{ title: "A", text: "1" }],
    cta: [],
  }) as Block;

  const zigzag = normalizeBlock({
    id: "z1",
    type: "zigzag",
    title: "Slik fungerer det",
    intro: "Intro",
    presentation: "process",
    steps: [{ step: "1", title: "S1", text: "T1", imageId: "u" }],
  }) as Block;

  const pricing = normalizeBlock({
    id: "p1",
    type: "pricing",
    title: "Pris",
    plans: [
      {
        name: "Pro",
        price: "99",
        period: "mnd",
        featured: true,
        features: ["A", "B"],
        ctaLabel: "Velg",
        ctaHref: "/x",
      },
    ],
  }) as Block;

  const cta = normalizeBlock({
    id: "t1",
    type: "cta",
    title: "T",
    eyebrow: "E",
    body: "Støtte",
    buttonLabel: "Gå videre",
    buttonHref: "/y",
    secondaryButtonLabel: "Les mer",
    secondaryButtonHref: "/z",
  }) as Block;

  const related = normalizeBlock({
    id: "r1",
    type: "relatedLinks",
    tags: ["a", "b"],
    maxSuggestions: 4,
    title: "Mer",
    subtitle: "Undertekst",
    emptyFallbackText: "Tomt",
    currentPath: "/foo",
  }) as Block;

  it("parvis: hero vs kort vs steg vs pris vs CTA vs relaterte — ulike signaturer", () => {
    const sh = blockCollapsedPreviewSummary(hero);
    const sc = blockCollapsedPreviewSummary(cards);
    const sz = blockCollapsedPreviewSummary(zigzag);
    const sp = blockCollapsedPreviewSummary(pricing);
    const st = blockCollapsedPreviewSummary(cta);
    const sr = blockCollapsedPreviewSummary(related);
    const set = new Set([sh, sc, sz, sp, st, sr]);
    expect(set.size).toBe(6);
    expect(sh).toMatch(/Undertittel|Primær CTA|Bilde OK/);
    expect(sc).toMatch(/kort ·|Ikonring|Ingress: ja/);
    expect(sz).toMatch(/steg ·|prosess|Ingress: ja/);
    expect(sp).toMatch(/plan|fremhevet|CTA|punkter/);
    expect(st).toMatch(/Primær:|Sekundær:|Støttetekst/);
    expect(sr).toMatch(/Stikkord:|Maks 4|Tomtilstand: egen/);
  });
});
