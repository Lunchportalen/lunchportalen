import { describe, expect, it } from "vitest";

import {
  PROVIDER_BILLING_COPY,
  buildBillingSummaryCards,
  invoiceStatusLabel,
  settlementStatusLabel,
} from "@/lib/providers/providerBillingSurface";

const ALL_COPY = JSON.stringify(PROVIDER_BILLING_COPY);

describe("PROVIDER_BILLING_COPY — presis oppgjørscopy", () => {
  it("subheading forklarer at dette er leverandørens oppgjør mot Lunchportalen", () => {
    expect(PROVIDER_BILLING_COPY.subheading).toContain("oppgjør");
    expect(PROVIDER_BILLING_COPY.subheading).toContain("mellom leverandøren og Lunchportalen");
  });

  it("bruker ikke uklar «Ingen aktiv avtale» uten presisering", () => {
    expect(ALL_COPY).not.toContain("Ingen aktiv avtale er registrert");
    expect(PROVIDER_BILLING_COPY.notActivated.text).toContain("Oppgjør er ikke aktivert");
    expect(PROVIDER_BILLING_COPY.notActivated.text).toContain("oppgjørsavtale");
    expect(PROVIDER_BILLING_COPY.activeAgreementEyebrow).toBe("Aktiv oppgjørsavtale");
  });

  it("history-seksjonen heter «Fakturagrunnlag og oppgjør»", () => {
    expect(PROVIDER_BILLING_COPY.history.title).toBe("Fakturagrunnlag og oppgjør");
  });

  it("empty state omtaler fakturagrunnlag/provisjon/status/forfall uten å påstå sendt faktura", () => {
    const text = PROVIDER_BILLING_COPY.history.emptyText;
    expect(text).toContain("fakturagrunnlag");
    expect(text).toContain("provisjon");
    expect(text).toContain("status");
    expect(text).toContain("forfall");
    expect(text).not.toContain("fakturaene");
    expect(text.toLowerCase()).not.toContain("sendt");
  });

  it("provisjonsmodell omtales som produktcopy uten å love aktivt oppgjør", () => {
    expect(PROVIDER_BILLING_COPY.commissionNote).toBe(
      "Lunchportalen beregner 5 % provisjon per solgte porsjon når oppgjør er aktivert.",
    );
  });

  it("ingen copy lover Tripletex/fakturering/utbetaling", () => {
    const lower = ALL_COPY.toLowerCase();
    expect(lower).not.toContain("tripletex");
    expect(lower).not.toContain("utbetal");
    expect(lower).not.toContain("automatisk faktur");
  });
});

describe("settlementStatusLabel", () => {
  it("skiller «Ikke aktivert» fra «Aktiv»", () => {
    expect(settlementStatusLabel(true)).toBe("Aktiv");
    expect(settlementStatusLabel(false)).toBe("Ikke aktivert");
  });
});

describe("invoiceStatusLabel", () => {
  it("mapper kjente statuser til provider-safe norsk copy", () => {
    expect(invoiceStatusLabel("DRAFT")).toBe("Utkast");
    expect(invoiceStatusLabel("SENT")).toBe("Sendt");
    expect(invoiceStatusLabel("PAID")).toBe("Betalt");
    expect(invoiceStatusLabel("OVERDUE")).toBe("Forfalt");
    expect(invoiceStatusLabel("VOID")).toBe("Annullert");
    expect(invoiceStatusLabel("paid")).toBe("Betalt");
  });

  it("fallback lekker aldri rå enum", () => {
    expect(invoiceStatusLabel("SOME_RAW_ENUM")).toBe("Ukjent");
    expect(invoiceStatusLabel(null)).toBe("Ukjent");
    expect(invoiceStatusLabel("")).toBe("Ukjent");
  });
});

describe("buildBillingSummaryCards", () => {
  it("ikke aktivert: ærlige verdier uten fake tall", () => {
    const cards = buildBillingSummaryCards({ hasActiveSubscription: false });
    expect(cards.map((c) => c.label)).toEqual(["Oppgjørsstatus", "Provisjon", "Neste oppgjør"]);
    expect(cards[0]?.value).toBe("Ikke aktivert");
    expect(cards[0]?.hint).toContain("Kontakt Lunchportalen");
    expect(cards[1]?.value).toBe("Vises når oppgjør er aktivert");
    expect(cards[2]?.value).toBe("Ikke planlagt");
  });

  it("aktiv: status er Aktiv uten hardkodet provisjonsberegning", () => {
    const cards = buildBillingSummaryCards({ hasActiveSubscription: true });
    expect(cards[0]?.value).toBe("Aktiv");
    expect(cards[0]?.hint).toBeNull();
    // Provisjonssats finnes ikke i read model — verdien skal aldri være et tall.
    expect(cards[1]?.value).not.toMatch(/\d/);
  });

  it("ingen rå enum/ISO i output", () => {
    const all = JSON.stringify(buildBillingSummaryCards({ hasActiveSubscription: false }));
    expect(all).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(all).not.toMatch(/[A-Z]{2,}_[A-Z]+/);
  });
});
