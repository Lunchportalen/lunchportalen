// STEG 6 — computed style gate for /week motion (--ds-ease + 180ms, reduce → none)
import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowOrderedUpcoming,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

async function waitForWeekMotionProbeReady(page: import("@playwright/test").Page) {
  await page.getByRole("heading", { name: /bestill eller avbestill lunsj/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.getByRole("navigation", { name: /velg dag/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
}

test.describe("Week motion probe", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("slot + row motion (no-preference)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekMotionProbeReady(page);
    await selectWeekDay(page, "2026-06-02");

    const styles = await page.evaluate(() => {
      const slot = document.querySelector("button.ds-week-surface--slot");
      const row = document.querySelector("button.ds-week-surface--row");
      if (!slot || !row) return null;
      const read = (node: Element) => {
        const cs = getComputedStyle(node);
        return {
          transitionProperty: cs.transitionProperty,
          transitionDuration: cs.transitionDuration,
          transitionTimingFunction: cs.transitionTimingFunction,
        };
      };
      return { slot: read(slot), row: read(row) };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_MOTION_PROBE_NO_PREFERENCE", JSON.stringify(styles));

    expect(styles).not.toBeNull();
    expect(styles!.slot.transitionDuration).toContain("0.18s");
    expect(styles!.slot.transitionTimingFunction).toContain("0.22");
    expect(styles!.slot.transitionTimingFunction).toContain("0.61");
    expect(styles!.slot.transitionProperty).toMatch(/border/i);
    expect(styles!.slot.transitionProperty).toMatch(/background/i);
    expect(styles!.row.transitionDuration).toContain("0.18s");
    expect(styles!.row.transitionTimingFunction).toContain("0.22");
    expect(styles!.row.transitionProperty).toMatch(/transform/i);
  });

  test("slot + row motion (reduce)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekMotionProbeReady(page);
    await selectWeekDay(page, "2026-06-02");

    const styles = await page.evaluate(() => {
      const slot = document.querySelector("button.ds-week-surface--slot");
      const row = document.querySelector("button.ds-week-surface--row");
      if (!slot || !row) return null;
      const read = (node: Element) => {
        const cs = getComputedStyle(node);
        return {
          transitionProperty: cs.transitionProperty,
          transitionDuration: cs.transitionDuration,
          transitionTimingFunction: cs.transitionTimingFunction,
        };
      };
      return { slot: read(slot), row: read(row) };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_MOTION_PROBE_REDUCE", JSON.stringify(styles));

    expect(styles).not.toBeNull();
    expect(styles!.slot.transitionProperty).toBe("none");
    expect(styles!.row.transitionProperty).toBe("none");
    expect(parseFloat(styles!.slot.transitionDuration)).toBeLessThan(0.001);
    expect(parseFloat(styles!.row.transitionDuration)).toBeLessThan(0.001);
  });
});
