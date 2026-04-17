import { describe, expect, test } from "vitest";
import { validateEditorField } from "@/app/(backoffice)/backoffice/content/_components/blockFieldSchemas";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

/** U91: skjemavalidering leser lag via flat projeksjon (ikke bare rot-nøkler på blokk-objektet). */
describe("BlockContentSettingsSeparationParity (U91)", () => {
  test("hero title ligger i contentData men valideres som feltet title", () => {
    const block = normalizeBlock({
      id: "1",
      type: "hero",
      title: "",
      subtitle: "",
      imageId: "",
      ctaLabel: "",
      ctaHref: "",
    });
    expect(block?.type).toBe("hero");
    const err = validateEditorField(
      "hero",
      { key: "title", label: "T", kind: "text", required: true },
      block as unknown as Record<string, unknown>,
    );
    expect(err).toBeTruthy();
  });

  test("cta buttonLabel ligger i structureData men valideres som feltet buttonLabel", () => {
    const block = normalizeBlock({
      id: "2",
      type: "cta",
      title: "X",
      body: "",
      buttonLabel: "",
      buttonHref: "",
    });
    expect(block?.type).toBe("cta");
    const err = validateEditorField(
      "cta",
      { key: "buttonLabel", label: "Knapp", kind: "text", required: true },
      block as unknown as Record<string, unknown>,
    );
    expect(err).toBeTruthy();
  });
});
