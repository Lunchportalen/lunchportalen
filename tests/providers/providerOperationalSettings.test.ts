// tests/providers/providerOperationalSettings.test.ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROVIDER_LOCALE,
  isSupportedProviderLocale,
  normalizeOperationalEmail,
  PROVIDER_LOCALE_OPTIONS,
  PROVIDER_LOCALE_VALUES,
} from "@/lib/providers/operationalSettingsShared";
import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { resolveProviderNotificationRecipients } from "@/lib/providers/providerNotificationRecipients";
import { ORDER_EMAIL } from "@/lib/system/emailAddresses";

describe("normalizeOperationalEmail", () => {
  it("lagrer gyldig e-post med trim + lowercase", () => {
    expect(normalizeOperationalEmail("  Kjokken@Provider-A.NO ")).toEqual({
      ok: true,
      value: "kjokken@provider-a.no",
    });
  });

  it("tomt felt blir null (gyldig)", () => {
    expect(normalizeOperationalEmail("")).toEqual({ ok: true, value: null });
    expect(normalizeOperationalEmail("   ")).toEqual({ ok: true, value: null });
    expect(normalizeOperationalEmail(null)).toEqual({ ok: true, value: null });
    expect(normalizeOperationalEmail(undefined)).toEqual({ ok: true, value: null });
  });

  it("avviser ugyldige e-poster", () => {
    for (const bad of ["ikke-epost", "a@b", "a@@b.no", "a b@c.no", "a@.no", "@provider.no", "a@provider."]) {
      const res = normalizeOperationalEmail(bad);
      expect(res.ok, `forventet avvisning av: ${bad}`).toBe(false);
    }
  });

  it("avviser for lange e-poster", () => {
    const long = `${"a".repeat(250)}@x.no`;
    expect(normalizeOperationalEmail(long).ok).toBe(false);
  });
});

describe("isSupportedProviderLocale", () => {
  it("godtar alle ni provider operational locales", () => {
    for (const locale of PROVIDER_LOCALE_VALUES) {
      expect(isSupportedProviderLocale(locale)).toBe(true);
    }
    expect(PROVIDER_LOCALE_OPTIONS).toHaveLength(9);
  });

  it("godtar kjente locales", () => {
    expect(isSupportedProviderLocale("nb-NO")).toBe(true);
    expect(isSupportedProviderLocale("en-GB")).toBe(true);
    expect(isSupportedProviderLocale("it-IT")).toBe(true);
  });

  it("avviser ukjente locales", () => {
    expect(isSupportedProviderLocale("xx-XX")).toBe(false);
    expect(isSupportedProviderLocale("")).toBe(false);
    expect(isSupportedProviderLocale(null)).toBe(false);
  });

  it("default locale er gyldig", () => {
    expect(isSupportedProviderLocale(DEFAULT_PROVIDER_LOCALE)).toBe(true);
  });
});

describe("resolveProviderNotificationRecipients", () => {
  const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
  const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

  it("returnerer provider-spesifikke mottakere når alle felter er satt", () => {
    const res = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: {
        operations_email: "ordre@provider-a.no",
        kitchen_email: "kjokken@provider-a.no",
        delivery_email: "levering@provider-a.no",
        locale: "nb-NO",
        timezone: "Europe/Oslo",
        default_currency: "NOK",
      },
      providerContactEmail: "post@provider-a.no",
    });

    expect(res).toEqual({
      providerId: PROVIDER_A,
      operationsEmail: "ordre@provider-a.no",
      operationsEmailSource: "provider_settings",
      kitchenEmail: "kjokken@provider-a.no",
      deliveryEmail: "levering@provider-a.no",
      fallbackEmail: "post@provider-a.no",
      locale: "nb-NO",
      timezone: "Europe/Oslo",
      currency: "NOK",
    });
  });

  it("faller tilbake til operations-kjeden når kjøkken/levering mangler", () => {
    const res = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: { operations_email: "ordre@provider-a.no" },
      providerContactEmail: "post@provider-a.no",
    });

    expect(res.kitchenEmail).toBe("ordre@provider-a.no");
    expect(res.deliveryEmail).toBe("ordre@provider-a.no");
  });

  it("faller tilbake til providers.contact_email når settings mangler", () => {
    const res = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: null,
      providerContactEmail: "Post@Provider-A.no",
    });

    expect(res.operationsEmail).toBe("post@provider-a.no");
    expect(res.operationsEmailSource).toBe("provider_contact");
    expect(res.kitchenEmail).toBe("post@provider-a.no");
    expect(res.deliveryEmail).toBe("post@provider-a.no");
    expect(res.fallbackEmail).toBe("post@provider-a.no");
  });

  it("manglende provider-e-post gir ALDRI Lunchportalen som mottaker (fail-closed)", () => {
    const res = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: null,
      providerContactEmail: null,
    });

    expect(res.operationsEmail).toBeNull();
    expect(res.kitchenEmail).toBeNull();
    expect(res.deliveryEmail).toBeNull();
    expect(res.operationsEmailSource).toBe("missing");
    expect(res.fallbackEmail).toBeNull();
    expect(JSON.stringify(res)).not.toContain(ORDER_EMAIL);
  });

  it("bruker trygge defaults for locale/timezone/currency", () => {
    const res = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: null,
      providerContactEmail: "post@provider-a.no",
    });

    expect(res.locale).toBe("nb-NO");
    expect(res.timezone).toBe("Europe/Oslo");
    expect(res.currency).toBe("NOK");
  });

  it("provider A og provider B blandes aldri", () => {
    const a = resolveProviderNotificationRecipients({
      providerId: PROVIDER_A,
      settings: { operations_email: "ordre@provider-a.no" },
      providerContactEmail: "post@provider-a.no",
    });
    const b = resolveProviderNotificationRecipients({
      providerId: PROVIDER_B,
      settings: { kitchen_email: "kjokken@provider-b.no" },
      providerContactEmail: "post@provider-b.no",
    });

    expect(a.providerId).toBe(PROVIDER_A);
    expect(b.providerId).toBe(PROVIDER_B);

    const aEmails = [a.operationsEmail, a.kitchenEmail, a.deliveryEmail, a.fallbackEmail];
    const bEmails = [b.operationsEmail, b.kitchenEmail, b.deliveryEmail, b.fallbackEmail];

    expect(aEmails.every((e) => e != null && e.endsWith("provider-a.no"))).toBe(true);
    expect(bEmails.every((e) => e != null && e.endsWith("provider-b.no"))).toBe(true);
  });
});

describe("provider.settings.page.operationsNote — provider-eid e-postansvar", () => {
  it("settings-copy sier at cateringfirmaet selv må legge inn e-postene", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { settings: { page: { operationsNote: string } } };
    };
    const note = messages.provider.settings.page.operationsNote;
    expect(note).toContain("Cateringfirmaet må selv legge inn");
    expect(note).toContain(
      "Lunchportalen sender ikke leverandørens operative e-poster til plattformen som standard",
    );
  });
});
