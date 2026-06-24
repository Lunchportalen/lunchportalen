import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import {
  formatProviderOrderItemLine,
  profileDisplayName,
} from "@/lib/providers/kitchenOrderDisplay";
import { loadDetailTranslators } from "@/tests/lib/providers/providerCustomerI18nTestHelpers";

const LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es"] as const;

describe("provider runtime fallback i18n (PR 9e)", () => {
  it("helpers return null instead of hardcoded Norwegian fallbacks", () => {
    expect(profileDisplayName({ full_name: null, email: null })).toBeNull();
    expect(formatProviderOrderItemLine({})).toBeNull();
  });

  it("KitchenOrderCard resolves fallbacks via provider.orders.fallbacks", () => {
    const src = readFileSync(join(process.cwd(), "components/providers/KitchenOrderCard.tsx"), "utf8");
    expect(src).toContain('useTranslations("provider.orders.fallbacks")');
    expect(src).toContain('tFallbacks("unknownProfile")');
    expect(src).toContain('tFallbacks("unknownProduct")');
    expect(src).not.toMatch(/Ukjent|Retten/);
  });

  it("CustomerDetailClient resolves order fallbacks via provider.orders.fallbacks", () => {
    const src = readFileSync(join(process.cwd(), "components/providers/CustomerDetailClient.tsx"), "utf8");
    expect(src).toContain('useTranslations("provider.orders.fallbacks")');
    expect(src).not.toMatch(/Leveringsadresse ikke satt/);
  });

  it("en/de locale messages do not expose Norwegian runtime fallback labels", async () => {
    for (const locale of ["en", "de"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { orders: { fallbacks: { unknownProfile: string; unknownProduct: string } } };
      };
      const { unknownProfile, unknownProduct } = messages.provider.orders.fallbacks;
      expect(unknownProfile).not.toBe("Ukjent");
      expect(unknownProduct).not.toBe("Retten");
      for (const forbidden of ["Ukjent", "Retten", "Leveringsadresse ikke satt"]) {
        expect(unknownProfile).not.toBe(forbidden);
        expect(unknownProduct).not.toBe(forbidden);
      }
    }
  });

  it("provider.orders.fallbacks exists in all 8 locales", async () => {
    for (const locale of LOCALES) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { orders: { fallbacks: { unknownProfile: string; unknownProduct: string } } };
      };
      expect(messages.provider.orders.fallbacks.unknownProfile).toBeTruthy();
      expect(messages.provider.orders.fallbacks.unknownProduct).toBeTruthy();
    }
  });

  it("customer identity missing delivery address uses detail.locationMissing per locale", async () => {
    for (const locale of ["en", "de"] as const) {
      const translators = await loadDetailTranslators(locale);
      const identity = buildCustomerIdentityDisplay(
        { companyName: "Acme", orgnr: "123", status: "ACTIVE" },
        translators,
      );
      expect(identity.deliveryAddress).not.toBe("Leveringsadresse ikke satt");
    }
  });
});
