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

    const lockedNoteLabel = page.locator(".ds-week-ordered-collapse__locked-note__label").first();
    await expect(lockedNoteLabel).toBeVisible();
    const lockedNoteText = (await lockedNoteLabel.innerText()).replace(/\s+/g, " ").trim();
    expect(lockedNoteText).toBe("Frist passert");

    const lockedNoteVisibleProbe = await lockedNoteLabel.evaluate((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        display: cs.display,
        visibility: cs.visibility,
        height: rect.height,
        width: rect.width,
      };
    });
    assertPerceivableAffordance(lockedNoteVisibleProbe, "locked collapse visible Frist passert label");

    const monPill = page.locator('button[data-lp-date="2026-06-01"]');
    await expect(monPill).toHaveAttribute("data-lp-lifecycle", "locked");

    const lockedMark = monPill.locator(".ds-week-calendar-day-pill__state-mark--locked");
    await expect(lockedMark).toBeVisible();
    const markBox = await lockedMark.boundingBox();
    expect(markBox?.height ?? 0).toBeGreaterThan(0);

    const pickerGate = await page.evaluate(() => {
      const collapse = document.querySelector(".ds-week-ordered-collapse");
      const picker = document.querySelector(".week-ordered-picker-region");
      const editInDom = document.querySelector(".ds-week-ordered-collapse__edit");
      const ariaControlsTargets = Array.from(
        document.querySelectorAll("[aria-controls^='week-ordered-picker-']"),
      );
      const visibleSlotControls = collapse
        ? Array.from(collapse.querySelectorAll("button.week-category-card")).filter((el) => {
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return cs.display !== "none" && cs.visibility !== "hidden" && rect.height > 0;
          })
        : [];
      return {
        pickerInDom: picker !== null,
        pickerHidden:
          picker === null ||
          picker.hasAttribute("hidden") ||
          getComputedStyle(picker).display === "none" ||
          getComputedStyle(picker).visibility === "hidden",
        editControlInDom: editInDom !== null,
        ariaControlsTargetCount: ariaControlsTargets.length,
        visibleSlotControlsInCollapse: visibleSlotControls.length,
      };
    });

    const lockedPayload = {
      summaryText,
      endreCount,
      lockedNoteText,
      lockedNoteVisibleHeight: lockedNoteVisibleProbe.height,
      calendarLockedMarkHeight: markBox?.height ?? 0,
      pickerGate,
    };

    // eslint-disable-next-line no-console
    console.log("WEEK_COLLAPSE_PROBE_LOCKED", JSON.stringify(lockedPayload));

    expect(pickerGate.editControlInDom).toBe(false);
    expect(pickerGate.ariaControlsTargetCount).toBe(0);
    expect(pickerGate.pickerHidden).toBe(true);
    expect(pickerGate.visibleSlotControlsInCollapse).toBe(0);
  });
});
