import { describe, expect, it } from "vitest";
import { createBackofficeBlockDraft } from "@/lib/cms/backofficeBlockCatalog";
import { expandRawBlockRowToFlatRenderFields } from "@/lib/cms/blocks/blockEntryContract";

describe("BlockDefaultsParity (U74)", () => {
  const types = ["cards", "zigzag", "cta", "grid", "pricing", "hero", "hero_full"] as const;

  function draftFlat(type: (typeof types)[number]) {
    const d = createBackofficeBlockDraft(type);
    expect(d).not.toBeNull();
    return expandRawBlockRowToFlatRenderFields({ id: "draft-check", type, ...d! });
  }

  it.each(types)("draft %s har ikke tom «leketøy»-tittel der tittel forventes", (type) => {
    const flat = draftFlat(type);
    if (type === "pricing") {
      expect(String(flat.title ?? "").trim().length).toBeGreaterThan(3);
      return;
    }
    const t = String(flat.title ?? "").trim();
    expect(t.length).toBeGreaterThan(3);
  });

  it("kort-seksjon: minst tre elementer i items med tekst", () => {
    const flat = draftFlat("cards");
    const items = Array.isArray(flat.items) ? flat.items : [];
    expect(items.length).toBeGreaterThanOrEqual(3);
    const first = items[0] as Record<string, unknown>;
    expect(String(first?.title ?? "").trim().length).toBeGreaterThan(0);
    expect(String(first?.text ?? "").trim().length).toBeGreaterThan(0);
  });

  it("cta: primær og sekundær knapp har fornuftige standardverdier", () => {
    const flat = draftFlat("cta");
    expect(String(flat.buttonLabel ?? "").trim().length).toBeGreaterThan(0);
    expect(String(flat.buttonHref ?? "").trim().length).toBeGreaterThan(0);
    expect(String(flat.secondaryButtonLabel ?? "").trim().length).toBeGreaterThan(0);
  });
});
