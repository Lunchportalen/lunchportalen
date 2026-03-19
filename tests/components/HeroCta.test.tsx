/**
 * Regression: CTA text must not show literal \r\n or \n.
 * Hero.tsx has a "Registrer firma" CTA link; source must not contain escape sequences in that CTA.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HERO_PATH = join(process.cwd(), "components", "Hero.tsx");

describe("Hero CTA — no literal \\r\\n in CTA text", () => {
  test("Hero.tsx CTA link for /registrering does not contain literal \\r\\n or \\n in source", () => {
    const source = readFileSync(HERO_PATH, "utf-8");
    const registrerFirmaLink = source.includes("href=\"/registrering\"");
    expect(registrerFirmaLink).toBe(true);
    expect(source).toContain("Registrer firma");
    expect(source).not.toContain("\\r\\n");
    expect(source).not.toMatch(/>\\r\\n\s*Registrer firma/);
    expect(source).not.toMatch(/Registrer firma\\r\\n\s*</);
    expect(source).not.toMatch(/>\\n\s*Registrer firma/);
    expect(source).not.toMatch(/Registrer firma\\n\s*</);
  });

  test("Hero.tsx contains expected CTA labels (no over-normalization)", () => {
    const source = readFileSync(HERO_PATH, "utf-8");
    expect(source).toContain("Se hvordan det fungerer");
    expect(source).toContain("Registrer firma");
  });
});
