// STEG 5.5 — computed style gate for .ds-week-surface--chip (read-only metadata pill)
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowDaySelected,
  installWeekVisualMocks,
  navigateToWeek,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

test.describe("Week chip probe", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("chip computed styles (allergen readonly)", async ({ page }) => {
    await installWeekVisualMocks(page, {
      allergenProfile: "has_data",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);

    const chip = page.locator(".ds-week-surface--chip").first();
    await expect(chip).toBeVisible();

    const styles = await chip.evaluate((el) => {
      const readChip = (node: Element) => {
        const cs = getComputedStyle(node);
        return {
          borderRadius: cs.borderRadius,
          borderTopLeftRadius: cs.borderTopLeftRadius,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          className: node.className,
        };
      };

      const probe = document.createElement("span");
      probe.className = "ds-week-surface ds-week-surface--chip";
      probe.textContent = "probe";
      probe.style.cssText =
        "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;";
      document.body.appendChild(probe);

      const chipStyles = readChip(el);
      const probeStyles = readChip(probe);
      document.body.removeChild(probe);

      return {
        chip: chipStyles,
        probe: probeStyles,
        bgMatchesProbe: chipStyles.backgroundColor === probeStyles.backgroundColor,
        colorMatchesProbe: chipStyles.color === probeStyles.color,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_CHIP_PROBE", JSON.stringify(styles));

    expect(styles.chip.borderTopLeftRadius).toBe("999px");
    expect(styles.chip.borderRadius).toBe("999px");
    expect(styles.bgMatchesProbe).toBe(true);
    expect(styles.colorMatchesProbe).toBe(true);
  });
});
