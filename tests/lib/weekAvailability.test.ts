import { describe, expect, test } from "vitest";

import { canSeeNextWeek, canSeeThisWeek, getVisibleWindow } from "@/lib/week/availability";

describe("week visibility (Oslo) — torsdag 14:00 / fredag 14:00", () => {
  test("torsdag 13:59: neste uke ikke åpnet", () => {
    const d = new Date("2026-03-26T13:59:00+01:00"); // tor CET
    expect(canSeeNextWeek(d)).toBe(false);
  });

  test("torsdag 14:00: neste uke åpnet", () => {
    const d = new Date("2026-03-26T14:00:00+01:00");
    expect(canSeeNextWeek(d)).toBe(true);
  });

  test("fredag 13:59: denne uke fortsatt synlig", () => {
    const d = new Date("2026-03-27T13:59:00+01:00");
    expect(canSeeThisWeek(d)).toBe(true);
  });

  test("fredag 14:00: denne uke skjult (inclusive >=)", () => {
    const d = new Date("2026-03-27T14:00:00+01:00");
    expect(canSeeThisWeek(d)).toBe(false);
  });

  test("mandag 09:00: current + next, ikke third", () => {
    const d = new Date("2026-03-23T09:00:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: false });
  });

  test("torsdag 13:59: current + next, ikke third", () => {
    const d = new Date("2026-03-26T13:59:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: false });
  });

  test("torsdag 14:00: current + next + third", () => {
    const d = new Date("2026-03-26T14:00:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: true });
  });

  test("torsdag 14:01: current + next + third", () => {
    const d = new Date("2026-03-26T14:01:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: true });
  });

  test("fredag 13:59: current + next + third", () => {
    const d = new Date("2026-03-27T13:59:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: true });
  });

  test("fredag 14:00: next + third, current skjult (inclusive >=)", () => {
    const d = new Date("2026-03-27T14:00:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: false, showNext: true, showThird: true });
  });

  test("lørdag 10:00: next + third", () => {
    const d = new Date("2026-03-28T10:00:00+01:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: false, showNext: true, showThird: true });
  });

  test("søndag 23:59: next + third", () => {
    const d = new Date("2026-03-29T23:59:00+02:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: false, showNext: true, showThird: true });
  });

  test("mandag 00:00: ISO-uka shifter, third er false", () => {
    const d = new Date("2026-03-30T00:00:00+02:00");
    expect(getVisibleWindow(d)).toEqual({ showCurrent: true, showNext: true, showThird: false });
  });
});
