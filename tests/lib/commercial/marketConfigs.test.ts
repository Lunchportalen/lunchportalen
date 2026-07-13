import { describe, expect, it } from "vitest";

import {
  MARKET_COMMERCIAL_CONFIG_LIST,
  MARKET_COMMERCIAL_CONFIGS,
  type MarketCode,
} from "@/lib/commercial/marketConfigs";

const ALL_MARKETS: MarketCode[] = ["NO", "SE", "DK", "FI", "DE", "FR", "ES", "GB"];

describe("inert market commercial config (ADR-017 R2)", () => {
  it("defines all expected market codes", () => {
    expect(Object.keys(MARKET_COMMERCIAL_CONFIGS).sort()).toEqual(ALL_MARKETS.sort());
    expect(MARKET_COMMERCIAL_CONFIG_LIST.length).toBe(ALL_MARKETS.length);
  });

  it("only NO is enabled and productionReady", () => {
    const enabled = MARKET_COMMERCIAL_CONFIG_LIST.filter((m) => m.enabled);
    const productionReady = MARKET_COMMERCIAL_CONFIG_LIST.filter((m) => m.productionReady);
    expect(enabled.map((m) => m.marketCode)).toEqual(["NO"]);
    expect(productionReady.map((m) => m.marketCode)).toEqual(["NO"]);
  });

  it("non-NO markets require manual validation and are not enabled", () => {
    for (const code of ALL_MARKETS) {
      if (code === "NO") continue;
      const m = MARKET_COMMERCIAL_CONFIGS[code];
      expect(m.requiresManualValidation).toBe(true);
      expect(m.enabled).toBe(false);
      expect(m.productionReady).toBe(false);
      expect(m.taxValidationStatus).toBe("requires_manual_validation");
    }
  });

  it("only NO uses norway_ehf_tripletex / tripletex_no integration profiles", () => {
    for (const m of MARKET_COMMERCIAL_CONFIG_LIST) {
      if (m.marketCode === "NO") {
        expect(m.eInvoicingProfile).toBe("norway_ehf_tripletex");
        expect(m.invoiceIntegration).toBe("tripletex_no");
      } else {
        expect(m.eInvoicingProfile).not.toBe("norway_ehf_tripletex");
        expect(m.invoiceIntegration).not.toBe("tripletex_no");
      }
    }
  });

  it("NO seed is marked seed_only with manual validation — not global VAT truth", () => {
    const no = MARKET_COMMERCIAL_CONFIGS.NO;
    expect(no.requiresManualValidation).toBe(true);
    expect(no.taxValidationStatus).toBe("seed_only");
    expect(no.notes).toMatch(/not global/i);
    expect(no.notes).toMatch(/15%/);
  });

  it("does not couple lp_locale to tax or currency in config shape", () => {
    for (const m of MARKET_COMMERCIAL_CONFIG_LIST) {
      const serialized = JSON.stringify(m);
      expect(serialized).not.toContain("lp_locale");
      expect(m.defaultUiLocale).toBeTruthy();
      // defaultUiLocale is display hint only — separate fields own commercial rules
      expect(m.defaultCurrency).toBeTruthy();
      expect(m.taxLabel).toBeTruthy();
    }
  });
});
