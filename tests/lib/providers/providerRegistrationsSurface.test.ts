import { describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRATIONS_EMPTY_STEP_KEYS,
  formatProviderRegistrationReceived,
  providerRegistrationStatusLabelKey,
  providerRegistrationsSummaryKey,
} from "@/lib/providers/providerRegistrationsSurface";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type ProviderRegistrationsMessages = {
  provider: {
    registrations: {
      page: { heading: string; subheading: string };
      status: Record<string, string>;
      summary: Record<string, string>;
      empty: { title: string; text: string; steps: Record<string, string> };
      actions: { review: string };
    };
  };
};

function registrationsMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as ProviderRegistrationsMessages;
}

describe("provider.registrations messages — enterprise page context", () => {
  it("kort H1 «Forespørsler» med tydelig bedriftskontekst i subheading", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.registrations.page.heading).toBe("Forespørsler");
    expect(messages.provider.registrations.page.subheading).toContain("nye bedrifter");
    expect(messages.provider.registrations.page.subheading).toContain("leveringsområde");
  });

  it("ingen rå enums i page messages", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    const all = JSON.stringify(messages.provider.registrations.page);
    expect(all).not.toMatch(/PENDING|APPROVED|REJECTED/);
  });

  it("action-copy er provider-safe («Vurder»)", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.registrations.actions.review).toBe("Vurder");
  });
});

describe("providerRegistrationStatusLabelKey", () => {
  it("mapper kjente statuser til stabile keys", () => {
    expect(providerRegistrationStatusLabelKey("PENDING")).toBe("pending");
    expect(providerRegistrationStatusLabelKey("pending")).toBe("pending");
    expect(providerRegistrationStatusLabelKey("APPROVED")).toBe("approved");
    expect(providerRegistrationStatusLabelKey("REJECTED")).toBe("rejected");
  });

  it("ukjent status gir other key", () => {
    expect(providerRegistrationStatusLabelKey("SOME_RAW_ENUM")).toBe("other");
    expect(providerRegistrationStatusLabelKey("")).toBe("other");
  });

  it("nb/en status labels oversettes", async () => {
    const nb = registrationsMessages(await loadMessagesForLocale("nb"));
    const en = registrationsMessages(await loadMessagesForLocale("en"));
    expect(nb.provider.registrations.status.pending).toBe("Til behandling");
    expect(en.provider.registrations.status.pending).toBe("Pending review");
  });
});

describe("providerRegistrationsSummaryKey", () => {
  it("teller til behandling med korrekt entall/flertall keys", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.registrations.summary[providerRegistrationsSummaryKey(0).key]).toBe(
      "Ingen til behandling",
    );
    expect(messages.provider.registrations.summary[providerRegistrationsSummaryKey(1).key]).toBe("1 til behandling");
    expect(
      messages.provider.registrations.summary.many.replace("{count}", "4"),
    ).toBe("4 til behandling");
  });

  it("defensiv mot ugyldige verdier", () => {
    expect(providerRegistrationsSummaryKey(-3).key).toBe("none");
    expect(providerRegistrationsSummaryKey(Number.NaN).key).toBe("none");
  });
});

describe("formatProviderRegistrationReceived", () => {
  it("bruker locale-format, ikke rå ISO", () => {
    const out = formatProviderRegistrationReceived("2026-06-11T16:30:00Z");
    expect(out).toContain("11.06.2026");
    expect(out).not.toContain("2026-06-11T");
  });

  it("respekterer provider-locale", () => {
    expect(formatProviderRegistrationReceived("2026-06-11T16:30:00Z", "en-GB")).toContain("11/06/2026");
  });

  it("manglende/ugyldig verdi gir «—»", () => {
    expect(formatProviderRegistrationReceived(null)).toBe("—");
    expect(formatProviderRegistrationReceived("")).toBe("—");
    expect(formatProviderRegistrationReceived("ikke-en-dato")).toBe("—");
  });
});

describe("provider.registrations empty state messages", () => {
  it("operasjonell empty state med riktig tittel", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    expect(messages.provider.registrations.empty.title).toBe("Ingen forespørsler til behandling");
    expect(messages.provider.registrations.empty.text).toBe(
      "Nye bedriftsforespørsler vises her når de matcher ditt dekningsområde.",
    );
    expect(PROVIDER_REGISTRATIONS_EMPTY_STEP_KEYS.length).toBeGreaterThanOrEqual(3);
  });

  it("lover ikke e-post eller onboarding-token", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    const all = JSON.stringify(messages.provider.registrations.empty).toLowerCase();
    expect(all).not.toMatch(/e-post|email|token|onboarding-lenke/);
  });

  it("ingen teknisk copy i empty state", async () => {
    const messages = registrationsMessages(await loadMessagesForLocale("nb"));
    const all = JSON.stringify(messages.provider.registrations.empty).toLowerCase();
    expect(all).not.toMatch(/pending|registration|null|company_/);
  });
});
