// e2e/week-visual-regression.e2e.ts — STEG 0: deterministic /week visual regression baselines
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowDaySelected,
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
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
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    const summary = page.locator(".ds-allergen-disclosure__summary");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(/Allergener: ingen oppgitt/i)).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-allergen-declared-empty-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });

  test("allergen has_data — collapsed", async ({ page }, testInfo) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "has_data",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    const summary = page.locator(".ds-allergen-disclosure__summary");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".ds-allergen-chip--readonly").first()).toBeVisible();

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

    await expect(page.locator(".ds-ordered-meal-line__prefix")).toBeVisible();
    await expect(page.getByRole("heading", { name: /kommende dager/i })).toBeVisible();

    await expect(weekMainLocator(page)).toHaveScreenshot(
      `week-ordered-upcoming-${testInfo.project.name}.png`,
      WEEK_VISUAL_SCREENSHOT_OPTS,
    );
  });
});
