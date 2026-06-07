/**
 * Geography-first /start gate — flow + render proof (1280 / 980 / 640).
 * Run: LP_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npx playwright test e2e/geography-start-flow.e2e.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-980", width: 980, height: 900 },
  { name: "mobile-640", width: 640, height: 900 },
] as const;

test.describe("Geography-first /start gate", () => {
  test("/demo without geo redirects to /start", async ({ page }) => {
    await page.goto("/demo?source=e2e-redirect");
    await expect(page).toHaveURL(/\/start\?.*intent=demo/);
    await expect(page.locator("h1")).toHaveText("Hvor er bedriften?");
  });

  test("covered flow → demo with location params", async ({ page }) => {
    await page.route("**/api/public/coverage/check", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          rid: "cov_test",
          data: { covered: true, hasServiceAreas: true, postal_code: "0150", city: "Oslo", mvpForward: false },
        }),
      });
    });

    await page.goto("/start?source=e2e-covered&intent=demo");
    await page.getByLabel(/^Postnummer/i).fill("0150");
    await page.getByLabel(/^Poststed/i).fill("Oslo");
    await page.getByRole("button", { name: /fortsett/i }).click();

    await expect(page).toHaveURL(/\/demo\?.*postal_code=0150.*city=Oslo/);
    await expect(page.locator("h1")).toHaveText("Book en demo");
  });

  test("uncovered flow → coverage wish capture", async ({ page }) => {
    await page.route("**/api/public/coverage/check", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          rid: "cov_test",
          data: { covered: false, hasServiceAreas: true, postal_code: "9999", city: "Testby", mvpForward: false },
        }),
      });
    });

    await page.goto("/start?source=e2e-uncovered&intent=demo");
    await page.getByLabel(/^Postnummer/i).fill("9999");
    await page.getByLabel(/^Poststed/i).fill("Testby");
    await page.getByRole("button", { name: /fortsett/i }).click();

    await expect(page.getByRole("heading", { name: /ikke dekning/i })).toBeVisible();

    await page.route("**/api/public/leads/capture", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, rid: "lead_test", data: { leadId: "550e8400-e29b-41d4-a716-446655440000" } }),
      });
    });

    await page.getByLabel(/^Navn/i).fill("E2E Dekning");
    await page.getByLabel(/^E-post/i).fill("e2e-dekning@staging.lunchportalen.test");
    await page.getByLabel(/^Bedrift/i).fill("Dekning AS");
    await page.getByRole("checkbox", { name: /samtykker/i }).check();

    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/public/leads/capture") && r.method() === "POST"),
      page.getByRole("button", { name: /meld interesse/i }).click(),
    ]);

    const body = req.postDataJSON() as {
      coverage_wish?: boolean;
      lead_type?: string;
      postal_code?: string;
      city?: string;
    };
    expect(body.coverage_wish).toBe(true);
    expect(body.lead_type).toBe("customer");
    expect(body.postal_code).toBe("9999");
    expect(body.city).toBe("Testby");

    await expect(page.getByRole("status")).toContainText("notert");
  });

  for (const vp of VIEWPORTS) {
    test(`render proof @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/start?source=render-proof&intent=demo");
      await expect(page.locator("h1")).toHaveText("Hvor er bedriften?");
      await expect(page.getByLabel(/^Postnummer/i)).toBeVisible();
      await page.screenshot({
        path: `_geography-review-surface/start-${vp.name}.png`,
        fullPage: true,
      });
    });
  }
});
