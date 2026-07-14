/**
 * PHASE 13 — invoice snapshots + email previews (15/15 languages).
 *
 * Låser den rendrede fakturaen (kanonisk InvoiceDocument) og e-postmalene
 * per språk som vitest-snapshots. Endringer i kommersiell/juridisk tekst
 * blir dermed eksplisitte diffs i review — aldri stille drift.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import InvoiceDocument from "@/components/billing/InvoiceDocument";
import type { InvoiceHead, InvoiceLegalContext, InvoiceLine } from "@/lib/billing/invoiceLifecycle";
import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import { companyApprovedCopy, employeeInviteCopy, passwordResetCopy } from "@/lib/email/i18n/emailCopy";
import { orderNotificationCopy } from "@/lib/i18n/notificationCopy";

const INTL_BY_LANG: Record<string, string> = {
  nb: "nb-NO", sv: "sv-SE", da: "da-DK", fi: "fi-FI", en: "en-GB", de: "de-DE", fr: "fr-FR",
  es: "es-ES", it: "it-IT", nl: "nl-NL", pl: "pl-PL", ro: "ro-RO", cs: "cs-CZ", pt: "pt-PT", el: "el-GR",
};

const head = {
  id: "00000000-0000-0000-0000-00000000abcd",
  kind: "INVOICE",
  status: "SENT",
  invoice_number: "RC-2026-0042",
  provider_id: "p",
  company_id: "c",
  invoice_period_start: "2026-07-01",
  invoice_period_end: "2026-07-31",
  currency: "EUR",
  amount_net: 270,
  amount_tax: 40.5,
  amount_total: 310.5,
  amount_paid: 100,
  due_date: "2026-08-14",
  payment_terms_days: 14,
  issued_at: "2026-07-31T12:00:00Z",
  recipient_email: "billing@example.com",
  credit_of_invoice_id: null,
} as unknown as InvoiceHead;

const lines = [
  {
    id: "l1", source: "ORDER", description: "Lunsj · 20.07.2026", quantity: 3,
    unit_price: 90, line_amount: 270, vat_rate: 0.15, vat_amount: 40.5, currency: "EUR",
  },
] as unknown as InvoiceLine[];

describe("invoice snapshots — 15/15 languages", () => {
  for (const lang of APP_LOCALES) {
    it(`invoice document renders stable in ${lang}`, () => {
      const legal: InvoiceLegalContext = {
        marketCountry: lang === "nb" ? "NO" : "DE",
        taxLabel: lang === "nb" ? "MVA" : "VAT",
        sellerTaxId: "999999999",
        buyerTaxId: "888888888",
        buyerAddress: "Testgata 1",
        buyerStateProvince: null,
        reverseChargeNote: null,
        taxExemptNote: null,
        invoiceLanguage: lang,
        intlLocale: INTL_BY_LANG[lang],
      };
      const html = renderToStaticMarkup(
        <InvoiceDocument head={head} lines={lines} payments={[]} providerName="RC Provider" companyName="RC Company" legal={legal} />,
      );
      expect(html).toMatchSnapshot();
      // Aldri oversatt: fakturanummer, beløpstall og valutakode.
      expect(html).toContain("RC-2026-0042");
      expect(html).toContain("EUR");
    });
  }
});

describe("email previews — 15/15 languages", () => {
  for (const lang of APP_LOCALES) {
    it(`email copy renders stable in ${lang}`, () => {
      const approved = companyApprovedCopy(lang);
      const invite = employeeInviteCopy(lang);
      const reset = passwordResetCopy(lang);
      const notif = orderNotificationCopy(lang);
      const preview = [
        `# companyApproved (${lang})`,
        approved.subject,
        approved.greeting("Kari Nordmann"),
        approved.intro("RC Company"),
        approved.cta,
        approved.signoff,
        `# invite (${lang})`,
        invite.subject,
        `# passwordReset (${lang})`,
        reset.subject,
        `# orderNotifications (${lang})`,
        notif.deliveredSubject("20.07.2026"),
        notif.dispatchedSubject("20.07.2026"),
      ].join("\n");
      expect(preview).toMatchSnapshot();
    });
  }
});
