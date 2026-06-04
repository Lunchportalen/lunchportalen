// STEG 7.1 — V.W6 computed style + presence gate for /week lifecycle states
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowDaySelected,
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

type LifecycleProbe = {
  lifecycle: string;
  opacity: string;
  cursor: string;
  hasOrderedMark: boolean;
  hasLockedMark: boolean;
  hasUnavailableMark: boolean;
  ariaDisabled: string | null;
};

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
      const readPill = (iso: string): LifecycleProbe | null => {
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
    expect(result.mon!.hasOrderedMark).toBe(false);
    expect(result.mon!.hasUnavailableMark).toBe(false);

    expect(result.tue).not.toBeNull();
    expect(result.tue!.lifecycle).toBe("ordered");
    expect(result.tue!.hasOrderedMark).toBe(true);
    expect(result.tue!.hasLockedMark).toBe(false);

    expect(result.wed).not.toBeNull();
    expect(result.wed!.lifecycle).toBe("unavailable");
    expect(result.wed!.hasUnavailableMark).toBe(true);
    expect(result.wed!.hasLockedMark).toBe(false);
    expect(result.wed!.hasOrderedMark).toBe(false);

    // Locked/unavailable slots: pick a day with categories and unavailable category if present
    await selectWeekDay(page, "2026-06-01");
    const lockedDaySlots = await page.evaluate(() => {
      const slot = document.querySelector("button.ds-week-surface--slot.is-locked") as HTMLButtonElement | null;
      if (!slot) return null;
      const cs = getComputedStyle(slot);
      return {
        opacity: cs.opacity,
        cursor: cs.cursor,
        ariaDisabled: slot.getAttribute("aria-disabled"),
        hasStateLabel: !!slot.querySelector(".week-category-card__state-label"),
      };
    });
    expect(lockedDaySlots).not.toBeNull();
    expect(Number(lockedDaySlots!.opacity)).toBeCloseTo(0.5, 1);
    expect(lockedDaySlots!.cursor).toBe("not-allowed");
    expect(lockedDaySlots!.ariaDisabled).toBe("true");
    expect(lockedDaySlots!.hasStateLabel).toBe(true);

    await selectWeekDay(page, "2026-06-04");
    const unavailableSlot = await page.evaluate(() => {
      const slot = document.querySelector(
        "button.ds-week-surface--slot.is-unavailable",
      ) as HTMLButtonElement | null;
      if (!slot) return null;
      const cs = getComputedStyle(slot);
      return {
        opacity: cs.opacity,
        cursor: cs.cursor,
        hasStateLabel: !!slot.querySelector(".week-category-card__state-label"),
        labelText: slot.querySelector(".week-category-card__state-label")?.textContent?.trim() ?? "",
      };
    });
    expect(unavailableSlot).not.toBeNull();
    expect(Number(unavailableSlot!.opacity)).toBeGreaterThan(0.85);
    expect(unavailableSlot!.cursor).toBe("not-allowed");
    expect(unavailableSlot!.hasStateLabel).toBe(true);
    expect(unavailableSlot!.labelText).toMatch(/ikke tilgjengelig/i);
  });

  test("unavailable day panel + distinct slot when category unavailable", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-03");

    const wedPanel = await page.evaluate(() => {
      const pill = document.querySelector('button[data-lp-date="2026-06-03"]');
      const notice = document.querySelector(".ds-week-surface--inset");
      return {
        lifecycle: pill?.getAttribute("data-lp-lifecycle") ?? "",
        hasUnavailableMark: !!pill?.querySelector(".ds-week-calendar-day-pill__state-mark--unavailable"),
        hasNotice: !!notice,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_STATE_PROBE_UNAVAILABLE_DAY", JSON.stringify(wedPanel));

    expect(wedPanel.lifecycle).toBe("unavailable");
    expect(wedPanel.hasUnavailableMark).toBe(true);
    expect(wedPanel.hasNotice).toBe(true);
  });
});
