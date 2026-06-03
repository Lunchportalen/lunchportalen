// STEG 5.4 — computed style gate for .ds-week-surface--slot (resting + selected)
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

test.describe("Week slot probe", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("slot resting + selected computed styles", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    const resting = page.locator("button.ds-week-surface--slot[aria-pressed='false']").first();
    await expect(resting).toBeVisible();

    const selected = page.locator("button.ds-week-surface--slot[aria-pressed='true']").first();
    await expect(selected).toBeVisible();

    const restingStyles = await resting.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderTopLeftRadius,
        borderColor: cs.borderColor,
        className: el.className,
      };
    });

    const selectedStyles = await selected.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderTopLeftRadius,
        borderColor: cs.borderColor,
        className: el.className,
        ariaPressed: el.getAttribute("aria-pressed"),
      };
    });

    const accentBorder = await selected.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;border:1px solid var(--ds-accent);";
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).borderTopColor;
      document.body.removeChild(probe);
      const actual = getComputedStyle(el).borderTopColor;
      return { expected, actual, matches: actual === expected };
    });

    // eslint-disable-next-line no-console
    console.log(
      "WEEK_SLOT_PROBE",
      JSON.stringify({ resting: restingStyles, selected: selectedStyles, accentBorder }),
    );

    expect(restingStyles.borderRadius).toBe("14px");
    expect(selectedStyles.borderRadius).toBe("14px");
    expect(accentBorder.matches).toBe(true);
    expect(selectedStyles.ariaPressed).toBe("true");
  });
});
