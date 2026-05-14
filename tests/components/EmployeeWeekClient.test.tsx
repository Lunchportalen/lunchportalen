import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  buildOrderWriteBody,
  isCalendarUpcoming,
  statusPresentation,
  tierPillClass,
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

describe("statusPresentation", () => {
  test("Bestilt → grønn pill", () => {
    const p = statusPresentation(dayFixture({ orderStatus: "ACTIVE", isEnabled: true, isLocked: false }));
    expect(p.label).toBe("Bestilt");
    expect(p.className).toContain("ds-green");
    expect(p.className).toContain("text-white");
  });

  test("Ikke bestilt → gul accent-pill og normalisert label", () => {
    const p = statusPresentation(
      dayFixture({ orderStatus: null, isEnabled: true, isLocked: false, lockReason: null }),
    );
    expect(p.label).toBe("Ikke bestilt");
    expect(p.className).toContain("ds-accent");
    expect(p.className).toContain("ds-text");
  });

  test("Avbestilt → transparent/outline", () => {
    const p = statusPresentation(dayFixture({ orderStatus: "CANCELLED", isEnabled: true, isLocked: false }));
    expect(p.label).toBe("Avbestilt");
    expect(p.className).toContain("bg-transparent");
    expect(p.className).toContain("ring-neutral-300");
  });

  test("Frist passert → nøytral grå", () => {
    const p = statusPresentation(
      dayFixture({ orderStatus: null, isEnabled: true, isLocked: true, lockReason: "CUTOFF" }),
    );
    expect(p.label).toBe("Frist passert");
    expect(p.className).toContain("bg-neutral-100");
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
