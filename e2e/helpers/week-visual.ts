// e2e/helpers/week-visual.ts — Deterministic /week visual regression setup (STEG 0)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

import { waitForPostLoginNavigation } from "./auth";
import { waitForFontsReady } from "./ready";

export type WeekAllergenVisualProfile = "declared_empty" | "has_data";

const baseWindow = JSON.parse(
  readFileSync(join(process.cwd(), "e2e/fixtures/week-visual-window.base.json"), "utf8"),
) as {
  ok: boolean;
  rid: string;
  data: Record<string, unknown>;
};

const ALLERGEN_PROFILES: Record<WeekAllergenVisualProfile, object> = {
  declared_empty: {
    ok: true,
    rid: "allergen-visual-empty",
    data: {
      profile: {
        user_id: "week-visual-user",
        codes: [],
        free_text: "",
        updated_at: "2026-06-01T12:00:00.000Z",
      },
    },
  },
  has_data: {
    ok: true,
    rid: "allergen-visual-data",
    data: {
      profile: {
        user_id: "week-visual-user",
        codes: ["gluten", "gluten_wheat", "milk"],
        free_text: "",
        updated_at: "2026-06-01T12:00:00.000Z",
      },
    },
  },
};

const CATEGORY_FIXTURE = [
  {
    key: "salatboks",
    category: "salat",
    label: "Salatboks",
    title: "Salatboks",
    description: null,
    allergens: [],
    available: true,
    items: [
      {
        key: "kylling",
        title: "Kylling",
        allergens: [],
        isVegetarian: false,
      },
    ],
  },
  {
    key: "paasmurt",
    category: "paasmurt",
    label: "Påsmurt",
    title: "Påsmurt",
    description: null,
    allergens: ["gluten"],
    available: true,
    items: [
      {
        key: "ost-skinke",
        title: "Ost & skinke",
        allergens: ["gluten", "melk"],
        isVegetarian: false,
      },
    ],
  },
  {
    key: "varmrett",
    category: "varmrett",
    label: "Varmmat",
    title: "Varmmat",
    description: null,
    allergens: [],
    available: true,
    items: [
      {
        key: "laks",
        title: "Laks med grønnsaker",
        allergens: ["fisk"],
        isVegetarian: false,
      },
    ],
  },
];

function dayRow(
  date: string,
  weekday: string,
  partial: Record<string, unknown> = {},
) {
  return {
    date,
    weekday,
    tier: "BASIS",
    planTier: "BASIS",
    allowedChoices: [
      { key: "salatboks", label: "Salatboks" },
      { key: "paasmurt", label: "Påsmurt" },
      { key: "varmrett", label: "Varmmat" },
    ],
    categories: CATEGORY_FIXTURE,
    selectedChoiceKey: null,
    selectedItemKey: null,
    selectedItemTitleSnapshot: null,
    isLocked: false,
    isEnabled: true,
    lockReason: null,
    orderStatus: null,
    wantsLunch: false,
    menuTitle: null,
    menuDescription: null,
    allergens: [],
    menuImages: [],
    ...partial,
  };
}

/** Tir 02.06 valgt, ikke bestilt — viser kategori-valg. */
export function buildWeekVisualWindowDaySelected() {
  return {
    ...baseWindow,
    data: {
      ...baseWindow.data,
      days: [
        dayRow("2026-06-01", "Mandag", { isLocked: true, lockReason: "CUTOFF" }),
        dayRow("2026-06-02", "Tirsdag"),
        dayRow("2026-06-03", "Onsdag"),
        dayRow("2026-06-04", "Torsdag"),
        dayRow("2026-06-05", "Fredag"),
        dayRow("2026-06-08", "Mandag"),
        dayRow("2026-06-09", "Tirsdag"),
        dayRow("2026-06-10", "Onsdag"),
        dayRow("2026-06-11", "Torsdag"),
        dayRow("2026-06-12", "Fredag"),
      ],
    },
  };
}

/** Tir 02.06 bestilt + kommende dager-liste. */
export function buildWeekVisualWindowOrderedUpcoming() {
  return {
    ...baseWindow,
    data: {
      ...baseWindow.data,
      days: [
        dayRow("2026-06-01", "Mandag", { isLocked: true, lockReason: "CUTOFF" }),
        dayRow("2026-06-02", "Tirsdag", {
          orderStatus: "ACTIVE",
          wantsLunch: true,
          selectedChoiceKey: "paasmurt",
          selectedItemKey: "ost-skinke",
          selectedItemTitleSnapshot: "Ost & skinke",
        }),
        dayRow("2026-06-03", "Onsdag"),
        dayRow("2026-06-04", "Torsdag"),
        dayRow("2026-06-05", "Fredag"),
        dayRow("2026-06-08", "Mandag"),
        dayRow("2026-06-09", "Tirsdag"),
        dayRow("2026-06-10", "Onsdag"),
        dayRow("2026-06-11", "Torsdag"),
        dayRow("2026-06-12", "Fredag"),
      ],
    },
  };
}

export async function installWeekVisualMocks(
  page: Page,
  options: {
    allergenProfile: WeekAllergenVisualProfile;
    windowBody: object;
  },
): Promise<void> {
  await page.route("**/api/order/window**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.windowBody),
    });
  });

  await page.route("**/api/order/week-demand-hints**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, rid: "hints-rid", data: { hint: null } }),
    });
  });

  const allergenBody = ALLERGEN_PROFILES[options.allergenProfile];
  await page.route("**/api/me/user-allergens**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(allergenBody),
    });
  });
}

/** Reuses employee session from global-setup storageState — no per-test login. */
export async function navigateToWeek(page: Page): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto("/week", { waitUntil: "commit", timeout: 30_000 });
      await waitForPostLoginNavigation(page, { timeout: 15_000 });
      await expect(page).toHaveURL(/\/week/);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }

  throw lastError;
}

export async function waitForWeekVisualReady(page: Page): Promise<void> {
  await page.getByRole("heading", { name: /bestill eller avbestill lunsj/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.getByRole("heading", { name: /dine allergener/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.getByRole("navigation", { name: /velg dag/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.evaluate(() => {
    document.documentElement.classList.add("lp-week-visual-regression");
  });
  await waitForFontsReady(page);
  await page.waitForTimeout(150);
}

export async function selectWeekDay(page: Page, isoDate: string): Promise<void> {
  const pill = page.locator(`button[data-lp-date="${isoDate}"]`);
  await pill.waitFor({ state: "visible", timeout: 10_000 });
  await pill.click();
  await expect(pill).toHaveAttribute("class", /ds-week-calendar-day-pill--selected/);
}

export const WEEK_VISUAL_SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixels: 500,
  threshold: 0.2,
  fullPage: false,
};

export function weekMainLocator(page: Page) {
  return page.locator("main.lp-main");
}
