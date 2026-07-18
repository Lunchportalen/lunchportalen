"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  NorwayLegalClickwrap,
  type NorwayLegalAcceptancePayload,
} from "@/components/legal/NorwayLegalClickwrap";

export type MarketOption = {
  countryCode: string;
  marketName: string;
  currency: string;
  primaryLanguage: string;
  invoiceLanguage: string;
  supportedLanguages: string[];
  timezoneRequired: boolean;
  defaultTimezone: string | null;
};

type Props = {
  markets: MarketOption[];
  languageLabels: Record<string, string>;
};

// Compact IANA timezone options for US/CA (provider_required markets).
const US_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];
const CA_TIMEZONES = [
  "America/Toronto",
  "America/Winnipeg",
  "America/Edmonton",
  "America/Vancouver",
  "America/Halifax",
  "America/St_Johns",
];

function fieldClass() {
  return "w-full min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 text-text outline-none focus:ring-2 focus:ring-[rgb(var(--lp-ring))]";
}

export default function ProviderRegistrationForm({ markets, languageLabels }: Props) {
  const [country, setCountry] = useState(markets[0]?.countryCode ?? "NO");
  const market = useMemo(() => markets.find((m) => m.countryCode === country) ?? markets[0], [markets, country]);

  const [companyName, setCompanyName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [operatingLanguage, setOperatingLanguage] = useState(market?.primaryLanguage ?? "nb");
  const [invoiceLanguage, setInvoiceLanguage] = useState(market?.invoiceLanguage ?? "nb");
  const [timezone, setTimezone] = useState("");
  const [taxRegistration, setTaxRegistration] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [coverageWish, setCoverageWish] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [norwayLegal, setNorwayLegal] = useState<NorwayLegalAcceptancePayload[] | null>(null);

  function onCountryChange(next: string) {
    setCountry(next);
    const m = markets.find((x) => x.countryCode === next);
    if (m) {
      setOperatingLanguage(m.primaryLanguage);
      setInvoiceLanguage(m.invoiceLanguage);
      if (!m.timezoneRequired) setTimezone("");
    }
  }

  const tzOptions = country === "US" ? US_TIMEZONES : country === "CA" ? CA_TIMEZONES : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (companyName.trim().length < 2) return setError("Firmanavn må fylles ut.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError("Ugyldig e-post.");
    if (contactName.trim().length < 2) return setError("Kontaktperson må fylles ut.");
    if (market?.timezoneRequired && !timezone) return setError("Velg tidssone for dette markedet (USA/Canada).");
    if (country === "NO" && !norwayLegal?.length) {
      return setError("Du må akseptere alle norske leverandørvilkår før innsending.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/provider-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          company_name: companyName.trim(),
          org_number: orgNumber.trim() || undefined,
          country_code: country,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || undefined,
          operating_language: operatingLanguage,
          invoice_language: invoiceLanguage,
          // Fail-closed: currency comes from the selected market only (no fallback).
          currency: market?.currency ?? "",
          timezone: timezone || undefined,
          tax_registration: taxRegistration.trim() || undefined,
          order_email: orderEmail.trim() || undefined,
          coverage_wish: coverageWish.trim() || undefined,
          ...(country === "NO" && norwayLegal ? { norway_legal_acceptances: norwayLegal } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Kunne ikke sende søknaden. Prøv igjen."));
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Uventet feil. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Søknad mottatt</h2>
        <p className="mt-2 text-sm text-emerald-800">
          Takk! Vi går gjennom søknaden og sender deg en e-post med invitasjon når den er godkjent.
        </p>
        <Link href="/" className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold underline">
          Til forsiden
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Land / marked</label>
        <select className={fieldClass()} value={country} onChange={(e) => onCountryChange(e.target.value)}>
          {markets.map((m) => (
            <option key={m.countryCode} value={m.countryCode}>
              {m.marketName} ({m.countryCode}) · {m.currency}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pr-company-name" className="mb-1 block text-sm font-medium text-text">Firmanavn</label>
        <input id="pr-company-name" name="company_name" className={fieldClass()} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pr-org-number" className="mb-1 block text-sm font-medium text-text">Organisasjonsnummer</label>
          <input id="pr-org-number" name="org_number" className={fieldClass()} value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div>
          <label htmlFor="pr-tax-registration" className="mb-1 block text-sm font-medium text-text">MVA-/skatteregistrering</label>
          <input id="pr-tax-registration" name="tax_registration" className={fieldClass()} value={taxRegistration} onChange={(e) => setTaxRegistration(e.target.value)} placeholder="Valgfritt" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pr-contact-name" className="mb-1 block text-sm font-medium text-text">Kontaktperson</label>
          <input id="pr-contact-name" name="contact_name" className={fieldClass()} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="pr-contact-email" className="mb-1 block text-sm font-medium text-text">Kontakt-e-post (blir admin)</label>
          <input id="pr-contact-email" name="contact_email" className={fieldClass()} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pr-contact-phone" className="mb-1 block text-sm font-medium text-text">Telefon</label>
          <input id="pr-contact-phone" name="contact_phone" className={fieldClass()} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div>
          <label htmlFor="pr-order-email" className="mb-1 block text-sm font-medium text-text">Ordre-e-post</label>
          <input id="pr-order-email" name="order_email" className={fieldClass()} type="email" value={orderEmail} onChange={(e) => setOrderEmail(e.target.value)} placeholder="Valgfritt (kan settes senere)" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Driftsspråk</label>
          <select className={fieldClass()} value={operatingLanguage} onChange={(e) => setOperatingLanguage(e.target.value)}>
            {(market?.supportedLanguages ?? ["nb"]).map((l) => (
              <option key={l} value={l}>{languageLabels[l] ?? l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Fakturaspråk</label>
          <select className={fieldClass()} value={invoiceLanguage} onChange={(e) => setInvoiceLanguage(e.target.value)}>
            {(market?.supportedLanguages ?? ["nb"]).map((l) => (
              <option key={l} value={l}>{languageLabels[l] ?? l}</option>
            ))}
          </select>
        </div>
      </div>

      {market?.timezoneRequired ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Tidssone (påkrevd for {market.marketName})</label>
          <select className={fieldClass()} value={timezone} onChange={(e) => setTimezone(e.target.value)} required>
            <option value="">Velg tidssone …</option>
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-text">Dekningsønske / område</label>
        <textarea className={fieldClass()} rows={3} value={coverageWish} onChange={(e) => setCoverageWish(e.target.value)} placeholder="F.eks. postnummer eller byer dere leverer til (valgfritt)" />
      </div>

      {country === "NO" ? <NorwayLegalClickwrap role="provider" onChange={setNorwayLegal} /> : null}

      <button
        type="submit"
        name="submit-provider-registration"
        disabled={submitting || (country === "NO" && !norwayLegal?.length)}
        className="min-h-14 w-full rounded-full border border-white/15 bg-[linear-gradient(135deg,rgb(17_17_17)_0%,rgb(36_28_40)_100%)] px-6 py-4 text-base font-extrabold tracking-tight text-white transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
      >
        {submitting ? "Sender …" : "Send søknad"}
      </button>
    </form>
  );
}
