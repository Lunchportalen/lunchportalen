import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  buildOrderWriteBody,
  isCalendarUpcoming,
  orderedMealDisplayLine,
  statusPresentation,
  tierPillClass,
  weekCalendarDayPillClassNames,
  type DayRow,
} from "@/app/(app)/week/EmployeeWeekClient";

const CLIENT_PATH = join(process.cwd(), "app", "(app)", "week", "EmployeeWeekClient.tsx");
const CSS_PATH = join(process.cwd(), "app", "styles", "employee-week.css");

describe("EmployeeWeekClient order write migration", () => {
  test("sender SET-body til /api/orders med choice_key og valgfri itemKey", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const body = buildOrderWriteBody("2026-05-18", true, "varmmat");

    expect(source).toContain('fetch("/api/orders"');
    expect(source).not.toContain("/api/order/set-day");
    expect(body).toEqual({ date: "2026-05-18", action: "set", choice_key: "varmmat" });
    expect(buildOrderWriteBody("2026-05-18", true, "salatboks", "kylling")).toEqual({
      date: "2026-05-18",
      action: "set",
      choice_key: "salatboks",
      itemKey: "kylling",
    });
    expect(buildOrderWriteBody("2026-05-18", true, null, "kylling")).toEqual({
      date: "2026-05-18",
      action: "set",
    });
  });

  test("sender CANCEL-body til /api/orders uten choice_key", () => {
    const body = buildOrderWriteBody("2026-05-18", false, "varmmat");

    expect(body).toEqual({ date: "2026-05-18", action: "cancel" });
    expect(Object.prototype.hasOwnProperty.call(body, "choice_key")).toBe(false);
  });

  test("håndterer nye 422-koder uten å krasje", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");

    expect(source).toContain('apiError.code === "NO_TIER_FOR_DAY"');
    expect(source).toContain("Denne dagen er ikke tilgjengelig");
    expect(source).toContain('apiError.code === "CHOICE_REQUIRED"');
    expect(source).toContain('apiError.code === "INVALID_CHOICE"');
    expect(source).toContain('apiError.code === "INVALID_DAY"');
    expect(source).toContain("Ugyldig dato");
  });
});

describe("weekCalendarDayPillClassNames (/week kalender-pill)", () => {
  test("ikke valgt, ikke i dag → idle uten --today", () => {
    expect(weekCalendarDayPillClassNames(false, false)).toBe(
      "ds-week-calendar-day-pill ds-week-calendar-day-pill--idle",
    );
  });

  test("ikke valgt, i dag → idle + --today", () => {
    expect(weekCalendarDayPillClassNames(false, true)).toBe(
      "ds-week-calendar-day-pill ds-week-calendar-day-pill--idle ds-week-calendar-day-pill--today",
    );
  });

  test("valgt, ikke i dag → selected uten --today", () => {
    expect(weekCalendarDayPillClassNames(true, false)).toBe(
      "ds-week-calendar-day-pill ds-week-calendar-day-pill--selected",
    );
  });

  test("valgt og i dag → selected + --today (begge modifikatorer)", () => {
    expect(weekCalendarDayPillClassNames(true, true)).toBe(
      "ds-week-calendar-day-pill ds-week-calendar-day-pill--selected ds-week-calendar-day-pill--today",
    );
  });

  test("kilde: knapp bruker data-lp-date, aria-current og weekCalendarDayPillClassNames(active, isToday)", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("data-lp-date={day.date}");
    expect(source).toContain('aria-current={isToday ? "date" : undefined}');
    expect(source).toContain("const isToday = Boolean(serverOsloDate && day.date === serverOsloDate);");
    expect(source).toContain("className={weekCalendarDayPillClassNames(active, isToday)}");
  });

  test("CSS: dagens dato outline nøytral (gull reservert til primær-CTA)", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(".ds-week-calendar-day-pill--today");
    expect(css).toContain("outline: 2px solid var(--ds-line-strong)");
  });
});

describe("EmployeeWeekClient tier pill", () => {
  test("viser tier-pill for BASIS og LUXUS", () => {
    expect(tierPillClass("BASIS")).toBe("ds-tier-pill is-basis");
    expect(tierPillClass("LUXUS")).toBe("ds-tier-pill is-luxus");
  });

  test("viser tier-pill for ENTERPRISE", () => {
    expect(tierPillClass("ENTERPRISE")).toBe("ds-tier-pill is-enterprise");
  });

  test("CSS inneholder mobile-safe tier-pill-varianter", () => {
    const css = readFileSync(CSS_PATH, "utf-8");

    expect(css).toContain(".ds-tier-pill");
    expect(css).toContain("font-size: 10px");
    expect(css).toContain(".ds-tier-pill.is-basis");
    expect(css).toContain(".ds-tier-pill.is-luxus");
    expect(css).toContain(".ds-tier-pill.is-enterprise");
  });
});

describe("EmployeeWeekClient chip surface (STEG 5.5)", () => {
  test("CSS: --chip read-only pill uten states eller transition", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    const chipBlock = css.match(/\.ds-week-surface--chip\s*\{[^}]+\}/)?.[0] ?? "";
    expect(css).toContain(".ds-week-surface--chip {");
    expect(chipBlock).toMatch(/border-radius:\s*var\(--ds-radius-pill\)/);
    expect(chipBlock).toMatch(/background:\s*var\(--ds-bg-soft\)/);
    expect(chipBlock).toMatch(/color:\s*var\(--ds-text-soft\)/);
    expect(chipBlock).toMatch(/font-size:\s*var\(--ds-body-sm\)/);
    expect(chipBlock).toMatch(/box-shadow:\s*none/);
    expect(chipBlock).toMatch(/transition:\s*none/);
    expect(css).not.toMatch(/\.ds-week-surface--chip:hover/);
    expect(css).not.toMatch(/\.ds-week-surface--chip:focus/);
    expect(css).not.toMatch(/\.ds-week-surface--chip\[aria-pressed/);
    expect(css).not.toMatch(/\.ds-week-surface--chip\[disabled/);
  });

  test("chip tekst på soft bg oppfyller WCAG AA kontrast (4.5:1)", () => {
    function relLuminance(hex: string) {
      const n = parseInt(hex.slice(1), 16);
      const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    }
    const fg = relLuminance("#5f5f5f");
    const bg = relLuminance("#eee9df");
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("EmployeeWeekClient motion surface (STEG 6)", () => {
  test("CSS: row press + reduce gate; calendar bruker --ds-ease 180ms", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.ds-week-surface--row[\s\S]*transition:\s*transform 180ms var\(--ds-ease\)/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-week-surface--row[\s\S]*transition:\s*none/,
    );
    expect(css).toContain("html.lp-week-visual-regression .ds-week-surface--row");
    expect(css).toMatch(/transform 180ms var\(--ds-ease\)/);
  });

  test("kilde: row uten Tailwind active:scale uten motion-safe", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("ds-week-surface--row flex min-h-day");
    expect(source).not.toMatch(/ds-week-surface--row[\s\S]*active:scale-\[0\.99\]/);
  });
});

describe("EmployeeWeekClient NO_TIER_FOR_DAY UI", () => {
  test("viser fail-closed tekst og skjuler kategori-knapper for dager uten tier", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");

    expect(source).toContain('day.reason === "NO_TIER_FOR_DAY"');
    expect(source).toContain("Denne dagen er ikke tilgjengelig for bestilling.");
    expect(source).toContain("Kontakt firmaadmin.");
    expect(source).toContain("if (isNoTierForDay(day)) return null;");
  });
});

function dayFixture(partial: Partial<DayRow>): DayRow {
  return {
    date: "2026-05-14",
    weekday: "Torsdag",
    tier: "BASIS",
    planTier: "BASIS",
    allowedChoices: [],
    categories: [],
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

describe("isCalendarUpcoming", () => {
  test("dato før osloToday → false", () => {
    expect(isCalendarUpcoming(dayFixture({ date: "2026-05-13" }), "2026-05-14")).toBe(false);
  });

  test("dato etter osloToday → true", () => {
    expect(isCalendarUpcoming(dayFixture({ date: "2026-05-15" }), "2026-05-14")).toBe(true);
  });

  test("i dag med CUTOFF-lås → false", () => {
    expect(
      isCalendarUpcoming(
        dayFixture({ date: "2026-05-14", isLocked: true, lockReason: "CUTOFF" }),
        "2026-05-14",
      ),
    ).toBe(false);
  });

  test("i dag uten cutoff-lås → true", () => {
    expect(isCalendarUpcoming(dayFixture({ date: "2026-05-14", isLocked: false, lockReason: null }), "2026-05-14")).toBe(
      true,
    );
  });

  test("osloToday null → true (fail-open filter)", () => {
    expect(isCalendarUpcoming(dayFixture({ date: "2026-05-01" }), null)).toBe(true);
  });
});

describe("orderedMealDisplayLine", () => {
  test("ACTIVE + CMS item resolves «Kategori – variant» (Melhus 02.06 shape)", () => {
    const line = orderedMealDisplayLine(
      dayFixture({
        orderStatus: "ACTIVE",
        selectedChoiceKey: "paasmurt",
        selectedItemKey: "ost-skinke",
        categories: [
          {
            key: "paasmurt",
            category: "paasmurt",
            label: "Påsmurt",
            title: null,
            description: null,
            allergens: [],
            available: true,
            items: [{ key: "ost-skinke", title: "Ost & skinke", allergens: [], isVegetarian: false }],
          },
        ],
        allowedChoices: [{ key: "paasmurt", label: "Påsmurt" }],
      }),
    );
    expect(line).toBe("Påsmurt – Ost & skinke");
  });
});

describe("statusPresentation", () => {
  test("Bestilt → grønn pill", () => {
    const p = statusPresentation(dayFixture({ orderStatus: "ACTIVE", isEnabled: true, isLocked: false }));
    expect(p.label).toBe("Bestilt");
    expect(p.className).toBe("ds-week-status-pill is-ordered");
  });

  test("Ikke bestilt → nøytral grå pill (tilstand, ikke merkeaksent)", () => {
    const p = statusPresentation(
      dayFixture({ orderStatus: null, isEnabled: true, isLocked: false, lockReason: null }),
    );
    expect(p.label).toBe("Ikke bestilt");
    expect(p.className).toBe("ds-week-status-pill is-open");
  });

  test("Avbestilt → transparent/outline", () => {
    const p = statusPresentation(dayFixture({ orderStatus: "CANCELLED", isEnabled: true, isLocked: false }));
    expect(p.label).toBe("Avbestilt");
    expect(p.className).toBe("ds-week-status-pill is-cancelled");
  });

  test("Frist passert → nøytral grå", () => {
    const p = statusPresentation(
      dayFixture({ orderStatus: null, isEnabled: true, isLocked: true, lockReason: "CUTOFF" }),
    );
    expect(p.label).toBe("Frist passert");
    expect(p.className).toBe("ds-week-status-pill is-locked");
  });

  test("CSS: ds-week-status-pill struktur + farge-modifiers", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(".ds-week-status-pill {");
    expect(css).toMatch(/\.ds-week-status-pill[\s\S]*display:\s*inline-flex/);
    expect(css).toMatch(/\.ds-week-status-pill[\s\S]*box-shadow:\s*0 0 0 1px var\(--ds-line\)/);
    expect(css).toContain(".ds-week-status-pill.is-ordered");
    expect(css).toMatch(/\.ds-week-status-pill\.is-ordered[\s\S]*background:\s*var\(--ds-status-success\)/);
    expect(css).toContain(".ds-week-status-pill.is-open");
    expect(css).toMatch(/\.ds-week-status-pill\.is-open[\s\S]*var\(--ds-status-neutral-bg\)/);
    expect(css).toContain(".ds-week-status-pill.is-cancelled");
    expect(css).toContain(".ds-week-status-pill.is-locked");
    expect(css).toContain(".ds-week-status-pill.is-cutoff");
    expect(css).toContain(".ds-week-status-pill.is-preview");
  });

  test("Ikke bestilt grå oppfyller WCAG AA kontrast (4.5:1)", () => {
    function relLuminance(hex: string) {
      const n = parseInt(hex.slice(1), 16);
      const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    }
    const fg = relLuminance("#404040");
    const bg = relLuminance("#f5f5f5");
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("EmployeeWeekClient ordered vs insight styling", () => {
  test("kilde: is-ordered på kategori-kort, ds-week-insight-pill for anbefaling", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(source).toContain("is-ordered");
    expect(source).toContain("ds-week-insight-pill");
    expect(source).toContain("ds-ordered-meal-line");
    expect(source).toContain("Bestilt:");
    expect(css).toContain(".week-category-card.is-ordered");
    expect(css).toContain(".ds-week-insight-pill");
    expect(css).not.toMatch(/\.week-category-card\.is-ordered\s*\{[^}]*var\(--ds-accent\)/);
  });

  test("ACTIVE: kategori-kort ikke låst; SET-bytte via applyActiveOrderChange", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).not.toContain("cardsLocked");
    expect(source).toContain("applyActiveOrderChange");
    expect(source).toContain("postSetDayInner(date, true, selection)");
    expect(source).toMatch(/day\.orderStatus === "ACTIVE"\) return prev/);
  });

  test("CSS: slot focus-visible accent ring; ordered category uses --slot not green card frame", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).not.toMatch(/^\s*ring\s*:/m);
    expect(css).toContain(".ds-week-surface--slot:focus-visible");
    expect(css).toMatch(/\.ds-week-surface--slot:focus-visible[\s\S]*outline:\s*2px solid var\(--ds-accent\)/);
    expect(css).toMatch(/outline-offset:\s*3px/);
    expect(css).toContain(".ds-week-surface--slot[aria-pressed=\"true\"]");
    expect(css).not.toMatch(/\.week-category-card\.is-ordered::before/);
  });

  test("gull reservert til PRIMARY_CTA; dag-valg og insight uten accent", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(source).toContain("from-accent");
    expect(source).not.toContain("ring-accent/");
    expect(css).not.toMatch(/\.ds-week-calendar-day-pill--selected[\s\S]*#f5c518/);
    expect(css).toMatch(/\.ds-week-insight-pill[\s\S]*var\(--ds-status-neutral-bg\)/);
  });
});

describe("EmployeeWeekClient in-card CTA (WeekDayCardMobile)", () => {
  test("WeekDayCardMobile har in-card «Bestill lunsj»; ingen sticky bunn-CTA", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const mobileStart = source.indexOf("const WeekDayCardMobile = memo(");
    const exportDefault = source.indexOf("export default function EmployeeWeekClient");
    expect(mobileStart).toBeGreaterThan(-1);
    expect(exportDefault).toBeGreaterThan(mobileStart);
    const mobileBlock = source.slice(mobileStart, exportDefault);
    expect(mobileBlock).toContain('"Bestill lunsj"');

    expect(source).not.toContain("ds-week-sticky-safe-bottom");
    expect(source).not.toContain("stickyCtaForDay");
  });
});

describe("EmployeeWeekClient inline allergenkort", () => {
  test("monterer WeekAllergenProfileCard rett under intro-header når ikke readOnlyPreview", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("WeekAllergenProfileCard");
    expect(source).toMatch(/<\/header>[\s\S]*!readOnlyPreview \? <WeekAllergenProfileCard \/>/);
  });
});
