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
    await page.mouse.move(0, 0);

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
      const probe = document.createElement("button");
      probe.className = "ds-week-surface ds-week-surface--slot week-category-card is-ordered";
      probe.setAttribute("aria-pressed", "true");
      probe.style.cssText =
        "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;width:1px;height:48px;";
      document.body.appendChild(probe);
      const probeStyle = getComputedStyle(probe);
      const actualStyle = getComputedStyle(el);
      const result = {
        expected: probeStyle.borderTopColor,
        actual: actualStyle.borderTopColor,
        matches: actualStyle.borderTopColor === probeStyle.borderTopColor,
        bgExpected: probeStyle.backgroundColor,
        bgActual: actualStyle.backgroundColor,
        bgMatches: actualStyle.backgroundColor === probeStyle.backgroundColor,
      };
      document.body.removeChild(probe);
      return result;
    });

    // eslint-disable-next-line no-console
    console.log(
      "WEEK_SLOT_PROBE",
      JSON.stringify({ resting: restingStyles, selected: selectedStyles, accentBorder }),
    );

    expect(restingStyles.borderRadius).toBe("14px");
    expect(selectedStyles.borderRadius).toBe("14px");
    expect(accentBorder.matches).toBe(true);
    expect(accentBorder.bgMatches).toBe(true);
    expect(selectedStyles.ariaPressed).toBe("true");
  });
});
