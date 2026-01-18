"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type PlanTier = "BASIS" | "LUXUS";

type DayPlan = {
  enabled: boolean; // kunden vil ha levering denne dagen
  tier: PlanTier; // BASIS/LUXUS
  priceExVat: number; // pris pr kuvert eks mva (UI-tekst under er justert til inkl. mva)
};

type DeliveryWindow = {
  from: string; // "08:30"
  to: string; // "10:00"
};

type FormState = {
  // Firma (alt obligatorisk)
  companyName: string;
  orgnr: string;

  // Firma-admin (alt obligatorisk)
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
  passwordConfirm: string;

  // Levering (alt obligatorisk)
  deliveryWhere: string;
  deliveryWhenNote: string;
  deliveryContactName: string;
  deliveryContactPhone: string;

  locationName: string;
  address: string;
  postalCode: string;
  city: string;

  deliveryWindow: DeliveryWindow;
  days: Record<DayKey, DayPlan>;
};

function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

function isValidTimeHHMM(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

function dayLabel(day: DayKey) {
  return { mon: "Mandag", tue: "Tirsdag", wed: "Onsdag", thu: "Torsdag", fri: "Fredag" }[day];
}

// ===== Avtalevilkår (versioned) =====
const TERMS_VERSION = "v1.0";
const TERMS_UPDATED_AT = "2026-01-16";

function formatCurrencyNOK(value: number) {
  // No Intl currency here to keep it stable/fast in all environments
  return `${Math.round(value)} kr`;
}

export default function OnboardingForm() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Terms / consent
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCreditConsent, setAcceptedCreditConsent] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [form, setForm] = useState<FormState>({
    companyName: "",
    orgnr: "",

    adminName: "",
    adminEmail: "",
    adminPhone: "",
    password: "",
    passwordConfirm: "",

    deliveryWhere: "",
    deliveryWhenNote: "",
    deliveryContactName: "",
    deliveryContactPhone: "",

    locationName: "Hovedkontor",
    address: "",
    postalCode: "",
    city: "",

    deliveryWindow: { from: "08:30", to: "10:00" },

    days: {
      mon: { enabled: true, tier: "BASIS", priceExVat: 90 },
      tue: { enabled: true, tier: "BASIS", priceExVat: 90 },
      wed: { enabled: true, tier: "BASIS", priceExVat: 90 },
      thu: { enabled: true, tier: "BASIS", priceExVat: 90 },
      fri: { enabled: true, tier: "LUXUS", priceExVat: 130 },
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function setDay(day: DayKey, patch: Partial<DayPlan>) {
    setForm((p) => ({
      ...p,
      days: {
        ...p.days,
        [day]: { ...p.days[day], ...patch },
      },
    }));
  }

  function validate(): string | null {
    // Firma
    if (!form.companyName.trim()) return "Firmanavn er obligatorisk.";
    if (!form.orgnr.trim()) return "Org.nr er obligatorisk.";

    // Admin
    if (!form.adminName.trim()) return "Firma-admin: Navn er obligatorisk.";
    if (!form.adminEmail.trim()) return "Firma-admin: E-post er obligatorisk.";
    if (!form.adminPhone.trim()) return "Firma-admin: Telefon er obligatorisk.";

    if (!form.password) return "Passord er obligatorisk.";
    if (form.password.length < 8) return "Passord må være minimum 8 tegn.";
    if (!form.passwordConfirm) return "Bekreft passord er obligatorisk.";
    if (form.password !== form.passwordConfirm) return "Passordene må være nøyaktig like.";

    // Levering
    if (!form.deliveryWhere.trim()) return "Levering: Leveringspunkt er obligatorisk.";
    if (!form.deliveryWhenNote.trim()) return "Levering: Leveringsinstruksjon er obligatorisk.";
    if (!form.deliveryContactName.trim()) return "Levering: Kontaktperson er obligatorisk.";
    if (!form.deliveryContactPhone.trim()) return "Levering: Telefon ved levering er obligatorisk.";
    if (!form.address.trim()) return "Levering: Adresse er obligatorisk.";
    if (!form.postalCode.trim()) return "Levering: Postnummer er obligatorisk.";
    if (!form.city.trim()) return "Levering: Poststed er obligatorisk.";

    if (!form.deliveryWindow.from || !form.deliveryWindow.to) {
      return "Levering: Leveringsvindu (fra/til) er obligatorisk.";
    }
    if (!isValidTimeHHMM(form.deliveryWindow.from) || !isValidTimeHHMM(form.deliveryWindow.to)) {
      return "Levering: Leveringsvindu må være på format HH:MM (f.eks. 08:30).";
    }

    // Avtale: minst 1 dag aktiv + pris > 0
    const enabledDays = (Object.keys(form.days) as DayKey[]).filter((d) => form.days[d].enabled);
    if (enabledDays.length === 0) return "Avtale: Velg minst én leveringsdag.";

    for (const d of enabledDays) {
      const dp = form.days[d];
      if (!dp.priceExVat || dp.priceExVat <= 0) {
        return `Avtale: Pris pr kuvert må være > 0 for ${dayLabel(d)}.`;
      }
    }

    // Terms / consent
    if (!acceptedTerms) return "Du må akseptere avtalevilkårene for å fortsette.";
    if (!acceptedCreditConsent) return "Du må samtykke til kredittvurdering for å inngå avtalen.";

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);

    try {
      // 1) Opprett firma-admin i Supabase Auth (telefon lagres i metadata)
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.adminEmail.trim(),
        password: form.password,
        options: {
          data: {
            name: form.adminName.trim(),
            phone: form.adminPhone.trim(),
            role: "company_admin",
          },
        },
      });

      if (signUpErr) throw new Error(signUpErr.message);

      const session = data.session;
      if (!session) {
        throw new Error(
          "Kontoen er opprettet. Sjekk e-post for bekreftelse før du kan fullføre registreringen."
        );
      }

      const nowISO = new Date().toISOString();

      // 2) Fullfør onboarding i DB (server)
      const resp = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          orgnr: form.orgnr.trim(),

          adminPhone: form.adminPhone.trim(),

          locationName: form.locationName.trim(),
          address: form.address.trim(),
          postalCode: form.postalCode.trim(),
          city: form.city.trim(),

          delivery: {
            where: form.deliveryWhere.trim(),
            whenNote: form.deliveryWhenNote.trim(),
            contactName: form.deliveryContactName.trim(),
            contactPhone: form.deliveryContactPhone.trim(),
            windowFrom: form.deliveryWindow.from,
            windowTo: form.deliveryWindow.to,
          },

          agreement: {
            days: form.days,
            billingPricesIncludeVat: true, // vi fakturerer inkl mva
          },

          terms: {
            version: TERMS_VERSION,
            updatedAt: TERMS_UPDATED_AT,
            accepted: true,
            acceptedAt: nowISO,
            creditConsent: true,
            creditConsentAt: nowISO,
            creditCheckSystem: "Tripletex",
            billingPricesIncludeVat: true,
            bindingMonths: 12,
            noticeMonths: 3,
          },
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Ukjent feil ved registrering.");

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Noe gikk galt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          ) : null}

          {/* FIRMA */}
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Firma</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Firmanavn *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Org.nr *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.orgnr}
                  onChange={(e) => set("orgnr", e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          {/* FIRMA-ADMIN */}
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Firma-admin</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Navn *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.adminName}
                  onChange={(e) => set("adminName", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">E-post *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.adminEmail}
                  onChange={(e) => set("adminEmail", e.target.value)}
                  type="email"
                  required
                />
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Telefon *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.adminPhone}
                  onChange={(e) => set("adminPhone", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Passord *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
                <span className="text-xs text-slate-500">Minimum 8 tegn.</span>
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Bekreft passord *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.passwordConfirm}
                  onChange={(e) => set("passwordConfirm", e.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
                <span className="text-xs text-slate-500">Må være identisk med passordet.</span>
              </label>
            </div>
          </section>

          {/* LEVERING */}
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Levering</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Leveringspunkt *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.deliveryWhere}
                  onChange={(e) => set("deliveryWhere", e.target.value)}
                  placeholder="F.eks. resepsjon, varemottak, bakinngang, etasje"
                  required
                />
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Leveringsinstruksjon *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.deliveryWhenNote}
                  onChange={(e) => set("deliveryWhenNote", e.target.value)}
                  placeholder="F.eks. ring ved ankomst, bruk porttelefon, kontakt resepsjon"
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Kontaktperson *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.deliveryContactName}
                  onChange={(e) => set("deliveryContactName", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Telefon ved levering *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.deliveryContactPhone}
                  onChange={(e) => set("deliveryContactPhone", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Lokasjon (navn) *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.locationName}
                  onChange={(e) => set("locationName", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">Adresse *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Postnummer *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Poststed *</span>
                <input
                  className="rounded-xl border p-3"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                />
              </label>

              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Leveringsvindu fra *</span>
                  <input
                    className="rounded-xl border p-3"
                    value={form.deliveryWindow.from}
                    onChange={(e) =>
                      set("deliveryWindow", { ...form.deliveryWindow, from: e.target.value })
                    }
                    placeholder="08:30"
                    required
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm text-slate-600">Leveringsvindu til *</span>
                  <input
                    className="rounded-xl border p-3"
                    value={form.deliveryWindow.to}
                    onChange={(e) =>
                      set("deliveryWindow", { ...form.deliveryWindow, to: e.target.value })
                    }
                    placeholder="10:00"
                    required
                  />
                </label>
              </div>
            </div>
          </section>

          {/* AVTALE */}
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Avtale (velg nivå per dag)</h2>
            <p className="text-sm text-slate-600">
              Velg hvilke dager dere ønsker levering, og om dagen er Basis eller Luxus. Pris pr kuvert er{" "}
              <strong>inkl. mva</strong>.
            </p>

            <div className="grid gap-3">
              {(Object.keys(form.days) as DayKey[]).map((d) => {
                const dp = form.days[d];
                return (
                  <div key={d} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dp.enabled}
                          onChange={(e) => setDay(d, { enabled: e.target.checked })}
                        />
                        <span className="font-medium">{dayLabel(d)}</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!dp.enabled}
                          onClick={() => setDay(d, { tier: "BASIS", priceExVat: 90 })}
                          className={`rounded-xl border px-3 py-2 text-sm disabled:opacity-50 ${
                            dp.tier === "BASIS" ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          Basis
                        </button>
                        <button
                          type="button"
                          disabled={!dp.enabled}
                          onClick={() => setDay(d, { tier: "LUXUS", priceExVat: 130 })}
                          className={`rounded-xl border px-3 py-2 text-sm disabled:opacity-50 ${
                            dp.tier === "LUXUS" ? "bg-black text-white" : "bg-white"
                          }`}
                        >
                          Luxus
                        </button>

                        <label className="ml-2 flex items-center gap-2 text-sm">
                          <span className="text-slate-600">Pris *</span>
                          <input
                            disabled={!dp.enabled}
                            className="w-28 rounded-xl border p-2 disabled:opacity-50"
                            type="number"
                            min={1}
                            value={dp.priceExVat}
                            onChange={(e) => setDay(d, { priceExVat: Number(e.target.value || 0) })}
                          />
                          <span className="text-slate-600">kr/kuvert inkl. mva</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* TERMS + CREDIT CONSENT */}
          <section className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>
                Jeg har lest og aksepterer{" "}
                <button
                  type="button"
                  className="underline opacity-90"
                  onClick={() => setShowTermsModal(true)}
                >
                  avtalevilkårene
                </button>{" "}
                *
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedCreditConsent}
                onChange={(e) => setAcceptedCreditConsent(e.target.checked)}
              />
              <span>Jeg samtykker til kredittvurdering av firmaet (utføres i Tripletex) *</span>
            </label>

            <p className="text-xs opacity-70">
              Avtalen har <strong>12 måneders bindingstid</strong>. Oppsigelse: <strong>3 måneder</strong>{" "}
              etter bindingstid. Alle priser faktureres <strong>inkl. mva</strong>.
            </p>
          </section>

          <div className="flex items-center justify-between gap-3">
            <button disabled={loading} className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-60">
              {loading ? "Registrerer..." : "Opprett firmakonto"}
            </button>

            <a className="text-sm underline opacity-80" href="/login">
              Har du konto? Logg inn
            </a>
          </div>
        </div>
      </form>

      {/* Terms Modal (versioned + PDF link) */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Avtalevilkår</h2>
                <p className="text-sm opacity-70">
                  Versjon: <strong>{TERMS_VERSION}</strong> • Sist oppdatert:{" "}
                  <strong>{TERMS_UPDATED_AT}</strong>
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setShowTermsModal(false)}
              >
                Lukk
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-5 text-sm leading-6">
              <h3 className="font-semibold">1. Parter</h3>
              <p>
                Avtalen inngås mellom Lunchportalen (Leverandøren) og Kunden (juridisk enhet som registrerer avtalen).
              </p>

              <h3 className="mt-4 font-semibold">2. Avtaleomfang</h3>
              <p>
                Leverandøren leverer tilgang til Lunchportalen og tilhørende tjenester i henhold til valgt avtale
                (Basis/Luxus per dag) slik den er registrert i systemet.
              </p>

              <h3 className="mt-4 font-semibold">3. Avtaleperiode og bindingstid</h3>
              <p>
                Avtalen har <strong>12 (tolv) måneders bindingstid</strong> fra oppstart. Etter endt bindingstid løper
                avtalen videre med <strong>3 (tre) måneders oppsigelsestid</strong>, regnet til utløpet av en måned.
              </p>

              <h3 className="mt-4 font-semibold">4. Priser og fakturering</h3>
              <p>
                Pris per kuvert følger avtalen slik den er registrert i systemet. <strong>Alle priser faktureres inkl. mva</strong>,
                med mindre annet er skriftlig avtalt. Fakturering skjer i henhold til Leverandørens betalingsbetingelser.
              </p>

              <h3 className="mt-4 font-semibold">5. Levering og endringer</h3>
              <p>
                Levering skjer i henhold til leveringspunkt, leveringsinstruksjon og leveringsvindu registrert i systemet.
                Endringer og avbestillinger følger gjeldende frister og systemregler.
              </p>

              <h3 className="mt-4 font-semibold">6. Kredittvurdering (Tripletex)</h3>
              <p>
                Kunden samtykker til at Leverandøren kan gjennomføre kredittvurdering av virksomheten i forbindelse med
                avtaleinngåelse. Kredittvurderingen utføres i Leverandørens regnskapssystem <strong>Tripletex</strong>
                (eventuelt via tilknyttet kredittopplysningsleverandør). Negativ vurdering kan medføre avslag eller krav om sikkerhet.
              </p>

              <h3 className="mt-4 font-semibold">7. Mislighold</h3>
              <p>
                Ved vesentlig mislighold kan Leverandøren suspendere leveranser eller heve avtalen i tråd med gjeldende rett.
              </p>

              <h3 className="mt-4 font-semibold">8. Ansvarsbegrensning</h3>
              <p>
                Leverandørens ansvar er begrenset til direkte tap og oppad begrenset til samlet vederlag for siste 12 måneder,
                så langt loven tillater.
              </p>

              <h3 className="mt-4 font-semibold">9. Force majeure</h3>
              <p>
                Partene er fritatt for ansvar ved forhold utenfor rimelig kontroll som hindrer oppfyllelse av avtalen.
              </p>

              <h3 className="mt-4 font-semibold">10. Personvern</h3>
              <p>
                Behandling av personopplysninger skjer i samsvar med gjeldende personvernerklæring og GDPR.
              </p>

              <h3 className="mt-4 font-semibold">11. Endringer i vilkår</h3>
              <p>
                Leverandøren kan oppdatere vilkårene med 30 dagers varsel. Vesentlige endringer krever Kundens aksept dersom lov krever det.
              </p>

              <h3 className="mt-4 font-semibold">12. Lovvalg og verneting</h3>
              <p>
                Avtalen er underlagt norsk rett. Tvister søkes løst i minnelighet, ellers ved ordinær domstol med Leverandørens verneting.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className="rounded-xl border px-4 py-2 text-sm"
                  href={`/api/onboarding/terms-pdf?version=${encodeURIComponent(TERMS_VERSION)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Åpne PDF-versjon
                </a>

                <button
                  type="button"
                  className="rounded-xl bg-black px-4 py-2 text-sm text-white"
                  onClick={() => setShowTermsModal(false)}
                >
                  Jeg forstår
                </button>
              </div>

              <p className="mt-4 text-xs opacity-70">
                (Visning: {TERMS_VERSION}) • Eksempelpris i avtalen: Basis {formatCurrencyNOK(90)} / Luxus {formatCurrencyNOK(130)}.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
