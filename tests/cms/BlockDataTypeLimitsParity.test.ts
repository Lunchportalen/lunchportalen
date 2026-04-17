/**
 * U94 — min/max, add-guard og validering følger Data Type-definisjonen.
 */
import { describe, expect, it } from "vitest";
import {
  canAddBlockForDataType,
  getBlockEditorDataTypeForDocument,
  validateBlockCountForDataType,
} from "@/lib/cms/blocks/blockEditorDataTypes";

describe("BlockDataTypeLimitsParity (U94)", () => {
  it("micro_landing: maks 3 — kan ikke legge til ved 3 blokker", () => {
    expect(canAddBlockForDataType("micro_landing", 3)).toBe(false);
    expect(canAddBlockForDataType("micro_landing", 2)).toBe(true);
  });

  it("micro_landing: validering feiler over maks", () => {
    const err = validateBlockCountForDataType("micro_landing", 4);
    expect(err).toBeTruthy();
    expect(err).toMatch(/maks 3/i);
  });

  it("micro_landing: validering feiler under min", () => {
    const err = validateBlockCountForDataType("micro_landing", 0);
    expect(err).toBeTruthy();
    expect(err).toMatch(/minst 1/i);
  });

  it("page: marketing data type har høyt tak — kan legge til ved mange blokker", () => {
    expect(canAddBlockForDataType("page", 100)).toBe(true);
    expect(validateBlockCountForDataType("page", 100)).toBeNull();
  });

  it("createButtonLabel skiller micro fra standard page via dokument→data type", () => {
    const pageDt = getBlockEditorDataTypeForDocument("page");
    const microDt = getBlockEditorDataTypeForDocument("micro_landing");
    expect(pageDt?.createButtonLabel).toBe("Legg til innhold");
    expect(microDt?.createButtonLabel).toBe("Legg til blokk (maks 3)");
  });
});
