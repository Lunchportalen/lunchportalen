import { describe, expect, it } from "vitest";

import {
  PROVIDER_AGREEMENT_COPY,
  agreementDeliveryDaysDisplay,
  agreementStatusLabel,
  agreementStatusTone,
  agreementTierLabel,
  buildAgreementDisplay,
  formatAgreementDate,
  hasMultipleActiveAgreements,
  sortAgreementsForDisplay,
} from "@/lib/providers/providerCustomerAgreementSurface";

describe("agreementStatusLabel — provider-safe statuser", () => {
  it("mapper kjente statuser", () => {
    expect(agreementStatusLabel("ACTIVE")).toBe("Aktiv");
    expect(agreementStatusLabel("PENDING")).toBe("Til behandling");
    expect(agreementStatusLabel("PAUSED")).toBe("Pauset");
    expect(agreementStatusLabel("REJECTED")).toBe("Avslått");
    expect(agreementStatusLabel("CLOSED")).toBe("Avsluttet");
    expect(agreementStatusLabel("active")).toBe("Aktiv");
  });

  it("ukjent status gir «Ukjent», aldri rå enum", () => {
    expect(agreementStatusLabel("SOME_RAW_ENUM")).toBe("Ukjent");
    expect(agreementStatusLabel(null)).toBe("Ukjent");
    expect(agreementStatusLabel("")).toBe("Ukjent");
  });

  it("toner: aktiv=success, pauset=warning, ellers neutral", () => {
    expect(agreementStatusTone("ACTIVE")).toBe("success");
    expect(agreementStatusTone("PAUSED")).toBe("warning");
    expect(agreementStatusTone("PENDING")).toBe("neutral");
    expect(agreementStatusTone("garbage")).toBe("neutral");
  });
});

describe("formatAgreementDate — aldri rå ISO", () => {
  it("formaterer ISO-timestamp til locale-dato", () => {
    expect(formatAgreementDate("2026-05-10T18:08:07.145695+00:00")).toBe("10. mai 2026");
    expect(formatAgreementDate("2026-05-10")).toBe("10. mai 2026");
  });

  it("ugyldig/tomt gir null", () => {
    expect(formatAgreementDate("")).toBeNull();
    expect(formatAgreementDate("not-a-date")).toBeNull();
    expect(formatAgreementDate(null)).toBeNull();
  });
});

describe("agreementDeliveryDaysDisplay — mandag–fredag-domenet", () => {
  it("mon–fri vises som «Mandag–fredag»", () => {
    expect(agreementDeliveryDaysDisplay(["mon", "tue", "wed", "thu", "fri"])).toEqual({
      label: "Mandag–fredag",
      warning: null,
    });
  });

  it("enkeltdager vises som provider-safe hverdager", () => {
    expect(agreementDeliveryDaysDisplay(["mon", "wed", "fri"])).toEqual({
      label: "Mandag, Onsdag, Fredag",
      warning: null,
    });
  });

  it("manglende dager gir «Ikke spesifisert»", () => {
    expect(agreementDeliveryDaysDisplay([])).toEqual({ label: "Ikke spesifisert", warning: null });
    expect(agreementDeliveryDaysDisplay(null)).toEqual({ label: "Ikke spesifisert", warning: null });
  });

  it("lørdag/søndag vises aldri som ordinær leveringsdag og gir kontrollert avvik", () => {
    const res = agreementDeliveryDaysDisplay(["mon", "tue", "sat", "sun"]);
    expect(res.label).toBe("Mandag, Tirsdag");
    expect(res.label).not.toMatch(/lør|søn|sat|sun/i);
    expect(res.warning).toBe("Avtalen inneholder leveringsdager utenfor ordinær lunsjlevering.");
  });

  it("kun helgedager gir «Ikke spesifisert» + avvik", () => {
    const res = agreementDeliveryDaysDisplay(["sat", "sun"]);
    expect(res.label).toBe("Ikke spesifisert");
    expect(res.warning).toBe(PROVIDER_AGREEMENT_COPY.deliveryDaysWarning);
  });
});

describe("agreementTierLabel — aldri fake nivå", () => {
  it("mapper kjente nivåer fra data", () => {
    expect(agreementTierLabel("BASIS")).toBe("Basis");
    expect(agreementTierLabel("LUXUS")).toBe("Luxus");
    expect(agreementTierLabel("ENTERPRISE")).toBe("Enterprise");
  });

  it("manglende/ukjent nivå gir ærlig fallback", () => {
    expect(agreementTierLabel(null)).toBe("Ikke spesifisert i avtalevisningen ennå");
    expect(agreementTierLabel("")).toBe("Ikke spesifisert i avtalevisningen ennå");
    expect(agreementTierLabel("GOLD")).toBe("Ikke spesifisert i avtalevisningen ennå");
  });
});

describe("buildAgreementDisplay — komplett displaymodell", () => {
  const melhusRow = {
    id: "agr-1",
    status: "ACTIVE",
    createdAt: "2026-05-10T18:08:07.145695+00:00",
    startsAt: "2026-05-10",
    endsAt: null,
    deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
    locationId: "loc-1",
    tier: "BASIS",
  };
  const locations = [{ id: "loc-1", name: "Hovedkontor", address: "Melhusvegen 1" }];

  it("aktiv avtale gir korrekt kort uten rå enum/ISO", () => {
    const d = buildAgreementDisplay(melhusRow, locations);
    expect(d.title).toBe("Aktiv kundeavtale");
    expect(d.statusLabel).toBe("Aktiv");
    expect(d.statusTone).toBe("success");
    expect(d.createdLabel).toBe("Opprettet 10. mai 2026");
    expect(d.periodLabel).toBe("Fra 10. mai 2026 · Ingen sluttdato");
    expect(d.deliveryDaysLabel).toBe("Mandag–fredag");
    expect(d.deliveryDaysWarning).toBeNull();
    expect(d.locationLabel).toBe("Hovedkontor\nMelhusvegen 1");
    expect(d.packageLabel).toBe("Basis");

    const all = JSON.stringify(d);
    expect(all).not.toContain("ACTIVE");
    expect(all).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("per-dag meny vises når dayMenus finnes", () => {
    const d = buildAgreementDisplay(
      {
        ...melhusRow,
        dayMenus: [
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "LUXUS" },
        ],
      },
      locations,
    );
    expect(d.dayMenusLines).toEqual(["Mandag · Basis", "Tirsdag · Luxus"]);
    expect(d.dayMenusLabel).toContain("Mandag · Basis");
  });

  it("manglende data gir trygge fallbacks", () => {
    const d = buildAgreementDisplay(
      { id: "agr-2", status: "PENDING", createdAt: null, deliveryDays: [], locationId: null, tier: null },
      [],
    );
    expect(d.title).toBe("Kundeavtale");
    expect(d.statusLabel).toBe("Til behandling");
    expect(d.createdLabel).toBe("Ikke spesifisert");
    expect(d.periodLabel).toBeNull();
    expect(d.deliveryDaysLabel).toBe("Ikke spesifisert");
    expect(d.locationLabel).toBe("Leveringsadresse ikke satt");
    expect(d.packageLabel).toBe("Ikke spesifisert i avtalevisningen ennå");
  });

  it("ukjent location_id gir «Ikke spesifisert», aldri feil lokasjon", () => {
    const d = buildAgreementDisplay({ ...melhusRow, locationId: "loc-unknown" }, locations);
    expect(d.locationLabel).toBe("Leveringsadresse ikke satt");
  });
});

describe("sortering og flere aktive avtaler", () => {
  it("aktive avtaler vises først", () => {
    const sorted = sortAgreementsForDisplay([
      { id: "a", status: "CLOSED" },
      { id: "b", status: "ACTIVE" },
      { id: "c", status: "PENDING" },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("varsler kun ved flere aktive avtaler", () => {
    expect(hasMultipleActiveAgreements([{ status: "ACTIVE" }, { status: "ACTIVE" }])).toBe(true);
    expect(hasMultipleActiveAgreements([{ status: "ACTIVE" }, { status: "CLOSED" }])).toBe(false);
    expect(hasMultipleActiveAgreements([])).toBe(false);
  });
});

describe("empty state — provider-safe", () => {
  it("fallback uten avtale lover ikke funksjonalitet som ikke finnes", () => {
    expect(PROVIDER_AGREEMENT_COPY.empty.title).toBe("Ingen avtale registrert");
    expect(PROVIDER_AGREEMENT_COPY.empty.text).toContain("leveringsdager, lokasjon og avtaleinnhold");
  });
});
