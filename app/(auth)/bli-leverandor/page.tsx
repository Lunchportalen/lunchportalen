// app/(auth)/bli-leverandor/page.tsx — public cateringfirma (provider) registration.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { SUPPORTED_MARKETS, SUPPORTED_LANGUAGE_LABELS } from "@/lib/markets/supportedMarkets";
import ProviderRegistrationForm, { type MarketOption } from "./ProviderRegistrationForm";

export const metadata: Metadata = {
  title: "Bli leverandør – Lunchportalen",
  description: "Registrer cateringfirmaet ditt og lever firmalunsj gjennom Lunchportalen.",
};

export default function Page() {
  const markets: MarketOption[] = SUPPORTED_MARKETS.map((m) => ({
    countryCode: m.countryCode,
    marketName: m.marketName,
    currency: m.currency,
    primaryLanguage: m.primaryLanguage,
    invoiceLanguage: m.invoiceLocale.slice(0, 2),
    supportedLanguages: [...m.supportedLanguages],
    timezoneRequired: m.timezoneStrategy === "provider_required",
    defaultTimezone: m.defaultTimezone,
  }));

  const languageLabels = SUPPORTED_LANGUAGE_LABELS;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="lp-h1 text-center text-2xl font-semibold tracking-tight">Bli leverandør</h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-[rgb(var(--lp-muted))]">
          Registrer cateringfirmaet ditt. En superadmin går gjennom søknaden, og du får en
          e-post med invitasjon til å opprette administratorkontoen din.
        </p>
        <div className="mt-6">
          <ProviderRegistrationForm markets={markets} languageLabels={languageLabels} />
        </div>
      </div>
    </main>
  );
}
