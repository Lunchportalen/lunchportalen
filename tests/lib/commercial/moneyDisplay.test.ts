import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatMoneyDisplay,
  formatMoneyWithTaxBasis,
  formatTaxBasisLabel,
} from "@/lib/commercial/moneyDisplay";

const ROOT = path.resolve(import.meta.dirname, "../../..");

describe("moneyDisplay (ADR-017 R3A — inert NO foundation)", () => {
  describe("NOK / nb-NO", () => {
    it("formats 9000 minor as NOK with nb-NO Intl", () => {
      const expected = new Intl.NumberFormat("nb-NO", {
        style: "currency",
        currency: "NOK",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(90);

      const result = formatMoneyDisplay({
        amountMinor: 9000,
        currency: "NOK",
        locale: "nb-NO",
      });

      expect(result.formatted).toBe(expected);
      expect(result.amountMajor).toBe(90);
      expect(result.currency).toBe("NOK");
    });

    it("ex_tax label is eks. mva", () => {
      expect(formatTaxBasisLabel("ex_tax", "nb-NO")).toBe("eks. mva");
    });

    it("inc_tax label is inkl. mva", () => {
      expect(formatTaxBasisLabel("inc_tax", "nb-NO")).toBe("inkl. mva");
    });

    it("unknown tax basis yields empty label (no tax claim)", () => {
      expect(formatTaxBasisLabel("unknown", "nb-NO")).toBe("");
    });

    it("formatMoneyWithTaxBasis appends eks. mva with custom taxLabel", () => {
      const money = formatMoneyDisplay({
        amountMinor: 9000,
        currency: "NOK",
        locale: "nb-NO",
      }).formatted;

      expect(
        formatMoneyWithTaxBasis({
          amountMinor: 9000,
          currency: "NOK",
          locale: "nb-NO",
          taxBasis: "ex_tax",
          taxLabel: "mva",
        }),
      ).toBe(`${money} eks. mva`);
    });
  });

  describe("NOK / en-GB", () => {
    it("uses English number format but keeps NOK currency", () => {
      const expected = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "NOK",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(90);

      const result = formatMoneyDisplay({
        amountMinor: 9000,
        currency: "NOK",
        locale: "en-GB",
      });

      expect(result.formatted).toBe(expected);
      expect(result.currency).toBe("NOK");
    });

    it("ex_tax label is ex VAT", () => {
      expect(formatTaxBasisLabel("ex_tax", "en-GB")).toBe("ex VAT");
    });

    it("formatMoneyWithTaxBasis uses English tax fragment", () => {
      const money = formatMoneyDisplay({
        amountMinor: 9000,
        currency: "NOK",
        locale: "en-GB",
      }).formatted;

      expect(
        formatMoneyWithTaxBasis({
          amountMinor: 9000,
          currency: "NOK",
          locale: "en-GB",
          taxBasis: "ex_tax",
        }),
      ).toBe(`${money} ex VAT`);
    });
  });

  describe("EUR technical formatting (not EU market enablement)", () => {
    it("can format EUR amounts without implying active EU market", () => {
      const result = formatMoneyDisplay({
        amountMinor: 1050,
        currency: "EUR",
        locale: "de-DE",
      });

      expect(result.currency).toBe("EUR");
      expect(result.formatted).toContain("10");
      expect(result.formatted).toMatch(/€|EUR/);
    });
  });

  describe("unknown tax basis on combined display", () => {
    it("does not append tax suffix for unknown basis", () => {
      const money = formatMoneyDisplay({
        amountMinor: 9000,
        currency: "NOK",
        locale: "nb-NO",
      }).formatted;

      expect(
        formatMoneyWithTaxBasis({
          amountMinor: 9000,
          currency: "NOK",
          locale: "nb-NO",
          taxBasis: "unknown",
        }),
      ).toBe(money);
    });
  });

  describe("no runtime coupling", () => {
    it("has no imports from market config, next-intl, or supabase", () => {
      const src = readFileSync(path.join(ROOT, "lib/commercial/moneyDisplay.ts"), "utf8");
      const importLines = src
        .split(/\r?\n/)
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");

      expect(importLines).toBe("");
      expect(src).not.toMatch(/process\.env/);
    });

    it("has no VAT rate, commission, or formatNok identifiers in code", () => {
      const src = readFileSync(path.join(ROOT, "lib/commercial/moneyDisplay.ts"), "utf8");
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*/g, "")
        .replace(/\/\/.*$/gm, "");

      expect(codeOnly).not.toMatch(/VAT_RATE/);
      expect(codeOnly).not.toMatch(/0\.15/);
      expect(codeOnly).not.toMatch(/LUNCHPORTALEN_COMMISSION/);
      expect(codeOnly).not.toMatch(/formatNok/);
    });
  });
});
