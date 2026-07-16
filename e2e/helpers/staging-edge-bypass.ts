// e2e/helpers/staging-edge-bypass.ts — Vercel deployment protection for staging Playwright runs.
import type { APIRequestContext, BrowserContextOptions } from "@playwright/test";

const STAGING_HOSTS = new Set([
  "staging.app.lunchportalen.no",
  "lunchportalen-env-staging-lunchportalen.vercel.app",
]);

const PRODUCTION_HOSTS = new Set(["app.lunchportalen.no", "lunchportalen.no", "www.lunchportalen.no"]);

export function isStagingRuntimeBaseUrl(baseURL: string): boolean {
  try {
    const host = new URL(baseURL).hostname.toLowerCase();
    if (PRODUCTION_HOSTS.has(host)) return false;
    return STAGING_HOSTS.has(host) || host.endsWith("-lunchportalen.vercel.app");
  } catch {
    return false;
  }
}

export function getStagingBypassSecret(): string {
  return String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_PROTECTION_BYPASS ?? "",
  ).trim();
}

export function stagingBypassHeaders(baseURL?: string): Record<string, string> | undefined {
  const target = baseURL ?? process.env.PLAYWRIGHT_BASE_URL ?? "";
  const secret = getStagingBypassSecret();
  if (!secret || !isStagingRuntimeBaseUrl(target)) {
    return undefined;
  }
  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

export async function primeStagingBypass(request: APIRequestContext, baseURL: string): Promise<void> {
  if (!isStagingRuntimeBaseUrl(baseURL)) return;
  const secret = getStagingBypassSecret();
  if (!secret) {
    throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET required for staging Playwright runs");
  }
  const url = `${baseURL.replace(/\/$/, "")}/api/health?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(secret)}`;
  const res = await request.get(url, {
    headers: {
      "x-vercel-protection-bypass": secret,
      "x-vercel-set-bypass-cookie": "true",
      accept: "application/json",
    },
    maxRedirects: 5,
  });
  if (!res.ok()) {
    throw new Error(`staging bypass warmup failed: ${res.status()} ${(await res.text()).slice(0, 120)}`);
  }
}

export function stagingContextOptions(baseURL: string): Pick<BrowserContextOptions, "extraHTTPHeaders"> {
  if (!isStagingRuntimeBaseUrl(baseURL)) return {};
  const headers = stagingBypassHeaders();
  return headers ? { extraHTTPHeaders: headers } : {};
}
