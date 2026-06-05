// e2e/week-visual-regression.e2e.ts — STEG 0: deterministic /week visual regression baselines
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowAllergenCollapsed,
  buildWeekVisualWindowDaySelected,
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  installWeekVisualOsloClock,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
  WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE,
  WEEK_VISUAL_SCREENSHOT_OPTS,
  weekMainLocator,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

test.describe("Week visual regression @week-visual", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("allergen declared_empty — collapsed", async ({ page }, testInfo) => {
    await installWeekVisualOsloClock(page, WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE);
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowAllergenCollapsed(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await expect(page.getByRole("heading", { name: /tor 04\.06\.2026/i })).toBeVisible();

    const summary = page.locator(".ds-allergen-disclosure__summary");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(/Allergener: ingen oppgitt/i)).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-allergen-declared-empty-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });

  test("allergen has_data — collapsed", async ({ page }, testInfo) => {
    await installWeekVisualOsloClock(page, WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE);
    await installWeekVisualMocks(page, {
      allergenProfile: "has_data",
      windowBody: buildWeekVisualWindowAllergenCollapsed(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await expect(page.getByRole("heading", { name: /tor 04\.06\.2026/i })).toBeVisible();

    const summary = page.locator(".ds-allergen-disclosure__summary");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".ds-week-surface--chip").first()).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-allergen-has-data-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });

  test("day selected — Tir 02", async ({ page }, testInfo) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");
    await expect(page.getByRole("heading", { name: /tir 02\.06\.2026/i })).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-day-selected-tue-02-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });

  test("selected day ordered + upcoming days list", async ({ page }, testInfo) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    await expect(page.locator(".ds-week-ordered-collapse__summary")).toContainText(/ost\s*&\s*skinke/i);
    await expect(page.locator(".ds-week-ordered-collapse__edit")).toBeVisible();
    await expect(page.getByRole("heading", { name: /kommende dager/i })).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-ordered-upcoming-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });
});
