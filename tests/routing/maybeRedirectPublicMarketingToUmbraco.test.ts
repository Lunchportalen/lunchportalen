import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { maybeRedirectPublicMarketingToUmbracoHostedSite } from "@/lib/routing/maybeRedirectPublicMarketingToUmbraco";

describe("maybeRedirectPublicMarketingToUmbracoHostedSite", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when UMBRACO_PUBLIC_SITE_URL is unset", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "");
    const req = new NextRequest(new URL("https://app.example.com/"));
    expect(maybeRedirectPublicMarketingToUmbracoHostedSite(req)).toBeNull();
  });

  it("returns null when target host equals request host (loop guard)", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "https://www.example.com");
    const req = new NextRequest(new URL("https://www.example.com/kontakt"));
    expect(maybeRedirectPublicMarketingToUmbracoHostedSite(req)).toBeNull();
  });

  it("redirects to Umbraco public origin when hosts differ and path is delegated", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "https://www.example.com");
    const req = new NextRequest(new URL("https://app.example.com/kontakt?x=1"));
    const res = maybeRedirectPublicMarketingToUmbracoHostedSite(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toBe("https://www.example.com/kontakt?x=1");
  });
});
