import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Provider menu translations page", () => {
  test("explains translations are not employee-live yet", () => {
    const page = readFileSync(
      resolve("app/leverandor/meny/oversettelser/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      resolve("app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel.tsx"),
      "utf8",
    );

    expect(page).toMatch(/Menyoversettelser/);
    expect(page).toMatch(/ansatte ser ennå/i);
    expect(panel).toMatch(/Kun godkjente oversettelser/);
    expect(panel).toMatch(/Dekning per språk/);
    expect(panel).toMatch(/menu-translations\/sources/);
    expect(panel).toMatch(/Delvis dekning er normalt/);
    expect(panel).toMatch(/Godkjenn/);
    expect(panel).toMatch(/Avvis/);
    expect(panel).toMatch(/Lagre utkast/);
    expect(panel).not.toMatch(/automatic AI|AI translation|AI-oversett/i);
    expect(panel).not.toMatch(/employee translations are live/i);
    expect(panel).not.toMatch(/LocaleSwitcher/i);
  });
});
