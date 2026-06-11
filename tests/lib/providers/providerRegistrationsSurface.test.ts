import { describe, expect, it } from "vitest";

import {
  PROVIDER_REGISTRATIONS_COPY,
  PROVIDER_REGISTRATIONS_EMPTY_STATE,
  formatProviderRegistrationReceived,
  providerRegistrationStatusLabel,
  providerRegistrationsSummary,
} from "@/lib/providers/providerRegistrationsSurface";

describe("PROVIDER_REGISTRATIONS_COPY — enterprise page context", () => {
  it("kort H1 «Forespørsler» med tydelig bedriftskontekst i subheading", () => {
    expect(PROVIDER_REGISTRATIONS_COPY.heading).toBe("Forespørsler");
    expect(PROVIDER_REGISTRATIONS_COPY.subheading).toContain("nye bedrifter");
    expect(PROVIDER_REGISTRATIONS_COPY.subheading).toContain("leveringsområde");
  });

  it("ingen rå enums eller teknisk copy i copy-modulen", () => {
    const all = JSON.stringify(PROVIDER_REGISTRATIONS_COPY);
    expect(all).not.toMatch(/PENDING|APPROVED|REJECTED/);
    expect(all.toLowerCase()).not.toMatch(/created_at|updated_at|enum|null/);
  });

  it("action-copy er provider-safe («Vurder»)", () => {
    expect(PROVIDER_REGISTRATIONS_COPY.reviewAction).toBe("Vurder");
  });
});

describe("providerRegistrationStatusLabel", () => {
  it("mapper kjente statuser til provider-safe norsk copy", () => {
    expect(providerRegistrationStatusLabel("PENDING")).toBe("Til behandling");
    expect(providerRegistrationStatusLabel("pending")).toBe("Til behandling");
    expect(providerRegistrationStatusLabel("APPROVED")).toBe("Godkjent");
    expect(providerRegistrationStatusLabel("REJECTED")).toBe("Avslått");
  });

  it("ukjent status lekker aldri rå enum", () => {
    expect(providerRegistrationStatusLabel("SOME_RAW_ENUM")).toBe("Annet");
    expect(providerRegistrationStatusLabel("")).toBe("Annet");
  });
});

describe("providerRegistrationsSummary", () => {
  it("teller til behandling med korrekt entall/flertall", () => {
    expect(providerRegistrationsSummary(0)).toBe("Ingen til behandling");
    expect(providerRegistrationsSummary(1)).toBe("1 til behandling");
    expect(providerRegistrationsSummary(4)).toBe("4 til behandling");
  });

  it("defensiv mot ugyldige verdier", () => {
    expect(providerRegistrationsSummary(-3)).toBe("Ingen til behandling");
    expect(providerRegistrationsSummary(Number.NaN)).toBe("Ingen til behandling");
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

describe("PROVIDER_REGISTRATIONS_EMPTY_STATE", () => {
  it("operasjonell empty state med riktig tittel", () => {
    expect(PROVIDER_REGISTRATIONS_EMPTY_STATE.title).toBe("Ingen forespørsler til behandling");
    expect(PROVIDER_REGISTRATIONS_EMPTY_STATE.text).toBe(
      "Nye bedriftsforespørsler vises her når de matcher ditt dekningsområde.",
    );
    expect(PROVIDER_REGISTRATIONS_EMPTY_STATE.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("lover ikke e-post eller onboarding-token", () => {
    const all = JSON.stringify(PROVIDER_REGISTRATIONS_EMPTY_STATE).toLowerCase();
    expect(all).not.toMatch(/e-post|email|token|onboarding-lenke/);
  });

  it("ingen teknisk copy i empty state", () => {
    const all = JSON.stringify(PROVIDER_REGISTRATIONS_EMPTY_STATE).toLowerCase();
    expect(all).not.toMatch(/pending|registration|null|company_/);
  });
});
