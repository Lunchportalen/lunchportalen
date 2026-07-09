import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  agreementDeliveryDaysDisplay,
  agreementStatusLabel,
  agreementStatusLabelKey,
  agreementStatusTone,
  agreementTierLabel,
  agreementPackageLabel,
  agreementLocationLabel,
  buildAgreementDisplay,
  formatAgreementDate,
  hasMultipleActiveAgreements,
  sortAgreementsForDisplay,
  PROVIDER_AGREEMENT_EMPTY_KEYS,
} from "@/lib/providers/providerCustomerAgreementSurface";
import { loadAgreementTranslator, loadProviderCustomerMessages } from "./providerCustomerI18nTestHelpers";

describe("agreementStatusLabel — provider-safe statuser", () => {
  it("mapper kjente statuser via i18n", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementStatusLabel("ACTIVE", t)).toBe("Aktiv");
    expect(agreementStatusLabel("PENDING", t)).toBe("Til behandling");
    expect(agreementStatusLabel("PAUSED", t)).toBe("Pauset");
    expect(agreementStatusLabel("REJECTED", t)).toBe("Avslått");
    expect(agreementStatusLabel("CLOSED", t)).toBe("Avsluttet");
    expect(agreementStatusLabel("active", t)).toBe("Aktiv");
  });

  it("status keys mapper til i18n-nøkler", () => {
    expect(agreementStatusLabelKey("ACTIVE")).toBe("active");
    expect(agreementStatusLabelKey("SOME_RAW_ENUM")).toBe("unknown");
  });

  it("ukjent status gir «Ukjent», aldri rå enum", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementStatusLabel("SOME_RAW_ENUM", t)).toBe("Ukjent");
    expect(agreementStatusLabel(null, t)).toBe("Ukjent");
    expect(agreementStatusLabel("", t)).toBe("Ukjent");
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
  it("mon–fri vises som «Mandag–fredag»", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementDeliveryDaysDisplay(["mon", "tue", "wed", "thu", "fri"], t)).toEqual({
      label: "Mandag–fredag",
      warning: null,
    });
  });

  it("enkeltdager vises som provider-safe hverdager", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementDeliveryDaysDisplay(["mon", "wed", "fri"], t)).toEqual({
      label: "Mandag, Onsdag, Fredag",
      warning: null,
    });
  });

  it("manglende dager gir «Ikke spesifisert»", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementDeliveryDaysDisplay([], t)).toEqual({ label: "Ikke spesifisert", warning: null });
    expect(agreementDeliveryDaysDisplay(null, t)).toEqual({ label: "Ikke spesifisert", warning: null });
  });

  it("lørdag/søndag vises aldri som ordinær leveringsdag og gir kontrollert avvik", async () => {
    const t = await loadAgreementTranslator("nb");
    const res = agreementDeliveryDaysDisplay(["mon", "tue", "sat", "sun"], t);
    expect(res.label).toBe("Mandag, Tirsdag");
    expect(res.label).not.toMatch(/lør|søn|sat|sun/i);
    expect(res.warning).toBe("Avtalen inneholder leveringsdager utenfor ordinær lunsjlevering.");
  });

  it("kun helgedager gir «Ikke spesifisert» + avvik", async () => {
    const t = await loadAgreementTranslator("nb");
    const messages = await loadProviderCustomerMessages("nb");
    const res = agreementDeliveryDaysDisplay(["sat", "sun"], t);
    expect(res.label).toBe("Ikke spesifisert");
    expect(res.warning).toBe(messages.provider.customers.agreement.deliveryDaysWarning);
  });
});

describe("agreementTierLabel — kontraktnavn, ikke UI-oversettelse", () => {
  it("mapper kjente nivåer fra data", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementTierLabel("BASIS", t)).toBe("Basis");
    expect(agreementTierLabel("LUXUS", t)).toBe("Luksus");
    expect(agreementTierLabel("ENTERPRISE", t)).toBe("Enterprise");
  });

  it("manglende/ukjent nivå gir ærlig fallback", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementTierLabel(null, t)).toBe("Ikke spesifisert i avtalevisningen ennå");
    expect(agreementTierLabel("", t)).toBe("Ikke spesifisert i avtalevisningen ennå");
    expect(agreementTierLabel("GOLD", t)).toBe("Ikke spesifisert i avtalevisningen ennå");
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

  it("aktiv avtale gir korrekt kort uten rå enum/ISO", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay(melhusRow, locations, t);
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

  it("per-dag meny vises når dayMenus finnes", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay(
      {
        ...melhusRow,
        dayMenus: [
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "LUXUS" },
        ],
      },
      locations,
      t,
    );
    expect(d.dayMenusLines).toEqual(["Mandag · Basis", "Tirsdag · Luksus"]);
    expect(d.dayMenusLabel).toContain("Mandag · Basis");
    expect(d.packageLabel).toBe("Mix");
  });

  it("manglende data gir trygge fallbacks", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay(
      { id: "agr-2", status: "PENDING", createdAt: null, deliveryDays: [], locationId: null, tier: null },
      [],
      t,
    );
    expect(d.title).toBe("Kundeavtale");
    expect(d.statusLabel).toBe("Til behandling");
    expect(d.createdLabel).toBe("Ikke spesifisert");
    expect(d.periodLabel).toBeNull();
    expect(d.deliveryDaysLabel).toBe("Ikke spesifisert");
    expect(d.locationLabel).toBe("Leveringsadresse ikke satt");
    expect(d.packageLabel).toBe("Ikke spesifisert i avtalevisningen ennå");
  });

  it("ukjent location_id gir «Leveringsadresse ikke satt», aldri feil lokasjon", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay({ ...melhusRow, locationId: "loc-unknown" }, locations, t);
    expect(d.locationLabel).toBe("Leveringsadresse ikke satt");
  });

  it("viser leveringsadresse når location_id matcher company_locations", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay(melhusRow, locations, t);
    expect(d.locationLabel).toBe("Hovedkontor\nMelhusvegen 1");
  });
});

describe("agreementLocationLabel — leveringsadresse-sannhet", () => {
  const locations = [
    { id: "loc-1", name: "Hovedlokasjon", address: "Sluppenvegen 25, 7037 Trondheim" },
  ];

  it("viser navn + adresse når begge finnes", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementLocationLabel("loc-1", locations, t)).toBe(
      "Hovedlokasjon\nSluppenvegen 25, 7037 Trondheim",
    );
  });

  it("viser bare adresse når navn mangler", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementLocationLabel("loc-2", [{ id: "loc-2", name: "", address: "Gate 1" }], t)).toBe("Gate 1");
  });

  it("viser bare navn når adresse mangler", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementLocationLabel("loc-3", [{ id: "loc-3", name: "Hovedlokasjon", address: null }], t)).toBe(
      "Hovedlokasjon",
    );
  });

  it("fallback til eneste lokasjon når agreement.location_id mangler", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementLocationLabel(null, locations, t)).toBe("Hovedlokasjon\nSluppenvegen 25, 7037 Trondheim");
  });

  it("viser Leveringsadresse ikke satt når ingen data finnes", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementLocationLabel(null, [], t)).toBe("Leveringsadresse ikke satt");
  });
});

describe("agreementPackageLabel — per-dag nivå i avtalekort", () => {
  it("kun Basis viser Avtalenivå: Basis", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(
      agreementPackageLabel(
        [
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "BASIS" },
        ],
        "LUXUS",
        t,
      ),
    ).toBe("Basis");
  });

  it("kun Luksus viser Avtalenivå: Luksus", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementPackageLabel([{ day: "wed", plan: "LUXUS" }], "BASIS", t)).toBe("Luksus");
  });

  it("kun Enterprise viser Avtalenivå: Enterprise", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementPackageLabel([{ day: "fri", plan: "ENTERPRISE" }], "BASIS", t)).toBe("Enterprise");
  });

  it("flere nivå viser Mix", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(
      agreementPackageLabel(
        [
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "LUXUS" },
          { day: "wed", plan: "LUXUS" },
          { day: "thu", plan: "BASIS" },
          { day: "fri", plan: "ENTERPRISE" },
        ],
        "BASIS",
        t,
      ),
    ).toBe("Mix");
  });

  it("Basis/Luxus/Enterprise-kombinasjon viser Mix, ikke global fallback", async () => {
    const t = await loadAgreementTranslator("nb");
    const d = buildAgreementDisplay(
      {
        id: "agr-mix",
        status: "ACTIVE",
        createdAt: "2026-05-10",
        deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
        dayMenus: [
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "LUXUS" },
          { day: "wed", plan: "LUXUS" },
          { day: "thu", plan: "BASIS" },
          { day: "fri", plan: "ENTERPRISE" },
        ],
        tier: "BASIS",
      },
      [],
      t,
    );
    expect(d.packageLabel).toBe("Mix");
    expect(JSON.stringify(d)).not.toContain("(standard)");
  });

  it("uten dayMenus bruker agreements.tier fallback", async () => {
    const t = await loadAgreementTranslator("nb");
    expect(agreementPackageLabel(null, "LUXUS", t)).toBe("Luksus");
    expect(agreementPackageLabel([], "ENTERPRISE", t)).toBe("Enterprise");
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
  it("fallback uten avtale lover ikke funksjonalitet som ikke finnes", async () => {
    const messages = await loadProviderCustomerMessages("nb");
    const empty = messages.provider.customers.agreement.empty as { title: string; text: string };
    expect(PROVIDER_AGREEMENT_EMPTY_KEYS).toEqual(["title", "text"]);
    expect(empty.title).toBe("Ingen avtale registrert");
    expect(empty.text).toContain("leveringsdager, lokasjon og avtaleinnhold");
  });
});

describe("customer detail i18n wiring", () => {
  const DETAIL_CLIENT = join(process.cwd(), "components/providers/CustomerDetailClient.tsx");
  const AGREEMENT_EDIT = join(process.cwd(), "components/providers/ProviderCustomerAgreementEditDialog.tsx");
  const REMOVAL = join(process.cwd(), "components/providers/ProviderCustomerRemovalDialog.tsx");
  const RESTORE = join(process.cwd(), "components/providers/ProviderCustomerRestoreDialog.tsx");
  const SUSPEND = join(process.cwd(), "components/providers/SuspendDialog.tsx");

  it("CustomerDetailClient bruker i18n namespaces", () => {
    const src = readFileSync(DETAIL_CLIENT, "utf8");
    expect(src).toContain('useTranslations("provider.customers.detail")');
    expect(src).toContain('useTranslations("provider.customers.agreement")');
    expect(src).toContain('useTranslations("provider.customers.activity")');
    expect(src).not.toContain("Ingen ordrer.");
  });

  it("lifecycle dialogs bruker i18n uten endret submit payload", () => {
    const removal = readFileSync(REMOVAL, "utf8");
    const restore = readFileSync(RESTORE, "utf8");
    const suspend = readFileSync(SUSPEND, "utf8");
    const agreementEdit = readFileSync(AGREEMENT_EDIT, "utf8");

    expect(removal).toContain('useTranslations("provider.customers.dialogs');
    expect(restore).toContain('useTranslations("provider.customers.dialogs');
    expect(suspend).toContain('useTranslations("provider.customers.lifecycle.dialog")');
    expect(agreementEdit).toContain('useTranslations("provider.customers.dialogs.agreementEdit")');

    expect(agreementEdit).toContain('method: "PATCH"');
    expect(agreementEdit).toContain("JSON.stringify(payload)");
    expect(removal).not.toContain("lp_order_set");
    expect(restore).not.toContain("lp_order_advance_status");
  });

  it("nb/en detail labels oversettes, company data beholdes via props", async () => {
    const nb = await loadProviderCustomerMessages("nb");
    const en = await loadProviderCustomerMessages("en");
    const nbDetail = nb.provider.customers.detail as Record<string, unknown>;
    const enDetail = en.provider.customers.detail as Record<string, unknown>;

    expect(nbDetail.identityTitle).toBe("Kundeinformasjon");
    expect(enDetail.identityTitle).toBe("Customer information");
    expect(nb.provider.customers.status.active).toBe("Aktiv");
    expect(en.provider.customers.status.active).toBe("Active");
  });
});
