// e2e/staging-global-setup.ts — prime Vercel deployment protection cookie before staging E2E.
import { request } from "@playwright/test";

import { isStagingRuntimeBaseUrl, primeStagingBypass } from "./helpers/staging-edge-bypass";

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  if (!isStagingRuntimeBaseUrl(baseURL)) return;

  const ctx = await request.newContext();
  try {
    await primeStagingBypass(ctx, baseURL);
  } finally {
    await ctx.dispose();
  }
}
