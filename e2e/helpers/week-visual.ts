// e2e/helpers/week-visual.ts — Deterministic /week visual regression setup (STEG 0)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

import {
  getCredentialsForRole,
  loginViaForm,
  waitForPostLoginNavigation,
} from "./auth";
import { waitForFontsReady } from "./ready";

export const NAVIGATE_TO_WEEK_MAX_ATTEMPTS = 3;
export const NAVIGATE_TO_WEEK_REAUTH_MAX_ATTEMPTS = 3;

function isLoginPath(pathname: string): boolean {
  return /^\/login(?:\/|$)/.test(pathname);
}

/** Bounded re-auth when storageState session is stale (e.g. concurrent seed invalidation). */
async function reauthEmployeeToWeek(page: Page): Promise<void> {
  const creds = getCredentialsForRole("employee");
  if (!creds) {
    throw new Error("E2E_EMPLOYEE_EMAIL/PASSWORD required for week visual navigation.");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= NAVIGATE_TO_WEEK_REAUTH_MAX_ATTEMPTS; attempt++) {
    try {
      await loginViaForm(page, creds.email, creds.password, "/week");
      await waitForPostLoginNavigation(page, { timeout: 15_000 });
      await waitForWeekVisualReady(page);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < NAVIGATE_TO_WEEK_REAUTH_MAX_ATTEMPTS) {
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }

  throw lastError;
}

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

/** Fast Oslo-dato for allergen week-visual (baseline = Tor 04.06.2026). */
export const WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE = "2026-06-04";

/** Overstyr serverOsloDate for stabil V.W6 / dag-panel harness. */
export function withWeekVisualServerOsloDate<T extends { data: Record<string, unknown> }>(
  windowBody: T,
  serverOsloDate: string,
): T {
  return {
    ...windowBody,
    data: {
      ...windowBody.data,
      serverOsloDate,
      serverNow: `${serverOsloDate}T07:30:00.000+02:00`,
    },
  };
}

/** Allergen collapsed screenshots — pinned default day (not browser «nå»). */
export function buildWeekVisualWindowAllergenCollapsed() {
  return withWeekVisualServerOsloDate(
    buildWeekVisualWindowDaySelected(),
    WEEK_VISUAL_ALLERGEN_PINNED_OSLO_DATE,
  );
}

/** Playwright-klokke = mock serverOsloDate slik at pickDefaultDateFromPatterns er deterministisk. */
export async function installWeekVisualOsloClock(page: Page, serverOsloDate: string): Promise<void> {
  await page.clock.install({ time: new Date(`${serverOsloDate}T07:30:00+02:00`) });
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
        dayRow("2026-06-03", "Onsdag", {
          reason: "NO_TIER_FOR_DAY",
          tier: null,
          planTier: null,
          isEnabled: false,
          categories: [],
          allowedChoices: [],
        }),
        dayRow("2026-06-04", "Torsdag", {
          categories: CATEGORY_FIXTURE.map((c) =>
            c.key === "varmrett" ? { ...c, available: false } : c,
          ),
        }),
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

/** Mandag bestilt + cutoff — read-only kollaps (STEG 7.2 / V.W7 locked-gren). */
export function buildWeekVisualWindowOrderedLockedCutoff() {
  return withWeekVisualServerOsloDate(
    {
      ...baseWindow,
      data: {
        ...baseWindow.data,
        days: [
          dayRow("2026-06-01", "Mandag", {
            isLocked: true,
            lockReason: "CUTOFF",
            orderStatus: "ACTIVE",
            wantsLunch: true,
            selectedChoiceKey: "paasmurt",
            selectedItemKey: "ost-skinke",
            selectedItemTitleSnapshot: "Ost & skinke",
          }),
          dayRow("2026-06-02", "Tirsdag", { isLocked: true, lockReason: "CUTOFF" }),
          dayRow("2026-06-03", "Onsdag", { isLocked: true, lockReason: "CUTOFF" }),
          dayRow("2026-06-04", "Torsdag", { isLocked: true, lockReason: "CUTOFF" }),
          dayRow("2026-06-05", "Fredag", { isLocked: true, lockReason: "CUTOFF" }),
        ],
      },
    },
    "2026-06-01",
  );
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
        dayRow("2026-06-03", "Onsdag", {
          reason: "NO_TIER_FOR_DAY",
          tier: null,
          planTier: null,
          isEnabled: false,
          categories: [],
          allowedChoices: [],
        }),
        dayRow("2026-06-04", "Torsdag", {
          categories: CATEGORY_FIXTURE.map((c) =>
            c.key === "varmrett" ? { ...c, available: false } : c,
          ),
        }),
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

/**
 * Reuses employee session from global-setup storageState when valid; self-heals via
 * loginViaForm when middleware redirects to /login (stale session after concurrent seed).
 */
export async function navigateToWeek(page: Page): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= NAVIGATE_TO_WEEK_MAX_ATTEMPTS; attempt++) {
    try {
      await page.goto("/week", { waitUntil: "commit", timeout: 30_000 });
      const pathname = new URL(page.url()).pathname;

      if (isLoginPath(pathname)) {
        await reauthEmployeeToWeek(page);
        await expect(page).toHaveURL(/\/week/);
        return;
      }

      await waitForWeekVisualReady(page);
      await expect(page).toHaveURL(/\/week/);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < NAVIGATE_TO_WEEK_MAX_ATTEMPTS) {
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

/** STEG 7.2 — åpne kategori-picker på bestilt dag (kollapset som standard). */
export async function expandOrderedWeekPicker(page: Page): Promise<void> {
  const editBtn = page.locator(".ds-week-ordered-collapse__edit").first();
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(editBtn).toHaveAttribute("aria-expanded", "true");
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
