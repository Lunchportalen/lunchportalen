import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import type { ProviderBillingBundle } from "@/lib/providers/providerBillingShared";

type BillingMessages = {
  provider: {
    billing: {
      page: { heading: string };
      agreement: { netPerMonth: string; invoiceSentTo: string };
      actions: { details: string };
      contact: { editButton: string; emailLabel: string; title: string; save: string };
      status: { invoice: { PAID: string } };
      plan: { SAAS_FIXED: string };
    };
  };
};

function billingMessages(messages: Awaited<ReturnType<typeof loadMessagesForLocale>>) {
  return messages as BillingMessages;
}

vi.mock("@/app/leverandor/faktura/actions", () => ({
  updateBillingContact: vi.fn(),
}));

const sampleBundle: ProviderBillingBundle = {
  activeSubscription: {
    id: "sub-1",
    provider_id: "prov-1",
    plan: "SAAS_FIXED",
    monthly_amount: 9000,
    currency: "NOK",
    tax_code_id: "3",
    tax_rate: 0.25,
    billing_email: "faktura@leverandor.no",
    billing_org_number: "123456789",
    billing_address: "Gate 1",
    active_from: "2026-01-01",
    status: "ACTIVE",
    notes: null,
  },
  invoices: [
    {
      id: "inv-1",
      invoice_number: "LP-2026-001",
      invoice_period: "2026-05-01",
      amount_net: 9000,
      amount_tax: 2250,
      amount_total: 11250,
      status: "PAID",
      due_date: "2026-06-01",
      sent_at: "2026-05-02",
      paid_at: "2026-05-10",
      created_at: "2026-05-01",
    },
  ],
};

describe("provider.billing messages", () => {
  test("nb/en parity for page heading", async () => {
    const nb = billingMessages(await loadMessagesForLocale("nb"));
    const en = billingMessages(await loadMessagesForLocale("en"));
    expect(nb.provider.billing.page.heading).toBe("Faktura og oppgjør");
    expect(en.provider.billing.page.heading).toBe("Invoices and settlement");
  });
});

describe("ProviderBillingView", () => {
  test("renders translated UI labels and preserves billing data (nb)", async () => {
    const ProviderBillingView = (await import("@/components/providers/ProviderBillingView")).default;
    const messages = await loadMessagesForLocale("nb");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderBillingView bundle={sampleBundle} providerId="prov-1" canEditContact={true} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Netto / mnd");
    expect(html).toContain("Faktura sendes til");
    expect(html).toContain("faktura@leverandor.no");
    expect(html).toContain("123456789");
    expect(html).toContain("Fast månedspris");
    expect(html).toContain("Detaljer");
    expect(html).toContain("Betalt");
    expect(html).toContain("LP-2026-001");
    expect(html).toMatch(/9[\s\u00a0]?000/);
  });

  test("renders English UI labels when locale is en", async () => {
    const ProviderBillingView = (await import("@/components/providers/ProviderBillingView")).default;
    const messages = await loadMessagesForLocale("en");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderBillingView bundle={sampleBundle} providerId="prov-1" canEditContact={false} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Net / month");
    expect(html).toContain("Invoice sent to");
    expect(html).toContain("Details");
    expect(html).toContain("Paid");
    expect(html).toContain("faktura@leverandor.no");
  });
});

describe("BillingContactForm", () => {
  test("renders translated closed-state button (nb)", async () => {
    const BillingContactForm = (await import("@/components/providers/BillingContactForm")).default;
    const messages = await loadMessagesForLocale("nb");
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <BillingContactForm providerId="prov-1" subscription={sampleBundle.activeSubscription!} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Endre fakturakontakt");
  });

  test("contact form labels translate via messages (en)", async () => {
    const en = billingMessages(await loadMessagesForLocale("en"));
    expect(en.provider.billing.contact.title).toBe("Billing contact");
    expect(en.provider.billing.contact.emailLabel).toBe("Invoice email");
    expect(en.provider.billing.contact.save).toBe("Save");
  });

  test("billing error keys translate in en without leaking raw RPC text", async () => {
    const messages = await loadMessagesForLocale("en");
    const errors = (messages as { provider: { billing: { errors: Record<string, string> } } }).provider
      .billing.errors;
    expect(errors.invalidEmail).toBe("Invalid invoice email.");
    expect(errors.activeSubscriptionNotFound).toBe("No active subscription to update.");
    expect(errors.saveFailed).not.toContain("INVALID_BILLING_EMAIL");
  });
});

describe("faktura page module", () => {
  test("exports default server page", async () => {
    const mod = await import("@/app/leverandor/faktura/page");
    expect(typeof mod.default).toBe("function");
  });
});

describe("updateBillingContact action", () => {
  test("is exported unchanged from actions module", async () => {
    const mod = await import("@/app/leverandor/faktura/actions");
    expect(typeof mod.updateBillingContact).toBe("function");
  });
});
