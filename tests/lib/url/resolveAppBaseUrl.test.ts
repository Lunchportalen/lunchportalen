import { describe, expect, it } from "vitest";

import {
  CANONICAL_PRODUCTION_APP_URL,
  LOCAL_DEV_APP_URL,
  pickExplicitAppUrl,
  resolveAppBaseUrl,
  resolvePasswordResetRedirectUrl,
} from "@/lib/url/resolveAppBaseUrl";

describe("resolveAppBaseUrl", () => {
  it("production VERCEL_ENV resolves to canonical app URL", () => {
    expect(
      resolveAppBaseUrl({
        vercelEnv: "production",
        nodeEnv: "production",
      }),
    ).toBe(CANONICAL_PRODUCTION_APP_URL);
  });

  it("production VERCEL_ENV ignores baked localhost NEXT_PUBLIC_APP_URL", () => {
    expect(
      resolveAppBaseUrl({
        vercelEnv: "production",
        nodeEnv: "production",
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).toBe(CANONICAL_PRODUCTION_APP_URL);
  });

  it("production reset redirect uses canonical production /reset-password", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        vercelEnv: "production",
        nodeEnv: "production",
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).toBe(`${CANONICAL_PRODUCTION_APP_URL}/reset-password`);
  });

  it("local dev without env resolves to localhost", () => {
    expect(
      resolveAppBaseUrl({
        nodeEnv: "development",
        vercelEnv: "",
      }),
    ).toBe(LOCAL_DEV_APP_URL);
  });

  it("missing production URL does not silently produce localhost on Vercel production", () => {
    const url = resolveAppBaseUrl({
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(url).not.toContain("localhost");
    expect(url).toBe(CANONICAL_PRODUCTION_APP_URL);
  });

  it("non-localhost explicit APP_URL wins on production when configured", () => {
    expect(
      resolveAppBaseUrl({
        vercelEnv: "production",
        nodeEnv: "production",
        appUrl: "https://staging.example.com",
      }),
    ).toBe("https://staging.example.com");
  });

  it("preview uses explicit env when set", () => {
    expect(
      resolveAppBaseUrl({
        vercelEnv: "preview",
        nodeEnv: "production",
        publicAppUrl: "https://preview.example.com",
      }),
    ).toBe("https://preview.example.com");
  });

  it("non-Vercel production with localhost explicit fails closed", () => {
    expect(() =>
      resolveAppBaseUrl({
        nodeEnv: "production",
        vercelEnv: "",
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).toThrow(/localhost/i);
  });

  it("pickExplicitAppUrl prefers APP_URL then PUBLIC then NEXT_PUBLIC", () => {
    expect(
      pickExplicitAppUrl({
        appUrl: "https://a.example",
        publicAppUrl: "https://b.example",
        nextPublicAppUrl: "https://c.example",
      }),
    ).toBe("https://a.example");
  });
});
