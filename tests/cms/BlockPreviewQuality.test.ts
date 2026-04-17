import { describe, expect, it } from "vitest";
import { blockCollapsedPreviewSummary } from "@/app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

describe("BlockPreviewQuality (U74)", () => {
  it("kort-seksjon: teller fylte kort og variant", () => {
    const block = normalizeBlock({
      id: "1",
      type: "cards",
      title: "Verdi",
      text: "",
      presentation: "plain",
      items: [
        { title: "A", text: "x" },
        { title: "", text: "" },
      ],
    });
    expect(block).toBeTruthy();
    const s = blockCollapsedPreviewSummary(block as Block);
    expect(s).toContain("2 kort");
    expect(s).toContain("1 komplette");
    expect(s).toContain("uten ikonring");
  });

  it("steg: viser modus og kompletthet", () => {
    const block = normalizeBlock({
      id: "1",
      type: "zigzag",
      title: "Flyt",
      presentation: "faq",
      steps: [
        { step: "1", title: "Q", text: "A", imageId: "cms:x" },
        { step: "2", title: "", text: "", imageId: "" },
      ],
    });
    expect(block).toBeTruthy();
    const s = blockCollapsedPreviewSummary(block as Block);
    expect(s).toContain("FAQ");
    expect(s).toMatch(/\d+ steg/);
    expect(s).toMatch(/\d+ komplette/);
  });

  it("priser: tom liste markerer live", () => {
    const block = normalizeBlock({ id: "1", type: "pricing", title: "Pris", plans: [] });
    expect(block).toBeTruthy();
    expect(blockCollapsedPreviewSummary(block as Block)).toContain("Live priser");
  });

  it("cta: tom blokk er tydelig", () => {
    const block = normalizeBlock({
      id: "1",
      type: "cta",
      title: "",
      body: "",
      buttonLabel: "",
      buttonHref: "",
    });
    expect(block).toBeTruthy();
    expect(blockCollapsedPreviewSummary(block as Block)).toContain("Mangler");
  });
});
