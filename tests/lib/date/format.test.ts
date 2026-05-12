import { describe, expect, it } from "vitest";

import {
  formatDateNO,
  formatDateTimeNO,
  formatDateTimeSecondsNO,
  formatMenuDateNO,
} from "@/lib/date/format";

describe("date formatting", () => {
  describe("formatDateNO", () => {
    it.each([
      ["2026-05-11", "11.05.2026"],
      ["2026-01-01", "01.01.2026"],
      ["2026-12-31", "31.12.2026"],
      ["", ""],
      [null, ""],
      [undefined, ""],
      ["ugyldig", ""],
      [new Date(2026, 4, 11), "11.05.2026"],
      ["2026-05-11T08:30:00Z", "11.05.2026"],
    ])("formats %s as %s", (value, expected) => {
      expect(formatDateNO(value)).toBe(expected);
    });
  });

  describe("formatDateTimeNO", () => {
    it.each([
      ["2026-05-11T14:30:00+02:00", "11.05.2026 14:30"],
      ["2026-05-11T12:30:00Z", "11.05.2026 14:30"],
      ["", ""],
      [null, ""],
    ])("formats %s as %s", (value, expected) => {
      expect(formatDateTimeNO(value)).toBe(expected);
    });
  });

  describe("formatDateTimeSecondsNO", () => {
    it("formats seconds when they are needed", () => {
      expect(formatDateTimeSecondsNO("2026-05-11T14:30:45+02:00")).toBe(
        "11.05.2026 14:30:45",
      );
    });
  });

  describe("formatMenuDateNO", () => {
    it.each([
      ["2026-05-11", "Man 11.05.2026"],
      ["2026-05-12", "Tir 12.05.2026"],
      ["2026-05-13", "Ons 13.05.2026"],
      ["2026-05-14", "Tor 14.05.2026"],
      ["2026-05-15", "Fre 15.05.2026"],
      ["2026-05-16", "Lør 16.05.2026"],
      ["2026-05-17", "Søn 17.05.2026"],
      ["", ""],
      [null, ""],
    ])("formats %s as %s", (value, expected) => {
      expect(formatMenuDateNO(value)).toBe(expected);
    });
  });
});
