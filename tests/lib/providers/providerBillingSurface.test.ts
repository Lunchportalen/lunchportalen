import { describe, expect, it } from "vitest";

import {
  buildBillingSummaryCards,
  invoiceStatusLabel,
  settlementStatusLabel,
} from "@/lib/providers/providerBillingSurface";
import { invoiceStatusKey, providerPlanKey } from "@/lib/providers/providerBillingShared";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type BillingMessages = {
  provider: {
    billing: Record<string, unknown>;
  };
};

function billingMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as BillingMessages;
}

function tBilling(messages: BillingMessages["provider"]["billing"]) {
  return (key: string, values?: Record<string, string | number>) => {
    const parts = key.split(".");
    let cur: unknown = messages;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    let out = String(cur ?? key);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        out = out.replace(`{${k}}`, String(v));
      }
    }
    return out;
  };
}

describe("provider.billing messages — presis oppgjørscopy", () => {
  it("subheading forklarer at dette er leverandørens oppgjør mot Lunchportalen", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const billing = messages.provider.billing as {
      page: { subheading: string };
      notActivated: { text: string; title: string };
      agreement: { activeEyebrow: string };
      history: { title: string; emptyText: string };
      commissionNote: string;
    };
    expect(billing.page.subheading).toContain("oppgjør");
    expect(billing.page.subheading).toContain("mellom leverandøren og Lunchportalen");
    expect(billing.notActivated.text).toContain("Oppgjør er ikke aktivert");
    expect(billing.notActivated.text).toContain("oppgjørsavtale");
    expect(billing.agreement.activeEyebrow).toBe("Aktiv oppgjørsavtale");
    expect(billing.history.title).toBe("Fakturagrunnlag og oppgjør");
  });

  it("empty state omtaler fakturagrunnlag/provisjon/status/forfall uten å påstå sendt faktura", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const text = (messages.provider.billing as { history: { emptyText: string } }).history.emptyText;
    expect(text).toContain("fakturagrunnlag");
    expect(text).toContain("provisjon");
    expect(text).toContain("status");
    expect(text).toContain("forfall");
    expect(text).not.toContain("fakturaene");
    expect(text.toLowerCase()).not.toContain("sendt");
  });

  it("provisjonsmodell omtales som produktcopy uten å love aktivt oppgjør", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const note = (messages.provider.billing as { commissionNote: string }).commissionNote;
    expect(note).toBe(
      "Lunchportalen beregner 5 % provisjon per solgte porsjon når oppgjør er aktivert.",
    );
  });

  it("page copy finnes i nb og en", async () => {
    const nb = billingMessages(await loadMessagesForLocale("nb"));
    const en = billingMessages(await loadMessagesForLocale("en"));
    expect((nb.provider.billing as { page: { heading: string } }).page.heading).toBe("Faktura og oppgjør");
    expect((en.provider.billing as { page: { heading: string } }).page.heading).toBe("Invoices and settlement");
  });
});

describe("settlementStatusLabel", () => {
  it("skiller «Ikke aktivert» fra «Aktiv» via i18n keys", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    expect(settlementStatusLabel(true, t)).toBe("Aktiv");
    expect(settlementStatusLabel(false, t)).toBe("Ikke aktivert");
  });
});

describe("invoiceStatusLabel", () => {
  it("mapper kjente statuser til provider-safe norsk copy", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    expect(invoiceStatusLabel("DRAFT", t)).toBe("Utkast");
    expect(invoiceStatusLabel("SENT", t)).toBe("Sendt");
    expect(invoiceStatusLabel("PAID", t)).toBe("Betalt");
    expect(invoiceStatusLabel("OVERDUE", t)).toBe("Forfalt");
    expect(invoiceStatusLabel("VOID", t)).toBe("Annullert");
    expect(invoiceStatusLabel("paid", t)).toBe("Betalt");
  });

  it("fallback lekker aldri rå enum", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    expect(invoiceStatusLabel("SOME_RAW_ENUM", t)).toBe("Ukjent");
    expect(invoiceStatusLabel(null, t)).toBe("Ukjent");
    expect(invoiceStatusLabel("", t)).toBe("Ukjent");
  });
});

describe("invoiceStatusKey / providerPlanKey", () => {
  it("mapper backend enum uten å endre verdier", () => {
    expect(invoiceStatusKey("draft")).toBe("DRAFT");
    expect(invoiceStatusKey("UNKNOWN")).toBe("unknown");
    expect(providerPlanKey("SAAS_FIXED")).toBe("SAAS_FIXED");
    expect(providerPlanKey("LEGACY_PLAN")).toBeNull();
  });
});

describe("buildBillingSummaryCards", () => {
  it("ikke aktivert: ærlige verdier uten fake tall", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    const cards = buildBillingSummaryCards({ hasActiveSubscription: false }, t);
    expect(cards.map((c) => c.label)).toEqual(["Oppgjørsstatus", "Provisjon", "Neste oppgjør"]);
    expect(cards[0]?.value).toBe("Ikke aktivert");
    expect(cards[0]?.hint).toContain("Kontakt Lunchportalen");
    expect(cards[1]?.value).toBe("Vises når oppgjør er aktivert");
    expect(cards[2]?.value).toBe("Ikke planlagt");
  });

  it("aktiv: status er Aktiv uten hardkodet provisjonsberegning", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    const cards = buildBillingSummaryCards({ hasActiveSubscription: true }, t);
    expect(cards[0]?.value).toBe("Aktiv");
    expect(cards[0]?.hint).toBeNull();
    expect(cards[1]?.value).not.toMatch(/\d/);
  });

  it("ingen rå enum/ISO i output", async () => {
    const messages = billingMessages(await loadMessagesForLocale("nb"));
    const t = tBilling(messages.provider.billing);
    const all = JSON.stringify(buildBillingSummaryCards({ hasActiveSubscription: false }, t));
    expect(all).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(all).not.toMatch(/[A-Z]{2,}_[A-Z]+/);
  });
});
