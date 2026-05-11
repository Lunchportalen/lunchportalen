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

  it("does not redirect from app subdomains", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "https://www.lunchportalen.no");
    const req = new NextRequest(new URL("https://app.lunchportalen.no/?x=1"));
    expect(maybeRedirectPublicMarketingToUmbracoHostedSite(req)).toBeNull();
  });

  it("redirects normal browser requests on non-app public host when path is delegated", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "https://www.lunchportalen.no");
    const req = new NextRequest(new URL("https://lunchportalen.no/?x=1"));
    const res = maybeRedirectPublicMarketingToUmbracoHostedSite(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(307);
    expect(res!.headers.get("location")).toBe("https://www.lunchportalen.no/?x=1");
  });

  it("does not redirect Next RSC requests to Umbraco", () => {
    vi.stubEnv("UMBRACO_PUBLIC_SITE_URL", "https://www.example.com");

    expect(
      maybeRedirectPublicMarketingToUmbracoHostedSite(
        new NextRequest(new URL("https://app.example.com/?_rsc=abc"))
      )
    ).toBeNull();

    expect(
      maybeRedirectPublicMarketingToUmbracoHostedSite(
        new NextRequest(new URL("https://app.example.com/?rsc=abc"))
      )
    ).toBeNull();

    expect(
      maybeRedirectPublicMarketingToUmbracoHostedSite(
        new NextRequest(new URL("https://app.example.com/"), {
          headers: { rsc: "1" },
        })
      )
    ).toBeNull();

    expect(
      maybeRedirectPublicMarketingToUmbracoHostedSite(
        new NextRequest(new URL("https://lunchportalen.no/"), {
          headers: { "next-router-state-tree": "%5B%5D" },
        })
      )
    ).toBeNull();

    expect(
      maybeRedirectPublicMarketingToUmbracoHostedSite(
        new NextRequest(new URL("https://lunchportalen.no/"), {
          headers: { "next-router-prefetch": "2" },
        })
      )
    ).toBeNull();
  });
});
