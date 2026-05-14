import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { buildOrderWriteBody, tierPillClass } from "@/app/(app)/week/EmployeeWeekClient";

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
    expect(css).toContain("font-size: 11px");
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
