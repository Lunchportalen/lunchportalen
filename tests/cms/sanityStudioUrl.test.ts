import { afterEach, describe, expect, it } from "vitest";

import { getSanityStudioBaseUrl, getVerifiedSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";

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

describe("getVerifiedSanityStudioBaseUrl", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("returnerer null uten eksplisitt env (ingen heuristikk)", () => {
    delete process.env.NEXT_PUBLIC_SANITY_STUDIO_URL;
    delete process.env.SANITY_STUDIO_URL;
    expect(getVerifiedSanityStudioBaseUrl()).toBeNull();
  });

  it("returnerer null for whitespace-only env", () => {
    process.env.NEXT_PUBLIC_SANITY_STUDIO_URL = "   ";
    delete process.env.SANITY_STUDIO_URL;
    expect(getVerifiedSanityStudioBaseUrl()).toBeNull();
  });

  it("returnerer null for ikke-https URL (fail-closed)", () => {
    process.env.NEXT_PUBLIC_SANITY_STUDIO_URL = "http://studio.example.com";
    expect(getVerifiedSanityStudioBaseUrl()).toBeNull();
  });

  it("returnerer normalisert URL når eksplisitt env er satt", () => {
    process.env.NEXT_PUBLIC_SANITY_STUDIO_URL = "https://studio.example.com/";
    expect(getVerifiedSanityStudioBaseUrl()).toBe("https://studio.example.com");
  });

  it("fallback til SANITY_STUDIO_URL når NEXT_PUBLIC mangler", () => {
    delete process.env.NEXT_PUBLIC_SANITY_STUDIO_URL;
    process.env.SANITY_STUDIO_URL = "https://alt-studio.example";
    expect(getVerifiedSanityStudioBaseUrl()).toBe("https://alt-studio.example");
  });
});
