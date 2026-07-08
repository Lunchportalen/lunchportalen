import { describe, expect, it } from "vitest";

import {
  getTierDisplayLabel,
  getTierDisplayLabelSafe,
  getTierDisplayWithCode,
  isTierCode,
  type TierCode,
} from "@/lib/tiers/displayLabels";

const EXPECTED: Record<string, Record<TierCode, string>> = {
  "nb-NO": { BASIS: "Basis", LUXUS: "Luksus", ENTERPRISE: "Enterprise" },
  "sv-SE": { BASIS: "Bas", LUXUS: "Lyx", ENTERPRISE: "Enterprise" },
  "da-DK": { BASIS: "Basis", LUXUS: "Luksus", ENTERPRISE: "Enterprise" },
  "fi-FI": { BASIS: "Perus", LUXUS: "Luksus", ENTERPRISE: "Enterprise" },
  "en-GB": { BASIS: "Basic", LUXUS: "Premium", ENTERPRISE: "Enterprise" },
  "de-DE": { BASIS: "Basis", LUXUS: "Luxus", ENTERPRISE: "Enterprise" },
  "fr-FR": { BASIS: "Essentiel", LUXUS: "Premium", ENTERPRISE: "Enterprise" },
  "es-ES": { BASIS: "Básico", LUXUS: "Premium", ENTERPRISE: "Enterprise" },
  "it-IT": { BASIS: "Base", LUXUS: "Premium", ENTERPRISE: "Enterprise" },
};

describe("tier display labels", () => {
  it("returns locale-aware labels for all supported locales and tier codes", () => {
    for (const [locale, labels] of Object.entries(EXPECTED)) {
      expect(getTierDisplayLabel("BASIS", locale)).toBe(labels.BASIS);
      expect(getTierDisplayLabel("LUXUS", locale)).toBe(labels.LUXUS);
      expect(getTierDisplayLabel("ENTERPRISE", locale)).toBe(labels.ENTERPRISE);
    }
  });

  it("supports short UI locale aliases", () => {
    expect(getTierDisplayLabel("LUXUS", "nb")).toBe("Luksus");
    expect(getTierDisplayLabel("BASIS", "es")).toBe("Básico");
    expect(getTierDisplayLabel("LUXUS", "it")).toBe("Premium");
  });

  it("falls back to en-GB for unknown locales", () => {
    expect(getTierDisplayLabel("BASIS", "unknown")).toBe("Basic");
    expect(getTierDisplayLabel("LUXUS", null)).toBe("Premium");
  });

  it("does not crash on invalid tier values", () => {
    expect(isTierCode("BASIS")).toBe(true);
    expect(isTierCode("premium")).toBe(false);
    expect(getTierDisplayLabelSafe("premium", "nb-NO")).toBe("—");
    expect(getTierDisplayLabelSafe("premium", "nb-NO", { fallbackMode: "blank" })).toBe("");
  });

  it("can render debug labels with the underlying code", () => {
    expect(getTierDisplayWithCode("LUXUS", "en-GB")).toBe("Premium (LUXUS)");
    expect(getTierDisplayLabelSafe("LUXUS", "en-GB", { debugWithCode: true })).toBe("Premium (LUXUS)");
  });
});
