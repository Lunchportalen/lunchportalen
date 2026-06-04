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
    const summaryText = (await summary.innerText()).replace(/\s+/g, " ").trim();
    expect(summaryText.toLowerCase()).toContain("bestilt:");
    expect(summaryText).toMatch(/ost\s*&\s*skinke/i);

    const editBtn = page.locator(".ds-week-ordered-collapse__edit").first();
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAttribute("aria-expanded", "false");
    const editAccessibleName = await editBtn.getAttribute("aria-label");
    expect(editAccessibleName ?? "").toMatch(/endre bestilling/i);
    expect(editAccessibleName ?? "").toMatch(/ost\s*&\s*skinke/i);

    const pickerId = await editBtn.getAttribute("aria-controls");
    expect(pickerId).toBeTruthy();
    const picker = page.locator(`#${pickerId}`);
    await expect(picker).toBeHidden();

    const collapsedProbe = {
      summaryText,
      editPresent: true,
      ariaExpandedBefore: await editBtn.getAttribute("aria-expanded"),
      pickerHiddenBefore: await picker.isHidden(),
    };

    await editBtn.click();
    await expect(editBtn).toHaveAttribute("aria-expanded", "true");
    await expect(picker).toBeVisible();

    const slotProbe = await page.evaluate(() => {
      const slots = Array.from(
        document.querySelectorAll("button.week-category-card"),
      ) as HTMLButtonElement[];
      return {
        count: slots.length,
        slots: slots.map((s) => ({
          ariaDisabled: s.getAttribute("aria-disabled"),
          className: s.className,
        })),
        anyAriaDisabled: slots.some((s) => s.getAttribute("aria-disabled") === "true"),
        allEditable: slots.length > 0 && slots.every((s) => s.getAttribute("aria-disabled") !== "true"),
      };
    });

    const editablePayload = {
      ...collapsedProbe,
      ariaExpandedAfter: await editBtn.getAttribute("aria-expanded"),
      slotProbe,
    };

    // eslint-disable-next-line no-console
    console.log("WEEK_COLLAPSE_PROBE_EDITABLE", JSON.stringify(editablePayload));

    expect(slotProbe.count).toBeGreaterThan(0);
    expect(slotProbe.allEditable).toBe(true);
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
    const summaryText = (await summary.innerText()).replace(/\s+/g, " ").trim();
    expect(summaryText).toMatch(/ost\s*&\s*skinke/i);

    const endreCount = await page.locator(".ds-week-ordered-collapse__edit").count();
    expect(endreCount).toBe(0);
    await expect(page.getByRole("button", { name: /endre bestilling/i })).toHaveCount(0);

    const lockedNoteText = (
      await page.locator(".ds-week-ordered-collapse__locked-note").innerText()
    ).replace(/\s+/g, " ");
    expect(lockedNoteText).toMatch(/frist passert/i);

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
        pickerDisplay: picker ? getComputedStyle(picker).display : null,
        slotCount: slots.length,
        slotsAriaDisabled: slots.map((s) => s.getAttribute("aria-disabled")),
        allSlotsAriaDisabled:
          slots.length === 0 ||
          slots.every((s) => s.getAttribute("aria-disabled") === "true"),
      };
    });

    const lockedPayload = {
      summaryText,
      endreCount,
      lockedNoteText,
      calendarLockedMarkHeight: markBox?.height ?? 0,
      slotProbe,
    };

    // eslint-disable-next-line no-console
    console.log("WEEK_COLLAPSE_PROBE_LOCKED", JSON.stringify(lockedPayload));

    expect(slotProbe.pickerHidden).toBe(true);
    expect(slotProbe.allSlotsAriaDisabled).toBe(true);
  });
});
