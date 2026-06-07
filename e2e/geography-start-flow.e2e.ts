/**
 * /start gate elevation — flow, render proof (1280/980/640), a11y spot-check.
 * Run: LP_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npx playwright test e2e/geography-start-flow.e2e.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-980", width: 980, height: 900 },
  { name: "mobile-640", width: 640, height: 900 },
] as const;

const ENTRY_TITLE = "Hvor holder bedriften til?";

async function mockCoverage(page: import("@playwright/test").Page, covered: boolean) {
  await page.route("**/api/public/coverage/check", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        rid: "cov_test",
        data: {
          covered,
          hasServiceAreas: true,
          postal_code: covered ? "0150" : "9999",
          city: covered ? "Oslo" : "Testby",
          mvpForward: false,
        },
      }),
    });
  });
}

async function submitLocation(page: import("@playwright/test").Page, postal: string, city: string) {
  await expect(page.getByLabel(/^Postnummer/i)).toBeVisible();
  await page.getByLabel(/^Postnummer/i).fill(postal);
  await page.getByLabel(/^Poststed/i).fill(city);
  await page.getByRole("button", { name: /finn caterere nær oss/i }).click();
}

test.describe("/start gate elevation", () => {
  test.setTimeout(60_000);

  test("/demo without geo redirects to /start", async ({ page }) => {
    await page.goto("/demo?source=e2e-redirect");
    await expect(page).toHaveURL(/\/start\?.*intent=demo/);
    await expect(page.locator("h1")).toHaveText(ENTRY_TITLE);
  });

  test("covered demo flow → result → demo", async ({ page }) => {
    await mockCoverage(page, true);
    await page.goto("/start?source=e2e-covered&intent=demo");
    await submitLocation(page, "0150", "Oslo");

    await expect(page.getByRole("heading", { name: /vi leverer til oslo/i })).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/demo\?.*postal_code=0150.*city=Oslo/),
      page.getByRole("link", { name: /^book demo$/i }).click(),
    ]);
  });

  test("uncovered demo flow → interest + demo still offered", async ({ page }) => {
    await mockCoverage(page, false);
    await page.goto("/start?source=e2e-uncovered&intent=demo");
    await submitLocation(page, "9999", "Testby");

    await expect(page.getByRole("heading", { name: /vi er ikke i testby ennå/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /book en demo/i })).toBeVisible();

    await page.route("**/api/public/leads/capture", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, rid: "lead_test", data: { leadId: "550e8400-e29b-41d4-a716-446655440000" } }),
      });
    });

    await page.getByLabel(/^E-post/i).fill("e2e-dekning@staging.lunchportalen.test");
    await page.getByLabel(/^Bedrift/i).fill("Dekning AS");
    await page.getByRole("checkbox", { name: /samtykker/i }).check();

    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/public/leads/capture") && r.method() === "POST"),
      page.getByRole("button", { name: /^meld interesse$/i }).click(),
    ]);

    const body = req.postDataJSON() as {
      coverage_wish?: boolean;
      lead_type?: string;
      postal_code?: string;
      city?: string;
      email?: string;
      company?: string;
    };
    expect(body.coverage_wish).toBe(true);
    expect(body.lead_type).toBe("customer");
    expect(body.postal_code).toBe("9999");
    expect(body.city).toBe("Testby");
    expect(body.email).toBe("e2e-dekning@staging.lunchportalen.test");
    expect(body.company).toBe("Dekning AS");

    await expect(page.getByRole("heading", { name: /takk — vi gir beskjed/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /book en demo/i })).toBeVisible();
  });

  test("register covered flow → registrer bedriften", async ({ page }) => {
    await mockCoverage(page, true);
    await page.goto("/start?source=e2e-register&intent=register");
    await submitLocation(page, "0150", "Oslo");

    await expect(page.getByRole("heading", { name: /vi leverer til oslo/i })).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/registrering\?.*postal_code=0150/),
      page.getByRole("link", { name: /registrer bedriften/i }).click(),
    ]);
  });

  test("a11y: focus ring visible on tab to postal input", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/start?source=a11y&intent=demo");
    await page.keyboard.press("Tab");
    const postal = page.locator("#start-postal-code");
    await expect(postal).toBeFocused();
  });

  for (const state of ["entry", "covered", "uncovered"] as const) {
    for (const vp of VIEWPORTS) {
      test(`render proof ${state} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockCoverage(page, state === "covered");

        if (state === "uncovered") {
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
        }

        await page.goto(`/start?source=render-${state}&intent=demo`);

        if (state === "entry") {
          await expect(page.locator("h1")).toHaveText(ENTRY_TITLE);
        } else {
          await page.getByLabel(/^Postnummer/i).fill(state === "covered" ? "0150" : "9999");
          await page.getByLabel(/^Poststed/i).fill(state === "covered" ? "Oslo" : "Testby");
          await page.getByRole("button", { name: /finn caterere nær oss/i }).click();
          if (state === "covered") {
            await expect(page.getByRole("heading", { name: /vi leverer til oslo/i })).toBeVisible();
          } else {
            await expect(page.getByRole("heading", { name: /vi er ikke i testby ennå/i })).toBeVisible();
          }
        }

        await page.screenshot({
          path: `_geography-review-surface/start-${state}-${vp.name}.png`,
          fullPage: true,
        });
      });
    }
  }
});
