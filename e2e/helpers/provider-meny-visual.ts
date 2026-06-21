// e2e/helpers/provider-meny-visual.ts — Deterministic /leverandor/meny visual regression (live route + API mock)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

import { loginViaForm, waitForPostLoginNavigation } from "./auth";
import { getProviderMenyVisualCredentials } from "./provider-meny-visual-auth";
import { waitForFontsReady } from "./ready";

export const PROVIDER_MENU_VISUAL_WEEK_START = "2026-06-15";
export const PROVIDER_MENU_VISUAL_OSLO_DATE = "2026-06-15";
export const PROVIDER_MENU_VISUAL_LOCKED_DATE = "2026-06-16";

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

const catalogFixture = JSON.parse(
  readFileSync(join(process.cwd(), "e2e/fixtures/provider-meny-catalog.json"), "utf8"),
) as { rows: unknown[] };

const FALLBACK_PRICES = {
  BASIS: {
    tier: "BASIS",
    priceExVatNok: 90,
    vatRate: 0.15,
    priceIncVatNok: 103.5,
    source: "fallback",
  },
  LUXUS: {
    tier: "LUXUS",
    priceExVatNok: 130,
    vatRate: 0.15,
    priceIncVatNok: 149.5,
    source: "fallback",
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    priceExVatNok: 170,
    vatRate: 0.15,
    priceIncVatNok: 195.5,
    source: "fallback",
  },
};

type FixtureItem = {
  id: string;
  date: string;
  tier: string;
  category: string;
  mealTitle: string;
  description: string;
  allergens: string[];
  estimatedCostPerPortion: number | null;
  sourcePackage: string | null;
  upgradeType: string | null;
  upgradeNote: string | null;
  status: "draft" | "published";
  orderLocked?: boolean;
  autoFilled?: boolean;
  providerOverride?: boolean;
};

function mkItem(
  date: string,
  tier: string,
  category: string,
  partial: Partial<FixtureItem> = {},
): FixtureItem {
  const id = `menuDay-${MELHUS_PROVIDER_ID}-${date}-${tier}-${category}`;
  return {
    id,
    date,
    tier,
    category,
    mealTitle: partial.mealTitle ?? "",
    description: partial.description ?? "",
    allergens: partial.allergens ?? [],
    estimatedCostPerPortion: partial.estimatedCostPerPortion ?? null,
    sourcePackage: partial.sourcePackage ?? null,
    upgradeType: partial.upgradeType ?? null,
    upgradeNote: partial.upgradeNote ?? null,
    status: partial.status ?? "published",
    orderLocked: partial.orderLocked,
    autoFilled: partial.autoFilled,
    providerOverride: partial.providerOverride,
  };
}

/** Canonical demo week — mirrors tests/api/provider-menu-days + badge precedence probe on Tue. */
export function buildProviderMenyVisualMenuDaysResponse() {
  const dates = [
    "2026-06-15",
    "2026-06-16",
    "2026-06-17",
    "2026-06-18",
    "2026-06-19",
  ];

  const items: FixtureItem[] = [
  mkItem("2026-06-15", "BASIS", "varmrett", {
      mealTitle: "Fiskesuppe",
      description: "Med fiskebiter og rotgrønnsaker.",
      status: "published",
      autoFilled: true,
      estimatedCostPerPortion: 32,
    }),
    mkItem("2026-06-16", "BASIS", "varmrett", {
      mealTitle: "Kyllinggryte",
      description: "Med rotgrønnsaker.",
      status: "published",
      providerOverride: true,
      autoFilled: true,
      orderLocked: true,
      estimatedCostPerPortion: 35,
      allergens: ["melk"],
    }),
    mkItem("2026-06-18", "BASIS", "varmrett", {
      mealTitle: "Biff stroganoff",
      description: "Med ris og salat.",
      status: "draft",
      estimatedCostPerPortion: 42,
    }),
    mkItem("2026-06-19", "BASIS", "varmrett", {
      mealTitle: "Pizza folio",
      description: "Fredagskos.",
      status: "published",
      autoFilled: true,
      estimatedCostPerPortion: 28,
    }),
    mkItem("2026-06-15", "BASIS", "paasmurt", { status: "published" }),
    mkItem("2026-06-15", "BASIS", "salatboks", { status: "published" }),
    mkItem("2026-06-15", "ENTERPRISE", "varmrett", {
      mealTitle: "Fiskesuppe",
      description: "Med fiskebiter og rotgrønnsaker.",
      status: "published",
      upgradeType: "beverage",
      upgradeNote: "Dagens drikke inkludert",
      sourcePackage: "LUXUS",
    }),
    mkItem("2026-06-18", "ENTERPRISE", "varmrett", {
      mealTitle: "Biff stroganoff",
      description: "Med ris og salat.",
      status: "draft",
      estimatedCostPerPortion: 42,
    }),
    mkItem("2026-06-15", "LUXUS", "sushi", {
      mealTitle: "Sushi-pakke",
      status: "published",
    }),
    mkItem("2026-06-15", "LUXUS", "pokebowl", {
      mealTitle: "Laks",
      status: "published",
    }),
    mkItem("2026-06-15", "LUXUS", "thai", {
      mealTitle: "Pad Thai nudler",
      status: "published",
    }),
  ];

  return {
    ok: true,
    rid: "prov-meny-visual-fixture",
    data: {
      weekStart: PROVIDER_MENU_VISUAL_WEEK_START,
      dates,
      items,
      prices: FALLBACK_PRICES,
      catalog: catalogFixture,
      orderCountsByDate: { [PROVIDER_MENU_VISUAL_LOCKED_DATE]: 14 },
      varmrettLockedDates: [PROVIDER_MENU_VISUAL_LOCKED_DATE],
      providerId: MELHUS_PROVIDER_ID,
      providerSlug: "melhus-catering",
    },
  };
}

export async function installProviderMenyVisualOsloClock(
  page: Page,
  serverOsloDate: string,
): Promise<void> {
  await page.clock.install({ time: new Date(`${serverOsloDate}T07:30:00+02:00`) });
}

export async function installProviderMenyVisualMocks(page: Page): Promise<void> {
  const body = buildProviderMenyVisualMenuDaysResponse();

  await page.route("**/api/provider/menu-days**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

export async function navigateToProviderMeny(page: Page): Promise<void> {
  await page.goto("/leverandor/meny", { waitUntil: "domcontentloaded" });
  const pathname = new URL(page.url()).pathname;
  if (pathname.startsWith("/login")) {
    const creds = getProviderMenyVisualCredentials();
    if (!creds) {
      throw new Error("Provider meny visual credentials required for navigation.");
    }
    await loginViaForm(page, creds.email, creds.password, "/leverandor/meny");
    await waitForPostLoginNavigation(page, { timeout: 15_000 });
  }
  await waitForProviderMenyVisualReady(page);
  await expect(page).toHaveURL(/\/leverandor\/meny/);
}

export async function waitForProviderMenyVisualReady(page: Page): Promise<void> {
  await page.locator(".lp-editor-root").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".lp-editor-days").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".lp-editor-package-card.is-active").waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await expect(page.locator(".lp-editor-layout")).not.toHaveClass(/is-week-loading/);
  await waitForFontsReady(page);
  await page.evaluate(() => {
    document.documentElement.classList.add("lp-provider-meny-visual-regression");
  });
  await page.waitForTimeout(150);
}

export async function selectProviderMenyTier(page: Page, tierLabel: string): Promise<void> {
  const tab = page.getByRole("tab", { name: new RegExp(tierLabel, "i") });
  await tab.waitFor({ state: "visible", timeout: 10_000 });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(100);
}

export const PROVIDER_MENY_VISUAL_SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixels: 500,
  threshold: 0.2,
  fullPage: false,
};

export function providerMenyEditorRootLocator(page: Page) {
  return page.locator(".lp-editor-root");
}
