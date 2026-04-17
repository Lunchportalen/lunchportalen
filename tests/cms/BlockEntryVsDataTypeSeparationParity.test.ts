import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("U95 BlockEntryVsDataTypeSeparationParity", () => {
  it("blockEditorDataTypes dokumenterer skilllet mot block entries (kildekommentar)", () => {
    const file = path.join(process.cwd(), "lib", "cms", "blocks", "blockEditorDataTypes.ts");
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/Block Entry/i);
    expect(src).toMatch(/Data Type/i);
  });

  it("blockTypeDefinitions importerer ikke blockEditorDataTypes (adskilte ansvar)", () => {
    const entry = path.join(process.cwd(), "lib", "cms", "blocks", "blockTypeDefinitions.ts");
    const enSrc = readFileSync(entry, "utf8");
    expect(enSrc).not.toContain("blockEditorDataTypes");
  });
});
