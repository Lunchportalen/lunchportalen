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

  it("request host app.lunchportalen.no forces production reset redirect without VERCEL_ENV", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        requestHost: "app.lunchportalen.no",
        nodeEnv: "development",
        vercelEnv: "",
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).toBe(`${CANONICAL_PRODUCTION_APP_URL}/reset-password`);
  });

  it("bad localhost env on deployed non-localhost host never returns localhost reset URL", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        requestHost: "app.lunchportalen.no",
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).not.toContain("localhost");
  });

  it("local dev localhost host may use localhost reset redirect", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        requestHost: "localhost:3000",
        nodeEnv: "development",
        vercelEnv: "",
      }),
    ).toBe(`${LOCAL_DEV_APP_URL}/reset-password`);
  });

  it("production never returns localhost reset redirect", () => {
    const cases = [
      { vercelEnv: "production", nodeEnv: "production", nextPublicAppUrl: "http://localhost:3000" },
      { requestHost: "app.lunchportalen.no", nextPublicAppUrl: "http://localhost:3000" },
      { requestHost: "app.lunchportalen.no", nodeEnv: "development", vercelEnv: "" },
      { nodeEnv: "production", vercelEnv: "", nextPublicAppUrl: "http://localhost:3000" },
      { nodeEnv: "production", vercelEnv: "", requestHost: null, nextPublicAppUrl: "http://localhost:3000" },
    ] as const;
    for (const input of cases) {
      expect(resolvePasswordResetRedirectUrl(input)).not.toContain("localhost");
    }
  });

  it("remote_backend missing host with NODE_ENV production uses canonical reset URL", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        nodeEnv: "production",
        vercelEnv: "",
        requestHost: null,
        nextPublicAppUrl: "http://localhost:3000",
      }),
    ).toBe(`${CANONICAL_PRODUCTION_APP_URL}/reset-password`);
  });

  it("preview staging explicit APP_URL wins for reset redirect", () => {
    expect(
      resolvePasswordResetRedirectUrl({
        vercelEnv: "preview",
        nodeEnv: "production",
        publicAppUrl: "https://staging.example.com",
      }),
    ).toBe("https://staging.example.com/reset-password");
  });
});
