// STEG 7.1 — V.W6 computed style + presence gate for /week lifecycle states
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowDaySelected,
  buildWeekVisualWindowOrderedUpcoming,
  withWeekVisualServerOsloDate,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

type VisibleAffordanceProbe = {
  display: string;
  visibility: string;
  height: number;
  width: number;
};

/** Perceivable layout gate — visible affordance node only (never sr-only). */
function assertPerceivableAffordance(
  probe: VisibleAffordanceProbe | null,
  label: string,
): asserts probe is VisibleAffordanceProbe {
  expect(probe, `${label}: affordance node missing`).not.toBeNull();
  expect(probe!.display, `${label}: display:none`).not.toBe("none");
  expect(probe!.visibility, `${label}: visibility:hidden`).not.toBe("hidden");
  expect(probe!.height, `${label}: zero rendered height`).toBeGreaterThan(0);
}

test.describe("Week state probe (V.W6)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("calendar locked, unavailable, ordered markers + computed styles", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    const result = await page.evaluate(() => {
      const readVisibleMark = (pill: Element, selector: string): VisibleAffordanceProbe | null => {
        const mark = pill.querySelector(selector);
        if (!mark) return null;
        const cs = getComputedStyle(mark);
        const rect = mark.getBoundingClientRect();
        return {
          display: cs.display,
          visibility: cs.visibility,
          height: rect.height,
          width: rect.width,
        };
      };

      const readPill = (iso: string) => {
        const el = document.querySelector(`button[data-lp-date="${iso}"]`);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          lifecycle: el.getAttribute("data-lp-lifecycle") ?? "",
          opacity: cs.opacity,
          cursor: cs.cursor,
          hasOrderedMark: !!el.querySelector(".ds-week-calendar-day-pill__state-mark--ordered"),
          hasLockedMark: !!el.querySelector(".ds-week-calendar-day-pill__state-mark--locked"),
          hasUnavailableMark: !!el.querySelector(".ds-week-calendar-day-pill__state-mark--unavailable"),
          ariaDisabled: el.getAttribute("aria-disabled"),
          lockedMark: readVisibleMark(el, ".ds-week-calendar-day-pill__state-mark--locked"),
          orderedMark: readVisibleMark(el, ".ds-week-calendar-day-pill__state-mark--ordered"),
          unavailableMark: readVisibleMark(el, ".ds-week-calendar-day-pill__state-mark--unavailable"),
        };
      };

      return {
        mon: readPill("2026-06-01"),
        tue: readPill("2026-06-02"),
        wed: readPill("2026-06-03"),
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_STATE_PROBE", JSON.stringify(result));

    expect(result.mon).not.toBeNull();
    expect(result.mon!.lifecycle).toBe("locked");
    expect(Number(result.mon!.opacity)).toBeCloseTo(0.5, 1);
    expect(result.mon!.cursor).toBe("not-allowed");
    expect(result.mon!.hasLockedMark).toBe(true);
    assertPerceivableAffordance(result.mon!.lockedMark, "calendar Mon locked clock mark");

    expect(result.tue).not.toBeNull();
    expect(result.tue!.lifecycle).toBe("ordered");
    expect(result.tue!.hasOrderedMark).toBe(true);
    assertPerceivableAffordance(result.tue!.orderedMark, "calendar Tue ordered check mark");

    expect(result.wed).not.toBeNull();
    expect(result.wed!.lifecycle).toBe("unavailable");
    expect(result.wed!.hasUnavailableMark).toBe(true);
    assertPerceivableAffordance(result.wed!.unavailableMark, "calendar Wed unavailable em-dash mark");
  });

  test("locked and unavailable category slots", async ({ page }) => {
    test.setTimeout(90_000);
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    const monPill = page.locator('button[data-lp-date="2026-06-01"]');
    for (let attempt = 0; attempt < 5; attempt++) {
      await monPill.click();
      if ((await page.locator("button.week-category-card.is-locked").count()) > 0) break;
      await page.waitForTimeout(400);
    }
    const lockedSlotLocator = page.locator("button.week-category-card.is-locked").first();
    await expect(lockedSlotLocator).toBeVisible({ timeout: 15_000 });
    const lockedDaySlots = await lockedSlotLocator.evaluate((slot) => {
      const cs = getComputedStyle(slot);
      const label = slot.querySelector(".week-category-card__state-label");
      let stateLabel: VisibleAffordanceProbe | null = null;
      if (label) {
        const lcs = getComputedStyle(label);
        const rect = label.getBoundingClientRect();
        stateLabel = {
          display: lcs.display,
          visibility: lcs.visibility,
          height: rect.height,
          width: rect.width,
        };
      }
      return {
        opacity: cs.opacity,
        cursor: cs.cursor,
        ariaDisabled: slot.getAttribute("aria-disabled"),
        hasStateLabel: !!label,
        stateLabel,
        labelText: label?.textContent?.trim() ?? "",
      };
    });
    expect(Number(lockedDaySlots.opacity)).toBeCloseTo(0.5, 1);
    expect(lockedDaySlots.cursor).toBe("not-allowed");
    expect(lockedDaySlots.ariaDisabled).toBe("true");
    expect(lockedDaySlots.labelText).toMatch(/frist passert/i);
    assertPerceivableAffordance(lockedDaySlots.stateLabel, "locked slot state label");

    // eslint-disable-next-line no-console
    console.log("WEEK_STATE_PROBE_LOCKED_SLOTS", JSON.stringify(lockedDaySlots));

    const thuPill = page.locator('button[data-lp-date="2026-06-04"]');
    for (let attempt = 0; attempt < 5; attempt++) {
      await thuPill.click();
      if ((await page.locator("button.week-category-card.is-unavailable").count()) > 0) break;
      await page.waitForTimeout(400);
    }
    const unavailableSlotLocator = page.locator("button.week-category-card.is-unavailable").first();
    await expect(unavailableSlotLocator).toBeVisible({ timeout: 15_000 });
    const unavailableSlot = await unavailableSlotLocator.evaluate((slot) => {
      const cs = getComputedStyle(slot);
      const label = slot.querySelector(".week-category-card__state-label");
      let stateLabel: VisibleAffordanceProbe | null = null;
      if (label) {
        const lcs = getComputedStyle(label);
        const rect = label.getBoundingClientRect();
        stateLabel = {
          display: lcs.display,
          visibility: lcs.visibility,
          height: rect.height,
          width: rect.width,
        };
      }
      return {
        opacity: cs.opacity,
        cursor: cs.cursor,
        hasStateLabel: !!label,
        labelText: label?.textContent?.trim() ?? "",
        stateLabel,
      };
    });
    expect(Number(unavailableSlot.opacity)).toBeGreaterThan(0.85);
    expect(unavailableSlot.cursor).toBe("not-allowed");
    expect(unavailableSlot.labelText).toMatch(/ikke tilgjengelig/i);
    assertPerceivableAffordance(unavailableSlot.stateLabel, "unavailable slot state label");

    // eslint-disable-next-line no-console
    console.log("WEEK_STATE_PROBE_UNAVAILABLE_SLOT", JSON.stringify(unavailableSlot));
  });

  test("unavailable day panel (NO_TIER_FOR_DAY)", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-03");
    await expect(
      page.getByText(/Denne dagen er ikke tilgjengelig for bestilling/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    const wedPanel = await page.evaluate(() => {
      const pill = document.querySelector('button[data-lp-date="2026-06-03"]');
      const mark = pill?.querySelector(".ds-week-calendar-day-pill__state-mark--unavailable");
      let unavailableMark: VisibleAffordanceProbe | null = null;
      if (mark) {
        const cs = getComputedStyle(mark);
        const rect = mark.getBoundingClientRect();
        unavailableMark = {
          display: cs.display,
          visibility: cs.visibility,
          height: rect.height,
          width: rect.width,
        };
      }
      return {
        lifecycle: pill?.getAttribute("data-lp-lifecycle") ?? "",
        hasUnavailableMark: !!mark,
        unavailableMark,
        hasNotice: !!document.querySelector(".ds-week-surface--inset"),
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_STATE_PROBE_UNAVAILABLE_DAY", JSON.stringify(wedPanel));

    expect(wedPanel.lifecycle).toBe("unavailable");
    expect(wedPanel.hasUnavailableMark).toBe(true);
    expect(wedPanel.hasNotice).toBe(true);
    assertPerceivableAffordance(wedPanel.unavailableMark, "calendar Wed unavailable em-dash mark (panel view)");
  });
});
