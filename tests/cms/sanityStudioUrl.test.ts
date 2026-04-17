import { afterEach, describe, expect, it } from "vitest";

import { getSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";

describe("getSanityStudioBaseUrl", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("bruker NEXT_PUBLIC_SANITY_STUDIO_URL når satt", () => {
    process.env.NEXT_PUBLIC_SANITY_STUDIO_URL = "https://studio.example.com/";
    process.env.SANITY_STUDIO_URL = "";
    expect(getSanityStudioBaseUrl()).toBe("https://studio.example.com");
  });

  it("fallback til SANITY_STUDIO_URL når NEXT_PUBLIC mangler", () => {
    delete process.env.NEXT_PUBLIC_SANITY_STUDIO_URL;
    process.env.SANITY_STUDIO_URL = "https://alt-studio.example";
    expect(getSanityStudioBaseUrl()).toBe("https://alt-studio.example");
  });
});
