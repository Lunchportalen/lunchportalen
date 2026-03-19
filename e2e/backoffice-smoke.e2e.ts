// e2e/backoffice-smoke.e2e.ts — Backoffice top-nav module smoke (no crashes, no placeholders)
import { test, expect } from "@playwright/test";
import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
  type E2ERole,
} from "./helpers/auth";
import { waitForMainContent } from "./helpers/ready";

const hasSuperadminCreds = !!process.env.E2E_SUPERADMIN_EMAIL && !!process.env.E2E_SUPERADMIN_PASSWORD;

function requireRoleCreds(role: E2ERole) {
  const creds = getCredentialsForRole(role);
  if (!creds) {
    throw new Error(`Missing credentials for role ${role}. See docs/E2E.md for env setup.`);
  }
  return creds;
}

type ModuleRoute = {
  path: string;
  headingRegex: RegExp;
};

/** Top-nav modules (Content, Releases, Media, …). AI covered separately in same suite. */
const BACKOFFICE_MODULES: ModuleRoute[] = [
  { path: "/backoffice/content", headingRegex: /content/i },
  { path: "/backoffice/releases", headingRegex: /releases/i },
  { path: "/backoffice/media", headingRegex: /mediearkiv/i },
  { path: "/backoffice/templates", headingRegex: /maler/i },
  { path: "/backoffice/users", headingRegex: /brukere/i },
  { path: "/backoffice/members", headingRegex: /medlemmer/i },
  { path: "/backoffice/forms", headingRegex: /forms/i },
  { path: "/backoffice/translation", headingRegex: /oversettelser/i },
  { path: "/backoffice/settings", headingRegex: /systeminnstillinger/i },
  { path: "/backoffice/ai", headingRegex: /ai control/i },
];

const BANNED_PLACEHOLDER_PHRASES = [
  "kommer snart",
  "ikke implementert",
  "not implemented yet",
  "coming soon",
];

async function assertNoCrashText(page: import("@playwright/test").Page) {
  const html = await page.content();
  const crashPatterns = [/application error/i, /something went wrong/i, /unhandled runtime error/i];
  for (const pattern of crashPatterns) {
    expect(html).not.toMatch(pattern);
  }
}

function assertNoPlaceholderCopy(mainText: string) {
  const lower = mainText.toLowerCase();
  for (const phrase of BANNED_PLACEHOLDER_PHRASES) {
    expect(lower).not.toContain(phrase);
  }
}

test.describe("Backoffice module smoke (superadmin)", () => {
  test.skip(!hasSuperadminCreds, "Backoffice smoke requires E2E_SUPERADMIN_EMAIL/E2E_SUPERADMIN_PASSWORD");

  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const { email, password } = requireRoleCreds("superadmin");
    await loginViaForm(page, email, password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await waitForMainContent(page);
    await page.context().storageState({ path: "test-results/backoffice-superadmin-state.json" });
    await context.close();
  });

  for (const mod of BACKOFFICE_MODULES) {
    test(`module ${mod.path} loads without crash or blank shell`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: "test-results/backoffice-superadmin-state.json",
      });
      const page = await context.newPage();

      await page.goto(mod.path);
      await expect(page).toHaveURL(new RegExp(mod.path.replace(/\//g, "\\/")));
      await expect(page).not.toHaveURL(/\/login(\?|$)/);

      await waitForMainContent(page);

      await assertNoCrashText(page);

      const heading = page.getByRole("heading", { name: mod.headingRegex });
      await expect(heading).toBeVisible({ timeout: 15_000 });

      const main = page.getByRole("main");
      const mainText = (await main.textContent())?.trim() ?? "";
      expect(mainText.length).toBeGreaterThan(0);
      assertNoPlaceholderCopy(mainText);

      await context.close();
    });
  }

  test("top nav opens each module and shows real surface", async ({ page }) => {
    const creds = requireRoleCreds("superadmin");
    await loginViaForm(page, creds.email, creds.password, "/backoffice/content");
    await waitForPostLoginNavigation(page);
    await expect(page).toHaveURL(/\/backoffice\/content/);
    await waitForMainContent(page);

    const nav = page.getByRole("navigation", { name: /backoffice-moduler/i });
    await expect(nav).toBeVisible();

    const tabs = [
      "Content",
      "Releases",
      "Media",
      "Templates",
      "Users",
      "Members",
      "Forms",
      "Translation",
      "Settings",
    ];

    for (const label of tabs) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/backoffice/${label.toLowerCase().replace(/\s+/g, "")}`));
      await waitForMainContent(page);
      await assertNoCrashText(page);
      const main = page.getByRole("main");
      const mainText = (await main.textContent())?.trim() ?? "";
      expect(mainText.length).toBeGreaterThan(0);
      assertNoPlaceholderCopy(mainText);
    }
  });
});

