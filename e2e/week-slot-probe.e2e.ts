// STEG 5.4 — computed style gate for .ds-week-surface--slot (resting + selected)
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowOrderedUpcoming,
  expandOrderedWeekPicker,
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
    await expandOrderedWeekPicker(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);

    const resting = page.locator("button.ds-week-surface--slot[aria-pressed='false']").first();
    await expect(resting).toBeVisible();

    const selected = page.locator("button.ds-week-surface--slot[aria-pressed='true']").first();
    await expect(selected).toBeVisible();

    const styles = await selected.evaluate((el) => {
      const readSlot = (node: Element) => {
        const cs = getComputedStyle(node);
        return {
          borderRadius: cs.borderTopLeftRadius,
          borderTopColor: cs.borderTopColor,
          backgroundColor: cs.backgroundColor,
          className: node.className,
        };
      };

      const restingEl = el
        .closest(".week-day__categories")
        ?.querySelector("button.ds-week-surface--slot[aria-pressed='false']");
      const restingStyles = restingEl ? readSlot(restingEl) : null;

      const parent = el.parentElement;
      const probe = document.createElement("button");
      probe.className = el.className;
      probe.setAttribute("aria-pressed", "true");
      probe.style.cssText =
        "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;width:1px;height:48px;margin:0;padding:16px;box-sizing:border-box;";
      parent?.appendChild(probe);

      const selectedStyles = {
        ...readSlot(el),
        ariaPressed: el.getAttribute("aria-pressed"),
        matchesSelector: el.matches('.ds-week-surface--slot[aria-pressed="true"]'),
      };
      const probeStyles = readSlot(probe);
      parent?.removeChild(probe);

      const accentToken = getComputedStyle(document.documentElement)
        .getPropertyValue("--ds-accent")
        .trim();

      return {
        resting: restingStyles,
        selected: selectedStyles,
        probe: probeStyles,
        borderMatchesProbe: selectedStyles.borderTopColor === probeStyles.borderTopColor,
        bgMatchesProbe: selectedStyles.backgroundColor === probeStyles.backgroundColor,
        accentToken,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_SLOT_PROBE", JSON.stringify(styles));

    expect(styles.resting?.borderRadius).toBe("14px");
    expect(styles.selected.borderRadius).toBe("14px");
    expect(styles.selected.ariaPressed).toBe("true");
    expect(styles.selected.matchesSelector).toBe(true);
    expect(styles.borderMatchesProbe).toBe(true);
    expect(styles.bgMatchesProbe).toBe(true);
    expect(styles.selected.borderTopColor).not.toBe(styles.resting?.borderTopColor);
  });
});
