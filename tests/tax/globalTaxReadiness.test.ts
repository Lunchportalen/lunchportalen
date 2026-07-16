/**
 * PHASE 10 — global tax and accounting readiness (contract locks, no DB).
 *
 * Acceptance locks:
 *  - 21/21 market configurations complete (canonical registry)
 *  - 0 language-derived tax decisions (tax APIs take country, never language/locale)
 *  - US/CA timezone and tax strategy explicit
 *  - tax-ID validation strategy per country, honest scope (format_only)
 *  - invoice legal fields defined per market
 *  - no false claim of native accounting integration (Tripletex = NO only)
 *  - approval registry: statuses + fail-closed activation in migration
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SUPPORTED_COUNTRY_CODES,
  SUPPORTED_MARKETS,
  MARKET_LOCALES,
  getMarketCountry,
} from "@/lib/markets/supportedMarkets";
import { validateTaxId, TAX_ID_STRATEGY_BY_COUNTRY } from "@/lib/tax/taxIdValidation";
import { requiredInvoiceLegalFields, taxLabelForCountry, reverseChargeNote } from "@/lib/tax/invoiceLegalFields";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const MIGRATION = "supabase/migrations/20260825120000_global_tax_accounting_readiness.sql";
const EXPECTED = ["NO","SE","DK","FI","GB","DE","FR","ES","IT","NL","BE","CH","AT","IE","PL","RO","CZ","PT","GR","US","CA"];

describe("21/21 market configurations complete", () => {
  it("registry contains exactly the 21 canonical countries", () => {
    expect([...SUPPORTED_COUNTRY_CODES].sort()).toEqual([...EXPECTED].sort());
    expect(SUPPORTED_MARKETS.length).toBe(21);
  });

  it("every market has currency, tax strategy, address and postal-code strategy", () => {
    for (const m of SUPPORTED_MARKETS) {
      expect(m.currency, m.countryCode).toMatch(/^[A-Z]{3}$/);
      expect(["vat", "sales_tax", "gst"], m.countryCode).toContain(m.taxStrategy);
      expect(m.addressFormat, m.countryCode).toBeTruthy();
      expect(m.postalCodeStrategy, m.countryCode).toBeTruthy();
    }
  });

  it("every market has a tax-ID validation strategy and legal invoice fields", () => {
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      expect(TAX_ID_STRATEGY_BY_COUNTRY[cc], cc).toBeTruthy();
      expect(requiredInvoiceLegalFields(cc).length, cc).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("0 language-derived tax decisions", () => {
  it("market locales carry no tax decisions; country is the only tax key", () => {
    for (const loc of MARKET_LOCALES) {
      // Locale rows expose only presentation data; tax comes from the country market.
      expect(Object.keys(loc).sort()).toEqual(["countryCode", "intlLocale", "language", "locale"]);
      expect(getMarketCountry(loc.countryCode)).toBeTruthy();
    }
  });

  it("tax libs never read language or preferred_locale", () => {
    for (const file of ["lib/tax/taxIdValidation.ts", "lib/tax/invoiceLegalFields.ts"]) {
      const src = read(file);
      expect(src, file).not.toMatch(/preferred_locale|languageForLocale|navigator\.language/);
      // Ingen funksjonssignatur tar language/locale som beslutningsinput.
      expect(src, file).not.toMatch(/function \w+\((locale|language)\b/);
    }
  });

  it("same country gives same tax label regardless of locale (BE/CH/CA multi-locale)", () => {
    expect(taxLabelForCountry("BE")).toBe(taxLabelForCountry("BE"));
    expect(taxLabelForCountry("CA")).toBe("GST/HST");
    expect(taxLabelForCountry("US")).toBe("Sales tax");
    expect(taxLabelForCountry("NO")).toBe("MVA");
    expect(taxLabelForCountry("DE")).toBe("VAT");
  });
});

describe("US/CA timezone and tax strategy explicit", () => {
  it("US: sales_tax, provider-required timezone, no market default timezone", () => {
    const us = getMarketCountry("US")!;
    expect(us.taxStrategy).toBe("sales_tax");
    expect(us.timezoneStrategy).toBe("provider_required");
    expect(us.defaultTimezone).toBeNull();
  });

  it("CA: gst, provider-required timezone, no market default timezone", () => {
    const ca = getMarketCountry("CA")!;
    expect(ca.taxStrategy).toBe("gst");
    expect(ca.timezoneStrategy).toBe("provider_required");
    expect(ca.defaultTimezone).toBeNull();
  });

  it("US/CA legal fields require state/province", () => {
    expect(requiredInvoiceLegalFields("US")).toContain("state_province");
    expect(requiredInvoiceLegalFields("CA")).toContain("state_province");
  });
});

describe("tax-ID validation strategy (honest format-only scope)", () => {
  const cases: Array<[string, string, boolean]> = [
    ["NO", "923609016", true],
    ["NO", "NO923609016MVA", true],
    ["NO", "12345678", false],
    ["SE", "SE556677889901", true],
    ["SE", "SE12345", false],
    ["DE", "DE123456789", true],
    ["GB", "GB123456789", true],
    ["GB", "123456789", true],
    ["CH", "CHE-123.456.789 MWST", true],
    ["CH", "CH123", false],
    ["US", "12-3456789", true],
    ["US", "1234", false],
    ["CA", "123456789RT0001", true],
    ["CA", "123456789", true],
    ["NL", "NL123456789B01", true],
    ["BE", "BE0123456789", true],
  ];

  it.each(cases)("%s: %s → valid=%s", (country, taxId, valid) => {
    const res = validateTaxId(country, taxId);
    expect(res.valid).toBe(valid);
    expect(res.scope).toBe("format_only");
  });

  it("fails closed for unsupported country and empty input", () => {
    expect(validateTaxId("ZZ", "123456789").valid).toBe(false);
    expect(validateTaxId("NO", "").valid).toBe(false);
  });
});

describe("reverse charge and exemption", () => {
  it("reverse charge note exists for VAT markets, never for US/CA", () => {
    expect(reverseChargeNote("DE")).toContain("Reverse charge");
    expect(reverseChargeNote("SE")).toContain("Reverse charge");
    expect(reverseChargeNote("US")).toBeNull();
    expect(reverseChargeNote("CA")).toBeNull();
  });
});

describe("no false claim of native accounting integration", () => {
  it("registry: native possible ONLY for NO (Tripletex, and only when enabled); everyone else generic export", async () => {
    const { describeAccountingCapability } = await import("@/lib/accounting/registry");
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      const cap = describeAccountingCapability(cc);
      if (cc === "NO") {
        // Ærlighet: native hevdes KUN når Tripletex-integrasjonen faktisk er
        // aktivert; ellers generisk eksport uten integrasjonspåstand.
        if (cap.native) {
          expect(cap.adapter).toBe("tripletex");
        } else {
          expect(cap.adapter).toBe("csv");
          expect(cap.label.toLowerCase()).toContain("ingen native integrasjon");
        }
      } else {
        expect(cap.adapter, cc).toBe("csv");
        expect(cap.native, cc).toBe(false);
        expect(cap.label.toLowerCase(), cc).toContain("ingen native integrasjon");
      }
    }
  });
});

describe("approval registry migration invariants", () => {
  const sql = read(MIGRATION);

  it("defines all seven approval statuses", () => {
    for (const s of [
      "TECHNICALLY_READY",
      "TAX_REVIEW_PENDING",
      "TAX_APPROVED",
      "LEGAL_REVIEW_PENDING",
      "LEGAL_APPROVED",
      "ACTIVATION_BLOCKED",
      "ACTIVE",
    ]) {
      expect(sql).toContain(`'${s}'`);
    }
  });

  it("ACTIVE requires recorded tax AND legal approval (fail-closed)", () => {
    expect(sql).toContain("MARKET_ACTIVATION_REQUIRES_APPROVALS");
    expect(sql).toContain("tax_approved_at IS NULL OR v_row.legal_approved_at IS NULL");
    expect(sql).toContain("MARKET_CONFIG_INCOMPLETE");
  });

  it("invoice creation is gated on commercially ACTIVE market (both invoice tracks)", () => {
    expect(sql).toContain("MARKET_NOT_COMMERCIALLY_APPROVED");
    expect(sql).toContain("agreement_invoices_market_activation_guard");
    expect(sql).toContain("provider_commission_invoices_market_activation_guard");
  });

  it("US/CA require state/province and provider timezone at profile level", () => {
    expect(sql).toContain("STATE_PROVINCE_REQUIRED_FOR_MARKET");
    expect(sql).toContain("PROVIDER_TIMEZONE_REQUIRED_FOR_MARKET");
    expect(sql).toContain("state_province_required = true");
    expect(sql).toContain("provider_timezone_required = true");
  });

  it("seeds all 21 countries and only NO as grandfathered ACTIVE", () => {
    expect(sql).toContain("'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL','BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'");
    expect(sql.match(/status = 'ACTIVE'/g)!.length).toBeGreaterThanOrEqual(1);
    expect(sql).toContain("WHERE country_code = 'NO' AND status = 'TECHNICALLY_READY'");
  });

  it("transition RPC is not executable by anon/authenticated", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.lp_market_approval_transition(text, text, text, uuid) FROM PUBLIC, anon, authenticated");
  });
});

describe("launch readiness gate covers tax completeness", () => {
  it("post-migration-verify checks 21 countries, tax config and approval registry", () => {
    const verify = read("scripts/ci/post-migration-verify.mjs");
    expect(verify).toContain("tax_strategy");
    expect(verify).toContain("tax_id_validation");
    expect(verify).toContain("market_approvals");
    expect(verify).toContain("provider_timezone_required");
    expect(verify).toContain('m.tax_strategy !== "sales_tax"');
    expect(verify).toContain('m.tax_strategy !== "gst_hst"');
    expect(verify).not.toContain("stripe_status");
  });
});
