"use client";

// STATUS: KEEP

import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";

type Tier = "BASIS" | "LUXUS";

type DayRow = {
  key: DayKey;
  label: string;
  enabled: boolean;
  tier: Tier;
  price: number; // eks mva
};

const DAYS: Array<{ key: DayKey; label: string; defaultTier: Tier; defaultPrice: number }> = [
  { key: "mon", label: "Mandag", defaultTier: "BASIS", defaultPrice: 90 },
  { key: "tue", label: "Tirsdag", defaultTier: "BASIS", defaultPrice: 90 },
  { key: "wed", label: "Onsdag", defaultTier: "BASIS", defaultPrice: 90 },
  { key: "thu", label: "Torsdag", defaultTier: "BASIS", defaultPrice: 90 },
  { key: "fri", label: "Fredag", defaultTier: "LUXUS", defaultPrice: 130 },
];

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function OnboardingForm() {
  const router = useRouter();

  const [isSubmitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Firma
  const [companyName, setCompanyName] = React.useState("");
  const [orgnr, setOrgnr] = React.useState("");
  const [employeeCount, setEmployeeCount] = React.useState("");

  // Firma-admin
  const [adminName, setAdminName] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminPhone, setAdminPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");

  const [showPw, setShowPw] = React.useState(false);
  const [showPw2, setShowPw2] = React.useState(false);

  // Levering
  const [deliveryPoint, setDeliveryPoint] = React.useState("");
  const [deliveryInstruction, setDeliveryInstruction] = React.useState("");
  const [deliveryContact, setDeliveryContact] = React.useState("");
  const [deliveryPhone, setDeliveryPhone] = React.useState("");
  const [locationName, setLocationName] = React.useState("Hovedkontor");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [postalPlace, setPostalPlace] = React.useState("");
  const [windowFrom, setWindowFrom] = React.useState("08:30");
  const [windowTo, setWindowTo] = React.useState("10:00");

  // Avtale per dag
  const [days, setDays] = React.useState<DayRow[]>(
    DAYS.map((d) => ({
      key: d.key,
      label: d.label,
      enabled: true,
      tier: d.defaultTier,
      price: d.defaultPrice,
    }))
  );

  // Vilkår
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptCredit, setAcceptCredit] = React.useState(false);

  function setDay<K extends keyof DayRow>(key: DayKey, patch: Pick<DayRow, K>) {
    setDays((prev) =>
      prev.map((r) => (r.key === key ? ({ ...r, ...(patch as any) } as DayRow) : r))
    );
  }

  function validate(): string | null {
    const emp = Number(onlyDigits(employeeCount || "0") || 0);

    if (!companyName.trim()) return "Firmanavn må fylles ut.";
    if (!orgnr.trim() || onlyDigits(orgnr).length < 9) return "Org.nr må fylles ut (9 siffer).";
    if (!emp || Number.isNaN(emp)) return "Antall ansatte må fylles ut.";
    if (emp < 20) return "Minimum 20 ansatte for registrering.";

    if (!adminName.trim()) return "Navn (firma-admin) må fylles ut.";
    if (!adminEmail.trim() || !adminEmail.includes("@")) return "E-post (firma-admin) må være gyldig.";
    if (!adminPhone.trim()) return "Telefon (firma-admin) må fylles ut.";

    if (!password || password.length < 10) return "Passord må være minimum 10 tegn.";
    if (password2 !== password) return "Bekreft passord må være identisk med passordet.";

    if (!deliveryPoint.trim()) return "Leveringspunkt må fylles ut.";
    if (!deliveryInstruction.trim()) return "Leveringsinstruksjon må fylles ut.";
    if (!deliveryContact.trim()) return "Kontaktperson må fylles ut.";
    if (!deliveryPhone.trim()) return "Telefon ved levering må fylles ut.";
    if (!locationName.trim()) return "Lokasjon (navn) må fylles ut.";
    if (!address.trim()) return "Adresse må fylles ut.";
    if (!postalCode.trim()) return "Postnummer må fylles ut.";
    if (!postalPlace.trim()) return "Poststed må fylles ut.";

    const enabledDays = days.filter((d) => d.enabled);
    if (enabledDays.length === 0) return "Velg minst én leveringsdag.";

    for (const d of enabledDays) {
      if (!d.price || Number.isNaN(d.price) || d.price <= 0) {
        return `Pris må være > 0 for ${d.label}.`;
      }
    }

    if (!acceptTerms) return "Du må akseptere avtalevilkårene.";
    if (!acceptCredit) return "Du må samtykke til kredittvurdering.";

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }

    const emp = Number(onlyDigits(employeeCount || "0") || 0);

    const agreementDays: Record<
      DayKey,
      { enabled: boolean; tier: Tier; price_ex_vat: number; price_inc_vat: number }
    > = {
      mon: { enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 },
      tue: { enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 },
      wed: { enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 },
      thu: { enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 },
      fri: { enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 },
    };
    const vat = 0.25;
    for (const d of days) {
      const price_ex_vat = d.enabled ? Number(d.price) : 0;
      agreementDays[d.key] = {
        enabled: d.enabled,
        tier: d.tier,
        price_ex_vat,
        price_inc_vat: d.enabled ? Math.round(price_ex_vat * (1 + vat)) : 0,
      };
    }

    const payload = {
      company_name: companyName.trim(),
      orgnr: onlyDigits(orgnr),
      employee_count: emp,
      full_name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      phone: adminPhone.trim(),
      password,
      password_confirm: password2,
      delivery: {
        where: deliveryPoint.trim(),
        when_note: deliveryInstruction.trim(),
        contact_name: deliveryContact.trim(),
        contact_phone: deliveryPhone.trim(),
        window_from: windowFrom,
        window_to: windowTo,
      },
      location: {
        name: locationName.trim(),
        address: address.trim(),
        postal_code: postalCode.trim(),
        city: postalPlace.trim(),
      },
      agreement: {
        days: agreementDays,
        vat_rate: vat,
      },
      terms: {
        accepted_terms: acceptTerms,
        accepted_credit_check: acceptCredit,
        binding_months: 12,
        notice_months: 3,
      },
    };

    try {
      setSubmitting(true);

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        const msg =
          (typeof data?.message === "string" && data.message) ||
          (typeof data?.error === "string" && data.error) ||
          "Noe gikk galt ved innsending. Prøv igjen.";
        setFormError(msg);
        return;
      }

      const redirectTo =
        (typeof data?.data?.redirectTo === "string" && data.data.redirectTo) || "/pending";
      router.push(redirectTo);
    } catch (err: any) {
      setFormError("Nettverksfeil. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Form error */}
      {formError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-medium">Sjekk registreringen</div>
          <div className="mt-1">{formError}</div>
        </div>
      ) : null}

      {/* Firma */}
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Firma</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Firmanavn <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Dette brukes til å sette riktige rammer for bedriften.</div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Org.nr <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={orgnr}
              onChange={(e) => setOrgnr(onlyDigits(e.target.value))}
              placeholder="9 siffer"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Hvor mange ansatte? <span className="text-red-600">*</span>
            </label>
            <input
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(onlyDigits(e.target.value))}
              placeholder="Minst 20"
            />
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Brukes kun for å tilpasse avtalen – kan endres senere.</div>
          </div>
        </div>
      </section>

      {/* Firma-admin */}
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Firma-admin</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Navn <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              E-post <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              autoComplete="email"
            />
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Vi bruker e-post kun til innlogging og viktig systeminformasjon.</div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Telefon <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Passord <span className="text-red-600">*</span>
            </label>
            <div className="mt-2 flex overflow-hidden rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white">
              <input
                type={showPw ? "text" : "password"}
                className="w-full px-3 py-2 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="px-3 text-sm font-semibold text-[rgb(var(--lp-muted))]"
                onClick={() => setShowPw((v) => !v)}
              >
                Vis
              </button>
            </div>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Minimum 8 tegn.</div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Bekreft passord <span className="text-red-600">*</span>
            </label>
            <div className="mt-2 flex overflow-hidden rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white">
              <input
                type={showPw2 ? "text" : "password"}
                className="w-full px-3 py-2 outline-none"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="px-3 text-sm font-semibold text-[rgb(var(--lp-muted))]"
                onClick={() => setShowPw2((v) => !v)}
              >
                Vis
              </button>
            </div>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Må være identisk med passordet.</div>
          </div>
        </div>
      </section>

      {/* Levering */}
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Levering</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">
              Leveringspunkt <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={deliveryPoint}
              onChange={(e) => setDeliveryPoint(e.target.value)}
              placeholder="F.eks. resepsjon, varemottak, bakinngang, etasje"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Leveringsinstruksjon <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={deliveryInstruction}
              onChange={(e) => setDeliveryInstruction(e.target.value)}
              placeholder="F.eks. ring ved ankomst, bruk porttelefon, kontakt resepsjon"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Kontaktperson <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={deliveryContact}
              onChange={(e) => setDeliveryContact(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Telefon ved levering <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Lokasjon (navn) <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Adresse <span className="text-red-600">*</span>
            </label>
            <input
              className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">
                Postnummer <span className="text-red-600">*</span>
              </label>
              <input
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
                value={postalCode}
                onChange={(e) => setPostalCode(onlyDigits(e.target.value))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Poststed <span className="text-red-600">*</span>
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.25)]"
                value={postalPlace}
                onChange={(e) => setPostalPlace(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">
                Leveringsvindu fra <span className="text-red-600">*</span>
              </label>
              <input
                type="time"
                className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none"
                value={windowFrom}
                onChange={(e) => setWindowFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Leveringsvindu til <span className="text-red-600">*</span>
              </label>
              <input
                type="time"
                className="mt-2 w-full rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 outline-none"
                value={windowTo}
                onChange={(e) => setWindowTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Avtale per dag */}
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Avtale (velg nivå per dag)</h2>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Velg hvilke dager dere ønsker levering, og om dagen er Basis eller Luxus. Pris per kuvert er eks. mva.
        </p>

        <div className="mt-4 space-y-3">
          {days.map((d) => (
            <div
              key={d.key}
              className="flex flex-col gap-3 rounded-2xl border border-[rgba(var(--lp-border),0.9)] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) => setDay(d.key, { enabled: e.target.checked } as any)}
                  className="h-5 w-5"
                />
                <div className="font-medium">{d.label}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => setDay(d.key, { tier: "BASIS", price: d.price || 90 } as any)}
                  className={`lp-motion-btn rounded-xl border px-4 py-2 text-sm font-semibold ${
                    d.tier === "BASIS"
                      ? "border-transparent bg-black text-white"
                      : "border-[rgba(var(--lp-border),0.9)] bg-white text-[rgb(var(--lp-text))]"
                  }`}
                  aria-pressed={d.tier === "BASIS"}
                  disabled={!d.enabled}
                >
                  Basis
                </button>

                <button
                  type="button"
                  onClick={() => setDay(d.key, { tier: "LUXUS", price: d.price || 130 } as any)}
                  className={`lp-motion-btn rounded-xl border px-4 py-2 text-sm font-semibold ${
                    d.tier === "LUXUS"
                      ? "border-transparent bg-black text-white"
                      : "border-[rgba(var(--lp-border),0.9)] bg-white text-[rgb(var(--lp-text))]"
                  }`}
                  aria-pressed={d.tier === "LUXUS"}
                  disabled={!d.enabled}
                >
                  Luxus
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-[rgb(var(--lp-muted))]">Pris *</span>
                  <input
                    inputMode="numeric"
                    value={String(d.price)}
                    onChange={(e) => {
                      const n = Number(onlyDigits(e.target.value || "0") || 0);
                      setDay(d.key, { price: clampInt(n, 0, 9999) } as any);
                    }}
                    disabled={!d.enabled}
                    className="w-24 rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <span className="text-sm text-[rgb(var(--lp-muted))]">kr/kuvert eks. mva</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lp-glass-surface mt-4 rounded-card p-4 text-sm">
          <div className="font-medium">Hva skjer etter registrering?</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[rgb(var(--lp-muted))]">
            <li>Bedriften opprettes med faste rammer</li>
            <li>Du får tilgang som admin</li>
            <li>Ansatte kan legges til når du er klar</li>
            <li>Lunsj bestilles med cut-off kl. 08:00</li>
          </ul>
        </div>
      </section>

      {/* Vilkår / samtykke */}
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span className="text-sm">
              Jeg har lest og aksepterer <Link className="underline" href="/vilkar">avtalevilkårene</Link> <span className="text-red-600">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={acceptCredit}
              onChange={(e) => setAcceptCredit(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            <span className="text-sm">
              Jeg samtykker til kredittvurdering av firmaet (utføres i Tripletex) <span className="text-red-600">*</span>
            </span>
          </label>

          {/* ✅ Correct contract + VAT */}
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Avtalen har 12 måneders bindingstid. Oppsigelse: 3 mnd før utløpt bindingstid. Alle priser faktureres eks. mva.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="lp-btn lp-btn-primary lp-btn-block lp-neon"
          >
            {isSubmitting ? "Oppretter..." : "Opprett bedrift"}
          </button>

          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Én sannhetskilde. Ingen manuelle unntak. Full sporbarhet.
          </div>
        </div>
      </section>
    </form>
  );
}
