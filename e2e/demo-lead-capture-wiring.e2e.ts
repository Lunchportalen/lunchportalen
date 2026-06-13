/**
 * GO #C wiring-gap — browser form → capture route (localhost + staging Supabase).
 * Run: LP_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npx playwright test e2e/demo-lead-capture-wiring.e2e.ts --project=chromium
 */
import fs from "node:fs";
import { test, expect } from "@playwright/test";

const STAGING_REF = "uigxsboqeruxflgzqztl";
export const goCPlaywrightLeadEmails: string[] = [];

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

test.describe("GO #C demo lead capture wiring", () => {
  test("form submit → inline takk + source=playwright-e2e in POST body", async ({ page }) => {
    const email = `pw-e2e-${Date.now()}@staging.lunchportalen.test`;
    await page.goto("/demo?source=playwright-e2e&postal_code=0150&city=Oslo");

    await expect(page.locator("h1")).toHaveText("Book en demo");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle(/Book demo/i);

    await page.getByLabel(/^Navn/i).fill("Playwright E2E");
    await page.getByLabel(/^E-post/i).fill(email);
    await page.getByLabel(/^Bedrift/i).fill("Playwright AS");
    await page.getByRole("checkbox", { name: /samtykker/i }).check();

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/public/leads/capture") && r.method() === "POST",
      ),
      page.getByRole("button", { name: /book demo/i }).click(),
    ]);

    const body = req.postDataJSON() as { source?: string; consented?: boolean };
    expect(body.source).toBe("playwright-e2e");
    expect(body.consented).toBe(true);

    await expect(page.getByRole("status")).toContainText("Takk");
    goCPlaywrightLeadEmails.push(email);
  });

  test("?src= alias resolves to source in POST body", async ({ page }) => {
    await page.goto("/demo?src=src-alias-e2e&postal_code=0150&city=Oslo");
    await page.getByLabel(/^Navn/i).fill("Src Alias");
    await page.getByLabel(/^E-post/i).fill(`src-${Date.now()}@staging.lunchportalen.test`);
    await page.getByLabel(/^Bedrift/i).fill("Alias AS");
    await page.getByRole("checkbox", { name: /samtykker/i }).check();

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/public/leads/capture") && r.method() === "POST",
      ),
      page.getByRole("button", { name: /book demo/i }).click(),
    ]);
    expect((req.postDataJSON() as { source?: string }).source).toBe("src-alias-e2e");
  });

  test("default source=demo-direct when params missing", async ({ page }) => {
    await page.goto("/demo?postal_code=0150&city=Oslo");
    await page.getByLabel(/^Navn/i).fill("Default Source");
    await page.getByLabel(/^E-post/i).fill(`default-${Date.now()}@staging.lunchportalen.test`);
    await page.getByLabel(/^Bedrift/i).fill("Default AS");
    await page.getByRole("checkbox", { name: /samtykker/i }).check();

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes("/api/public/leads/capture") && r.method() === "POST",
      ),
      page.getByRole("button", { name: /book demo/i }).click(),
    ]);
    expect((req.postDataJSON() as { source?: string }).source).toBe("demo-direct");
  });
});

test.beforeAll(() => {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing E2E: Supabase URL must be staging ${STAGING_REF}`);
  }
});
