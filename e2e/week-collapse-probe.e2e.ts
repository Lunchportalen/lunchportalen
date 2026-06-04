// STEG 7.2 — V.W7 ordered-day collapse interaction gate
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowOrderedLockedCutoff,
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

test.describe("Week collapse probe (V.W7)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("ordered before cutoff — collapsed summary + Endre disclosure", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    const summary = page.locator(".ds-week-ordered-collapse__summary").first();
    await expect(summary).toBeVisible({ timeout: 10_000 });
    await expect(summary).toContainText(/bestilt:/i);
    await expect(summary).toContainText(/ost\s*&\s*skinke/i);

    const editBtn = page.getByRole("button", { name: /endre bestilling/i });
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAttribute("aria-expanded", "false");

    const pickerId = await editBtn.getAttribute("aria-controls");
    expect(pickerId).toBeTruthy();
    const picker = page.locator(`#${pickerId}`);
    await expect(picker).toBeHidden();

    await editBtn.click();
    await expect(editBtn).toHaveAttribute("aria-expanded", "true");
    await expect(picker).toBeVisible();

    const slotProbe = await page.evaluate(() => {
      const slots = Array.from(
        document.querySelectorAll("button.week-category-card"),
      ) as HTMLButtonElement[];
      return {
        count: slots.length,
        anyAriaDisabled: slots.some((s) => s.getAttribute("aria-disabled") === "true"),
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_COLLAPSE_PROBE_EDITABLE", JSON.stringify(slotProbe));

    expect(slotProbe.count).toBeGreaterThan(0);
    expect(slotProbe.anyAriaDisabled).toBe(false);
  });

  test("ordered after cutoff — locked read-only collapse", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedLockedCutoff(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    const summary = page.locator(".ds-week-ordered-collapse__summary").first();
    await expect(summary).toBeVisible({ timeout: 10_000 });
    await expect(summary).toContainText(/ost\s*&\s*skinke/i);

    await expect(page.getByRole("button", { name: /endre bestilling/i })).toHaveCount(0);
    await expect(page.locator(".ds-week-ordered-collapse__locked-note")).toContainText(
      /frist passert/i,
    );

    const monPill = page.locator('button[data-lp-date="2026-06-01"]');
    await expect(monPill).toHaveAttribute("data-lp-lifecycle", "locked");

    const lockedMark = monPill.locator(".ds-week-calendar-day-pill__state-mark--locked");
    await expect(lockedMark).toBeVisible();
    const markBox = await lockedMark.boundingBox();
    expect(markBox?.height ?? 0).toBeGreaterThan(0);

    const slotProbe = await page.evaluate(() => {
      const picker = document.querySelector(".week-ordered-picker-region");
      const slots = Array.from(
        document.querySelectorAll("button.week-category-card"),
      ) as HTMLButtonElement[];
      return {
        pickerHidden: picker?.hasAttribute("hidden") ?? picker == null,
        slotCount: slots.length,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_COLLAPSE_PROBE_LOCKED", JSON.stringify(slotProbe));

    expect(slotProbe.pickerHidden).toBe(true);
    expect(slotProbe.slotCount).toBe(0);
  });
});
