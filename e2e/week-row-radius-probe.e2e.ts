// One-shot probe: computed border-radius on .ds-week-surface--row (STEG 5.3 gate)
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

test.describe("Week row radius probe", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("upcoming row computed border-radius", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    const row = page.locator("button.ds-week-surface--row").first();
    await expect(row).toBeVisible();

    const styles = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        borderTopLeftRadius: cs.borderTopLeftRadius,
        className: el.className,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_ROW_RADIUS_PROBE", JSON.stringify(styles));

    expect(styles.borderRadius).toBe("22px");
    expect(styles.borderTopLeftRadius).toBe("22px");
  });
});
