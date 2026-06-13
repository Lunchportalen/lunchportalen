import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("ProviderMenuEditor", () => {
  test("renders form instead of placeholder", async () => {
    const ProviderMenuEditor = (await import("@/components/providers/ProviderMenuEditor")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuEditor));
    expect(html).toContain("Lagre utkast");
    expect(html).toContain("Publiser meny");
    expect(html).toContain("Rettens navn");
    expect(html).toContain("Beskrivelse");
    expect(html).not.toContain("Sanity Studio");
    expect(html).not.toContain("Åpne menyredigering");
  });

  test("Sanity write token is not referenced in client component source", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuEditor.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/SANITY_WRITE_TOKEN/i);
    expect(source).not.toMatch(/requireSanityWrite/i);
    expect(source).not.toMatch(/providerId\s*:/);
    expect(source).toContain("/api/provider/menu-days");
  });
});

describe("LeverandorMenyPage", () => {
  test("page source renders ProviderMenuEditor for editors", async () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("ProviderMenuEditor");
    expect(source).toContain("Publiser en enkel meny for egne bedriftskunder");
    expect(source).not.toContain("Sanity Studio");
    expect(source).not.toContain("getVerifiedSanityStudioBaseUrl");
  });
});

describe("order write-path unchanged", () => {
  test("app/api/orders/route.ts was not modified in this changeset", () => {
    const source = readFileSync(resolve(process.cwd(), "app/api/orders/route.ts"), "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("provider-menu");
  });
});
