// e2e/helpers/ready.ts — Wait for page readiness and shell assertions (Phase 2). No arbitrary sleeps.
import { Page } from "@playwright/test";

/**
 * Wait for the document to be in a stable loaded state.
 * Prefer waiting for a specific visible element in each test when possible.
 */
export async function waitForDocumentReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => {
    // networkidle can time out on long-polling; domcontentloaded is enough for shell render
  });
}

/**
 * Wait until the main content area is visible (reduces flakiness from hydration).
 */
export async function waitForMainContent(page: Page, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  await page.getByRole("main").waitFor({ state: "visible", timeout });
}

/**
 * Assert that the current page is a protected shell: main is visible and we are not on the login page.
 * Use after login or when navigating to a role home; fails if redirect to login occurred.
 */
export async function assertProtectedShellReady(
  page: Page,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  const pathname = new URL(page.url()).pathname;
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    throw new Error(`Expected protected shell but still on login: ${page.url()}`);
  }
  await waitForMainContent(page, { timeout });
}

/**
 * Assert login page is ready: heading and form visible. Use after redirect to /login.
 */
export async function assertLoginPageReady(page: Page, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 10_000;
  await page.getByRole("heading", { name: /logg inn/i }).waitFor({ state: "visible", timeout });
  await page.getByRole("button", { name: /logg inn/i }).waitFor({ state: "visible", timeout });
}

/**
 * Wait for fonts to be loaded so visual snapshots are stable (Phase 4).
 */
export async function waitForFontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Default pixel tolerance for scroll-width vs viewport (subpixel/rounding). */
const MOBILE_OVERFLOW_TOLERANCE = 2;

/**
 * Assert no horizontal overflow: document.documentElement.scrollWidth <= viewport width + tolerance.
 * Use on mobile viewport for Phase 5 invariants (AGENTS.md S1).
 */
export async function assertNoHorizontalOverflow(
  page: Page,
  tolerance: number = MOBILE_OVERFLOW_TOLERANCE
): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (scrollWidth > innerWidth + tolerance) {
    throw new Error(
      `Horizontal overflow: scrollWidth=${scrollWidth} > innerWidth + tolerance (${innerWidth + tolerance})`
    );
  }
}

/**
 * Assert the element is visible and its bounding box is within viewport (no catastrophic layout break).
 */
export async function assertInViewport(page: Page, selector: string | import("@playwright/test").Locator): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size");
  const inViewport =
    box.x + box.width >= 0 &&
    box.x <= viewport.width &&
    box.y + box.height >= 0 &&
    box.y <= viewport.height;
  if (!inViewport) {
    throw new Error(
      `Element outside viewport: box=(${box.x},${box.y},${box.width}x${box.height}) viewport=${viewport.width}x${viewport.height}`
    );
  }
}
