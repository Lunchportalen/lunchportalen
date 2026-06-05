// STEG 8 — V.W8 computed style gate for unified .ds-week-icon lifecycle markers
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

/** STEG 5.4 — locked baseline for slot is-ordered ::after (must not flatten into ds-week-icon). */
const SLOT_ORDERED_CHECK_AFTER_BASELINE = {
  content: '"✓"',
  position: "absolute",
  widthPx: 22,
  heightPx: 22,
  top: "12px",
  right: "12px",
} as const;

const CALENDAR_MARK_FONT_SIZE_PX = 12;

type IconRectProbe = {
  markColor: string;
  fontSize: string;
  ariaHidden: string | null;
  computedWidth: number;
  computedHeight: number;
  resolvedWidth: number;
  resolvedHeight: number;
  color: string;
  stroke: string;
};

type SlotClockProbe = {
  className: string;
  usesDsWeekIconPrimitive: boolean;
  ariaHidden: string | null;
  computedWidth: number;
  computedHeight: number;
  resolvedWidth: number;
  resolvedHeight: number;
  color: string;
  stroke: string;
  labelFontSize: string;
};

test.describe("Week icon probe (V.W8)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("calendar lifecycle icons + slot ::after guard + slot clock comparison", async ({ page }) => {
    test.setTimeout(90_000);
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowOrderedUpcoming(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-02");

    const calendarProbe = await page.evaluate((fontSizePx) => {
      const readCalendarIcon = (iso: string, selector: string): IconRectProbe | null => {
        const pill = document.querySelector(`button[data-lp-date="${iso}"]`);
        const mark = pill?.querySelector(selector);
        const icon = mark?.querySelector(".ds-week-icon");
        if (!mark || !icon) return null;
        const svg = icon.querySelector("svg");
        const markCs = getComputedStyle(mark);
        const iconCs = getComputedStyle(icon);
        const svgCs = svg ? getComputedStyle(svg) : iconCs;
        const rect = icon.getBoundingClientRect();
        return {
          markColor: markCs.color,
          fontSize: markCs.fontSize,
          ariaHidden: icon.getAttribute("aria-hidden"),
          computedWidth: parseFloat(iconCs.width),
          computedHeight: parseFloat(iconCs.height),
          resolvedWidth: rect.width,
          resolvedHeight: rect.height,
          color: iconCs.color,
          stroke: svgCs.stroke || svgCs.color,
        };
      };

      return {
        locked: readCalendarIcon("2026-06-01", ".ds-week-calendar-day-pill__state-mark--locked"),
        ordered: readCalendarIcon("2026-06-02", ".ds-week-calendar-day-pill__state-mark--ordered"),
        unavailable: readCalendarIcon(
          "2026-06-03",
          ".ds-week-calendar-day-pill__state-mark--unavailable",
        ),
        fontSizeRawPx: fontSizePx,
      };
    }, CALENDAR_MARK_FONT_SIZE_PX);

    expect(calendarProbe.locked, "Mon locked calendar icon").not.toBeNull();
    expect(calendarProbe.ordered, "Tue ordered calendar icon").not.toBeNull();
    expect(calendarProbe.unavailable, "Wed unavailable calendar icon").not.toBeNull();

    const calIcons = [calendarProbe.locked!, calendarProbe.ordered!, calendarProbe.unavailable!];

    for (const icon of calIcons) {
      expect(icon.ariaHidden, "calendar icon aria-hidden").toBe("true");
      expect(icon.resolvedHeight, "calendar icon perceivable height").toBeGreaterThan(0);
      expect(icon.resolvedWidth, "calendar icon perceivable width").toBeGreaterThan(0);
      expect(icon.color, "icon color follows mark currentColor").toBe(icon.markColor);
      expect(parseFloat(icon.fontSize), "calendar mark font-size 12px (raw, not token)").toBe(
        CALENDAR_MARK_FONT_SIZE_PX,
      );
    }

    expect(calIcons[0]!.resolvedWidth).toBeCloseTo(calIcons[1]!.resolvedWidth, 1);
    expect(calIcons[0]!.resolvedHeight).toBeCloseTo(calIcons[2]!.resolvedHeight, 1);
    expect(calIcons[0]!.resolvedWidth).toBeCloseTo(calIcons[0]!.resolvedHeight, 1);

    // Slot clock: NON-BLOCKING observation only (V.W6 owns the gate).
    // No locked-day tap — app reverts locked-day selection (CUTOFF); Mon poll was racy in full-suite.
    let slotClockProbe: (SlotClockProbe & { labelText: string }) | null = null;
    let slotClockObservationError: string | null = null;
    try {
      slotClockProbe = await page.evaluate(() => {
        const slot = document.querySelector(
          "button.ds-week-surface--slot.is-locked",
        ) as HTMLElement | null;
        const icon = slot?.querySelector(".week-category-card__state-icon");
        if (!slot || !icon) return null;
        const label = slot.querySelector(".week-category-card__state-label");
        const iconEl = icon as HTMLElement;
        const iconCs = getComputedStyle(iconEl);
        const svg = iconEl.tagName === "svg" ? iconEl : iconEl.querySelector("svg");
        const svgCs = svg ? getComputedStyle(svg) : iconCs;
        const rect = iconEl.getBoundingClientRect();
        const labelCs = label ? getComputedStyle(label) : null;
        return {
          className: iconEl.getAttribute("class") ?? String(iconEl.className),
          usesDsWeekIconPrimitive: iconEl.classList.contains("ds-week-icon"),
          ariaHidden: iconEl.getAttribute("aria-hidden"),
          computedWidth: parseFloat(iconCs.width),
          computedHeight: parseFloat(iconCs.height),
          resolvedWidth: rect.width,
          resolvedHeight: rect.height,
          color: iconCs.color,
          stroke: svgCs.stroke || svgCs.color,
          labelFontSize: labelCs?.fontSize ?? "",
          labelText: label?.textContent?.trim() ?? "",
        } satisfies SlotClockProbe & { labelText: string };
      });
    } catch (err) {
      slotClockObservationError =
        err instanceof Error ? err.message : String(err);
    }

    await selectWeekDay(page, "2026-06-02");
    await expandOrderedWeekPicker(page);

    const slotCheckAfter = await page.evaluate(() => {
      const slot = document.querySelector(
        "button.week-category-card.is-ordered[aria-pressed='true']",
      ) as HTMLElement | null;
      if (!slot) return null;
      const after = getComputedStyle(slot, "::after");
      return {
        content: after.content,
        position: after.position,
        display: after.display,
        width: after.width,
        height: after.height,
        top: after.top,
        right: after.right,
        borderTopColor: after.borderTopColor,
      };
    });

    expect(slotCheckAfter, "slot is-ordered ::after present").not.toBeNull();
    expect(slotCheckAfter!.content).toBe(SLOT_ORDERED_CHECK_AFTER_BASELINE.content);
    expect(slotCheckAfter!.position).toBe(SLOT_ORDERED_CHECK_AFTER_BASELINE.position);
    expect(parseFloat(slotCheckAfter!.width)).toBeCloseTo(
      SLOT_ORDERED_CHECK_AFTER_BASELINE.widthPx,
      0,
    );
    expect(parseFloat(slotCheckAfter!.height)).toBeCloseTo(
      SLOT_ORDERED_CHECK_AFTER_BASELINE.heightPx,
      0,
    );
    expect(slotCheckAfter!.top).toBe(SLOT_ORDERED_CHECK_AFTER_BASELINE.top);
    expect(slotCheckAfter!.right).toBe(SLOT_ORDERED_CHECK_AFTER_BASELINE.right);

    const calendarLockedResolved = {
      width: calendarProbe.locked!.resolvedWidth,
      height: calendarProbe.locked!.resolvedHeight,
    };
    const slotClockResolved = slotClockProbe
      ? {
          width: slotClockProbe.resolvedWidth,
          height: slotClockProbe.resolvedHeight,
        }
      : null;
    const clockTreatmentsMatch =
      slotClockResolved !== null &&
      Math.abs(calendarLockedResolved.width - slotClockResolved.width) < 0.5 &&
      Math.abs(calendarLockedResolved.height - slotClockResolved.height) < 0.5;

    const result = {
      calendar: calendarProbe,
      resolvedPxReport: {
        locked: calendarLockedResolved,
        ordered: {
          width: calendarProbe.ordered!.resolvedWidth,
          height: calendarProbe.ordered!.resolvedHeight,
        },
        unavailable: {
          width: calendarProbe.unavailable!.resolvedWidth,
          height: calendarProbe.unavailable!.resolvedHeight,
        },
        fontSizeRawPx: CALENDAR_MARK_FONT_SIZE_PX,
        allCalendarIconsSameResolvedPx:
          calIcons[0]!.resolvedWidth === calIcons[1]!.resolvedWidth &&
          calIcons[0]!.resolvedHeight === calIcons[2]!.resolvedHeight,
      },
      slotClockIcon: slotClockProbe,
      slotClockObservationError,
      slotClockVsCalendarLocked: {
        calendarLocked: calendarLockedResolved,
        slotLocked: slotClockResolved,
        treatmentsMatch: slotClockResolved ? clockTreatmentsMatch : null,
        note: slotClockResolved
          ? clockTreatmentsMatch
            ? "calendar ds-week-icon (1em) and slot week-category-card__state-icon (12px) resolve to same px — acceptable convergence"
            : "bevisst unntak: calendar uses ds-week-icon (1em); slot uses fixed 12px week-category-card__state-icon (V.W6) — report only, not a failure"
          : "NON-BLOCKING: locked slot clock not mounted on current panel (no Mon tap — app reverts locked-day selection); V.W6 covers slot clock",
      },
      slotCheckAfter,
      slotCheckAfterBaseline: SLOT_ORDERED_CHECK_AFTER_BASELINE,
    };

    // eslint-disable-next-line no-console
    console.log("WEEK_ICON_PROBE", JSON.stringify(result));

    const reviewOut = process.env.LP_REVIEW_SURFACE_OUT?.trim();
    if (reviewOut) {
      const dir = join(process.cwd(), reviewOut);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "WEEK_ICON_PROBE.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }

    expect(result.resolvedPxReport.allCalendarIconsSameResolvedPx).toBe(true);
  });
});
