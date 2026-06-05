// STEG 8 — authoritative Docker element clips for eyes-on (GO #114)
import { access } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { test, expect, type Locator } from "@playwright/test";

import {
  buildWeekVisualWindowOrderedLockedCutoff,
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");
const reviewOut = process.env.LP_REVIEW_SURFACE_OUT?.trim();

const CROP_FILES = {
  orderedCheck: "ordered-calendar-check-actual-crop.png",
  lockedPill: "locked-pill-clock-actual-crop.png",
  unavailableMinus: "unavailable-cell-minus-actual-crop.png",
  lockedCollapse: "locked-collapse-clock-actual-crop.png",
} as const;

async function clipLocator(locator: Locator, fileName: string, outDir: string): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 10_000 });
  const box = await locator.boundingBox();
  expect(box?.width ?? 0, `${fileName}: width`).toBeGreaterThan(0);
  expect(box?.height ?? 0, `${fileName}: height`).toBeGreaterThan(0);
  const outPath = resolve(outDir, fileName);
  await locator.screenshot({ path: outPath });
  await access(outPath);
}

test.describe("Week icon eyes-on clips @week-icon-eyes-on", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");
  test.skip(!reviewOut, "LP_REVIEW_SURFACE_OUT required (CI Docker capture)");

  test("calendar markers + locked collapse (element screenshots)", async ({ page }) => {
    test.setTimeout(90_000);
    const outDir = join(process.cwd(), reviewOut!);
    await mkdir(outDir, { recursive: true });

    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    await clipLocator(
      page.locator(
        'button[data-lp-date="2026-06-02"] .ds-week-calendar-day-pill__state-mark--ordered .ds-week-icon',
      ),
      CROP_FILES.orderedCheck,
      outDir,
    );
    await clipLocator(
      page.locator(
        'button[data-lp-date="2026-06-01"] .ds-week-calendar-day-pill__state-mark--locked .ds-week-icon',
      ),
      CROP_FILES.lockedPill,
      outDir,
    );
    await clipLocator(
      page.locator(
        'button[data-lp-date="2026-06-03"] .ds-week-calendar-day-pill__state-mark--unavailable .ds-week-icon',
      ),
      CROP_FILES.unavailableMinus,
      outDir,
    );

    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedLockedCutoff(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    await clipLocator(
      page.locator(".ds-week-ordered-collapse__locked-note").first(),
      CROP_FILES.lockedCollapse,
      outDir,
    );

    for (const file of Object.values(CROP_FILES)) {
      await access(resolve(outDir, file));
    }
  });
});
