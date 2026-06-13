// STEG 9 — V.W9 computed style gate for /week micro type tokens (--ds-body-xs / --ds-body-xxs)
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import {
  buildWeekVisualWindowDaySelected,
  installWeekVisualMocks,
  navigateToWeek,
  selectWeekDay,
  waitForWeekVisualReady,
} from "./helpers/week-visual";
import { getCredentialsForRole } from "./helpers/auth";

const hasEmployeeCreds = !!getCredentialsForRole("employee");

type DomTypoProbe = {
  selector: string;
  found: boolean;
  fontSize: string;
  expectedToken: "--ds-body-xs" | "--ds-body-xxs";
  expectedPx: string;
};

type HiddenTypoProbe = {
  className: string;
  mounted: boolean;
  fontSize: string;
  expectedToken: "--ds-body-xs" | "--ds-body-xxs";
  expectedPx: string;
};

type TypographyProbeResult = {
  rootTokens: {
    dsBodyXs: string;
    dsBodyXxs: string;
  };
  domElements: DomTypoProbe[];
  hiddenProbes: HiddenTypoProbe[];
  stateMark: {
    selector: string;
    fontSize: string;
    dsBodyXs: string;
  } | null;
};

test.describe("Week typography probe (V.W9)", () => {
  test.skip(!hasEmployeeCreds, "E2E_EMPLOYEE_* required");

  test("micro type tokens resolve to unchanged computed px on tokenized elements", async ({ page }) => {
    test.setTimeout(90_000);
    await installWeekVisualMocks(page, {
      allergenProfile: "declared_empty",
      windowBody: buildWeekVisualWindowDaySelected(),
    });
    await navigateToWeek(page);
    await waitForWeekVisualReady(page);
    await selectWeekDay(page, "2026-06-04");

    const result = await page.evaluate((): TypographyProbeResult => {
      const root = document.documentElement;
      const rootCs = getComputedStyle(root);
      const dsBodyXs = rootCs.getPropertyValue("--ds-body-xs").trim();
      const dsBodyXxs = rootCs.getPropertyValue("--ds-body-xxs").trim();

      const readFontSize = (el: Element | null): string =>
        el ? getComputedStyle(el).fontSize : "";

      const mountHiddenProbe = (className: string): HTMLElement => {
        const probe = document.createElement("span");
        probe.className = className;
        probe.textContent = "probe";
        probe.style.cssText =
          "position:absolute;left:-9999px;visibility:hidden;pointer-events:none;";
        document.body.appendChild(probe);
        return probe;
      };

      const domTargets: Array<{
        selector: string;
        token: "--ds-body-xs" | "--ds-body-xxs";
        expectedPx: string;
      }> = [
        {
          selector: ".ds-week-calendar-day-pill__weekday",
          token: "--ds-body-xs",
          expectedPx: dsBodyXs,
        },
        {
          selector: ".ds-week-calendar-day-pill__daynum",
          token: "--ds-body-xxs",
          expectedPx: dsBodyXxs,
        },
        {
          selector: ".ds-week-status-pill",
          token: "--ds-body-xs",
          expectedPx: dsBodyXs,
        },
        {
          selector: ".week-category-card__state-label",
          token: "--ds-body-xs",
          expectedPx: dsBodyXs,
        },
      ];

      const domElements: DomTypoProbe[] = domTargets.map((target) => {
        const el = document.querySelector(target.selector);
        return {
          selector: target.selector,
          found: el !== null,
          fontSize: readFontSize(el),
          expectedToken: target.token,
          expectedPx: target.expectedPx,
        };
      });

      const hiddenProbeDefs: Array<{
        className: string;
        token: "--ds-body-xs" | "--ds-body-xxs";
        expectedPx: string;
      }> = [
        {
          className: "ds-allergen-badge ds-allergen-badge--warning",
          token: "--ds-body-xs",
          expectedPx: dsBodyXs,
        },
        {
          className: "ds-week-insight-pill",
          token: "--ds-body-xxs",
          expectedPx: dsBodyXxs,
        },
      ];

      const hiddenMounts: HTMLElement[] = [];
      const hiddenProbes: HiddenTypoProbe[] = hiddenProbeDefs.map((def) => {
        const probeEl = mountHiddenProbe(def.className);
        hiddenMounts.push(probeEl);
        const fontSize = readFontSize(probeEl);
        return {
          className: def.className,
          mounted: document.body.contains(probeEl),
          fontSize,
          expectedToken: def.token,
          expectedPx: def.expectedPx,
        };
      });

      for (const node of hiddenMounts) {
        document.body.removeChild(node);
      }

      const stateMark = document
        .querySelector('button[data-lp-date="2026-06-01"]')
        ?.querySelector(".ds-week-calendar-day-pill__state-mark--locked");
      const stateMarkFontSize = readFontSize(stateMark ?? null);

      return {
        rootTokens: { dsBodyXs, dsBodyXxs },
        domElements,
        hiddenProbes,
        stateMark: stateMark
          ? {
              selector: ".ds-week-calendar-day-pill__state-mark--locked",
              fontSize: stateMarkFontSize,
              dsBodyXs,
            }
          : null,
      };
    });

    // eslint-disable-next-line no-console
    console.log("WEEK_TYPO_PROBE", JSON.stringify(result));

    const reviewOut = process.env.LP_REVIEW_SURFACE_OUT?.trim();
    if (reviewOut) {
      const dir = join(process.cwd(), reviewOut);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "WEEK_TYPO_PROBE.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }

    expect(result.rootTokens.dsBodyXs, ":root --ds-body-xs").toBe("12px");
    expect(result.rootTokens.dsBodyXxs, ":root --ds-body-xxs").toBe("11px");

    for (const el of result.domElements) {
      expect(el.found, `${el.selector} must exist in DOM`).toBe(true);
      expect(el.fontSize, `${el.selector} font-size non-empty`).not.toBe("");
      expect(parseFloat(el.fontSize), `${el.selector} font-size parseable`).toBeGreaterThan(0);
      expect(el.fontSize, `${el.selector} font-size`).toBe(el.expectedPx);
    }

    for (const probe of result.hiddenProbes) {
      expect(probe.mounted, `${probe.className} hidden probe mounted`).toBe(true);
      expect(probe.fontSize, `${probe.className} font-size non-empty`).not.toBe("");
      expect(parseFloat(probe.fontSize), `${probe.className} font-size parseable`).toBeGreaterThan(0);
      expect(probe.fontSize, `${probe.className} font-size`).toBe(probe.expectedPx);
    }

    expect(result.stateMark, "locked calendar state-mark present (V.W8 lineage)").not.toBeNull();
    expect(result.stateMark!.fontSize, "state-mark font-size === --ds-body-xs").toBe(
      result.stateMark!.dsBodyXs,
    );
  });
});
