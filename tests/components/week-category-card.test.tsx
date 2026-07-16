/** @vitest-environment jsdom */

import React from "react";
import { act } from "@/tests/_helpers/reactAct";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import { WeekCategoryCards, ALLERGEN_UNVERIFIED_NOTICE, type DayRow } from "@/app/(app)/week/EmployeeWeekClient";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type DayCategoryFixture = DayRow["categories"][number];

function makeCategory(
  partial: Pick<DayCategoryFixture, "key" | "label"> &
    Partial<Omit<DayCategoryFixture, "key" | "label">>,
): DayCategoryFixture {
  return {
    category: null,
    title: null,
    description: null,
    allergens: [],
    available: true,
    items: [],
    ...partial,
  };
}

function makeDay(partial: Partial<DayRow> & Pick<DayRow, "categories">): DayRow {
  return {
    date: "2026-06-04",
    weekday: "Ons",
    tier: "BASIS",
    planTier: "BASIS",
    allowedChoices: [],
    selectedChoiceKey: null,
    selectedItemKey: null,
    selectedItemTitleSnapshot: null,
    isLocked: false,
    isEnabled: true,
    lockReason: null,
    orderStatus: null,
    wantsLunch: true,
    menuDescription: "",
    allergens: [],
    menuImages: [],
    reason: null,
    ...partial,
  };
}

function categoryCardButton(container: HTMLElement, label: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll<HTMLButtonElement>("button.week-category-card")].find((el) => {
    return el.querySelector(".week-category-card__label")?.textContent?.trim() === label;
  });
  if (!btn) {
    throw new Error(`category card button not found for label: ${label}`);
  }
  return btn;
}

async function renderWeekCategoryCards(options: {
  day: DayRow;
  storedChoice?: string | null;
  disabled?: boolean;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const onSelectCategory = vi.fn();
  const onSelectItem = vi.fn();

  await act(async () => {
    root.render(
      <WeekCategoryCards
        day={options.day}
        storedChoice={options.storedChoice ?? null}
        onSelectCategory={onSelectCategory}
        onSelectItem={onSelectItem}
        disabled={options.disabled}
      />,
    );
    await Promise.resolve();
  });

  return { container, root, onSelectCategory, onSelectItem };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("WeekCategoryCards — bestilt / pending / nøytral", () => {
  test("BESTILT: is-ordered, check-markør, pressed, bestilt i aria-label, ingen expand", async () => {
    const day = makeDay({
      orderStatus: "ACTIVE",
      selectedChoiceKey: "varmrett",
      categories: [
        makeCategory({ key: "varmrett", label: "Varmrett", category: "varmrett" }),
        makeCategory({ key: "salatboks", label: "Salatboks", category: "salat" }),
      ],
    });

    const { container } = await renderWeekCategoryCards({
      day,
      storedChoice: "varmrett",
    });

    const ordered = categoryCardButton(container, "Varmrett");
    expect(ordered.classList.contains("is-ordered")).toBe(true);
    expect(ordered.classList.contains("is-selected")).toBe(false);
    expect(ordered.getAttribute("aria-pressed")).toBe("true");
    expect(ordered.getAttribute("aria-label")).toMatch(/bestilt/i);
    expect(ordered.querySelector(".week-category-card__ordered-tag")).toBeNull();
    expect(container.querySelector(".ds-week-items-section--inline")).toBeNull();

    const other = categoryCardButton(container, "Salatboks");
    expect(other.classList.contains("is-ordered")).toBe(false);
    expect(other.getAttribute("aria-pressed")).toBe("false");
  });

  test("PENDING/valgt: is-selected, pressed, valgt i aria-label, expand i DOM", async () => {
    const day = makeDay({
      orderStatus: "ACTIVE",
      selectedChoiceKey: "paasmurt",
      categories: [
        makeCategory({ key: "paasmurt", label: "Påsmurt", category: "paasmurt" }),
        makeCategory({
          key: "salatboks",
          label: "Salatboks",
          category: "salat",
          items: [
            { key: "kylling", title: "Kylling", allergens: [], isVegetarian: false },
            { key: "tunfisk", title: "Tunfisk", allergens: [], isVegetarian: false },
          ],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({
      day,
      storedChoice: "salatboks",
    });

    const pending = categoryCardButton(container, "Salatboks");
    expect(pending.classList.contains("is-selected")).toBe(true);
    expect(pending.classList.contains("is-ordered")).toBe(false);
    expect(pending.getAttribute("aria-pressed")).toBe("true");
    expect(pending.getAttribute("aria-label")).toMatch(/valgt/i);
    expect(pending.querySelector(".week-category-card__ordered-tag")).toBeNull();

    const expand = container.querySelector(".ds-week-items-section--inline");
    expect(expand).not.toBeNull();
    expect(expand?.textContent).toMatch(/Velg variant for Salatboks/);
    expect(container.querySelectorAll('[role="radio"]').length).toBeGreaterThanOrEqual(2);

    const ordered = categoryCardButton(container, "Påsmurt");
    expect(ordered.classList.contains("is-ordered")).toBe(true);
    expect(ordered.classList.contains("is-selected")).toBe(false);
  });

  test("NØYTRAL: ingen is-ordered/is-selected, aria-pressed false, ingen expand", async () => {
    const day = makeDay({
      orderStatus: null,
      selectedChoiceKey: null,
      categories: [
        makeCategory({ key: "paasmurt", label: "Påsmurt" }),
        makeCategory({ key: "salatboks", label: "Salatboks" }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: null });

    for (const label of ["Påsmurt", "Salatboks"]) {
      const btn = categoryCardButton(container, label);
      expect(btn.classList.contains("is-ordered")).toBe(false);
      expect(btn.classList.contains("is-selected")).toBe(false);
      expect(btn.getAttribute("aria-pressed")).toBe("false");
      expect(btn.getAttribute("aria-label")).toBe(label);
    }
    expect(container.querySelector(".ds-week-items-section--inline")).toBeNull();
  });

  test("IKKE TILGJENGELIG: disabled, helper-tekst og title", async () => {
    const day = makeDay({
      categories: [
        makeCategory({ key: "paasmurt", label: "Påsmurt", available: false }),
        makeCategory({ key: "salatboks", label: "Salatboks" }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day });

    const unavailable = categoryCardButton(container, "Påsmurt");
    expect(unavailable.disabled).toBe(true);
    expect(unavailable.getAttribute("title")).toBe("Ikke tilgjengelig");
    expect(unavailable.textContent).toContain("Ikke tilgjengelig");
    expect(unavailable.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("WeekCategoryCards — kort og expand-panel", () => {
  test("kort viser kun label (ingen legacy title/description på kortet)", async () => {
    const day = makeDay({
      categories: [
        makeCategory({
          key: "varmrett",
          label: "Varmrett",
          title: "Skal ikke på kort",
          description: "Skal heller ikke på kort",
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "varmrett" });

    const card = categoryCardButton(container, "Varmrett");
    expect(card.querySelector(".week-category-card__label")?.textContent).toBe("Varmrett");
    expect(card.querySelector(".week-category-card__title")).toBeNull();
    expect(card.querySelector(".week-category-card__desc")).toBeNull();
  });

  test("pending + minst to varianter: radiogrid og Velg variant-tittel", async () => {
    const day = makeDay({
      orderStatus: "ACTIVE",
      selectedChoiceKey: "paasmurt",
      categories: [
        makeCategory({ key: "paasmurt", label: "Påsmurt" }),
        makeCategory({
          key: "salatboks",
          label: "Salatboks",
          items: [
            { key: "a", title: "Variant A", allergens: [], isVegetarian: false },
            { key: "b", title: "Variant B", allergens: [], isVegetarian: false },
          ],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "salatboks" });

    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Velg variant for Salatboks/);
    expect(container.querySelectorAll('[role="radio"]').length).toBe(2);
  });

  test("pending + én variant: info-kort, ikke radio", async () => {
    const day = makeDay({
      categories: [
        makeCategory({
          key: "sushi",
          label: "Sushi-pakke",
          category: "sushi",
          items: [{ key: "combo", title: "Dagens combo", description: "8 biter", allergens: [], isVegetarian: false }],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "sushi" });

    expect(container.querySelector(".ds-week-info-card__title")?.textContent).toContain("Dagens combo");
    expect(container.querySelector('[role="radio"]')).toBeNull();
  });

  test("pending + tom CMS-kategori med tittel: info-kort med meta", async () => {
    const day = makeDay({
      categories: [
        makeCategory({
          key: "thai",
          label: "Thai",
          category: "thai",
          title: "Thai wok",
          description: "Sterk suppe",
          allergens: ["peanotter"],
          items: [],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "thai" });

    expect(container.querySelector(".ds-week-info-card__title")?.textContent).toContain("Thai wok");
    expect(container.querySelector(".ds-week-info-card__desc")?.textContent).toContain("Sterk suppe");
    expect(container.querySelector(".ds-allergen-badge")).not.toBeNull();
  });

  test("pending + tom kategori uten tittel: placeholder status", async () => {
    const day = makeDay({
      categories: [makeCategory({ key: "pokebowl", label: "Pokebowl", category: "pokebowl", items: [] })],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "pokebowl" });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/Ingen meny lagt inn enda for Pokebowl/);
  });

  test("klikk på kategori kaller onSelectCategory", async () => {
    const day = makeDay({
      categories: [makeCategory({ key: "paasmurt", label: "Påsmurt" }), makeCategory({ key: "salatboks", label: "Salatboks" })],
    });

    const { container, onSelectCategory } = await renderWeekCategoryCards({ day });

    await act(async () => {
      categoryCardButton(container, "Salatboks").click();
      await Promise.resolve();
    });

    expect(onSelectCategory).toHaveBeenCalledTimes(1);
    expect(onSelectCategory).toHaveBeenCalledWith("salatboks");
  });

  test("tom allergenliste: viser ikke-bekreftet-notis, ikke allergenfri-tekst", async () => {
    const day = makeDay({
      categories: [
        makeCategory({
          key: "varmrett",
          label: "Varmrett",
          category: "varmrett",
          items: [{ key: "dagens", title: "Dagens rett", description: "Med potet", allergens: [], isVegetarian: false }],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "varmrett" });

    const notice = container.querySelector(".ds-allergen-unverified-notice");
    expect(notice?.textContent).toContain(ALLERGEN_UNVERIFIED_NOTICE);
    expect(container.textContent).not.toMatch(/Ingen oppregnede EU-allergener/i);
  });

  test("ikke-tom allergenliste: viser badges som før", async () => {
    const day = makeDay({
      categories: [
        makeCategory({
          key: "varmrett",
          label: "Varmrett",
          category: "varmrett",
          items: [{ key: "dagens", title: "Dagens rett", allergens: ["gluten", "melk"], isVegetarian: false }],
        }),
      ],
    });

    const { container } = await renderWeekCategoryCards({ day, storedChoice: "varmrett" });

    const badges = container.querySelectorAll(".ds-allergen-badge");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".ds-allergen-unverified-notice")).toBeNull();
    expect(container.textContent).not.toMatch(/Ingen oppregnede EU-allergener/i);
  });
});
