"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  parseRegistrationPlanPayload,
  REGISTRATION_WEEKDAYS,
  type RegistrationWeekday,
  type WeekdayMealTiers,
} from "@/lib/registration/weekdayMealTiers";

type RegisterResponse = {
  ok?: boolean;
  rid?: string;
  companyId?: string;
  registrationId?: string;
  persisted?: boolean;
  message?: string;
  receipt?: { message?: string; createdAt?: string };
  error?: string | { code?: string; detail?: unknown };
};

type CompanyRegistrationFormProps = {
  blocked?: boolean;
  blockedReason?: string | null;
};

export type CompanyRegistrationFormState = {
  companyName: string;
  orgnr: string;
  employeesCount: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  postalCode: string;
  postalCity: string;
  confirmAuthority: boolean;
  weekdayTiers: WeekdayMealTiers;
  deliveryWindowFrom: string;
  deliveryWindowTo: string;
  termsBindingMonths: string;
  termsNoticeMonths: string;
};

const DAY_LABELS: Record<RegistrationWeekday, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

export function onlyDigits(value: string) {
  return value.replace(/[^\d]/g, "");
}

function asInt(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `reg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function validateCompanyRegistrationForm(state: CompanyRegistrationFormState): string | null {
  if (!state.companyName.trim()) return "Firmanavn må fylles ut.";
  if (onlyDigits(state.orgnr).length !== 9) return "Organisasjonsnummer må være 9 siffer.";

  const employees = asInt(state.employeesCount);
  if (!Number.isFinite(employees) || employees < 20) {
    return "Firmaet må ha minst 20 ansatte.";
  }

  if (!state.contactName.trim()) return "Kontaktperson må fylles ut.";
  if (!isEmail(state.contactEmail.trim().toLowerCase())) return "Gyldig e-post må fylles ut.";
  if (!onlyDigits(state.contactPhone)) return "Telefon må fylles ut.";
  if (!state.addressLine.trim()) return "Adresse må fylles ut.";
  if (!/^\d{4}$/.test(onlyDigits(state.postalCode))) return "Postnummer må være 4 siffer.";
  if (!state.postalCity.trim()) return "Poststed må fylles ut.";
  if (!state.confirmAuthority) return "Du må bekrefte fullmakt før innsending.";

  const plan = parseRegistrationPlanPayload({
    weekday_meal_tiers: state.weekdayTiers,
    delivery_window_from: state.deliveryWindowFrom,
    delivery_window_to: state.deliveryWindowTo,
    terms_binding_months: Number(state.termsBindingMonths),
    terms_notice_months: Number(state.termsNoticeMonths),
  });
  if (plan.ok === false) return plan.message;

  return null;
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-2xl border border-[#e8dfcf] bg-white px-4 py-3 text-base text-[#1f1f1f] shadow-[0_1px_0_rgba(20,20,20,0.03)] outline-none transition placeholder:text-[#a69a86] focus:border-[#d7ad42] focus:ring-4 focus:ring-[#f3d77d]/30";

const labelClass = "text-sm font-medium text-[#34302a]";
const sectionClass = "border-t border-[#eee5d6] pt-7";
const sectionKickerClass = "text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]";
const sectionTitleClass = "mt-2 text-lg font-semibold text-[#181715]";
const sectionTextClass = "mt-1 text-sm leading-6 text-[#756b5c]";

export default function CompanyRegistrationForm({ blocked = false, blockedReason = null }: CompanyRegistrationFormProps) {
  const router = useRouter();

  const defaultTiers: WeekdayMealTiers = {
    mon: "BASIS",
    tue: "BASIS",
    wed: "BASIS",
    thu: "BASIS",
    fri: "BASIS",
  };

  const [state, setState] = useState<CompanyRegistrationFormState>({
    companyName: "",
    orgnr: "",
    employeesCount: "20",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    addressLine: "",
    postalCode: "",
    postalCity: "",
    confirmAuthority: false,
    weekdayTiers: defaultTiers,
    deliveryWindowFrom: "",
    deliveryWindowTo: "",
    termsBindingMonths: "",
    termsNoticeMonths: "",
  });

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RegisterResponse | null>(null);

  const validationError = useMemo(() => validateCompanyRegistrationForm(state), [state]);
  const canSubmit = !blocked && !pending && !validationError;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReceipt(null);

    if (blocked) {
      setError(blockedReason || "Registrering er midlertidig blokkert.");
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(true);

    try {
      const res = await fetch("/api/public/register-company", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": makeIdempotencyKey(),
        },
        cache: "no-store",
        body: JSON.stringify({
          orgnr: onlyDigits(state.orgnr),
          company_name: state.companyName.trim(),
          employee_count: asInt(state.employeesCount),
          contact_name: state.contactName.trim(),
          contact_email: state.contactEmail.trim().toLowerCase(),
          contact_phone: onlyDigits(state.contactPhone),
          address_line: state.addressLine.trim(),
          postal_code: onlyDigits(state.postalCode),
          postal_city: state.postalCity.trim(),
          consent_accepted: true,
          weekday_meal_tiers: state.weekdayTiers,
          delivery_window_from: state.deliveryWindowFrom.trim(),
          delivery_window_to: state.deliveryWindowTo.trim(),
          terms_binding_months: Number(state.termsBindingMonths),
          terms_notice_months: Number(state.termsNoticeMonths),
        }),
      });

      const json = (await res.json().catch(() => null)) as RegisterResponse | null;
      if (!json) {
        setError("Uventet svar fra server.");
        return;
      }

      setReceipt(json);

      if (!res.ok || !json.ok || json.persisted !== true) {
        setError(json.message || "Registreringen feilet.");
        return;
      }

      const companyId = String(json.companyId ?? json.registrationId ?? "").trim();
      const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
      router.push(`/registrering/mottatt${query}`);
    } catch {
      setError("Nettverksfeil. Prøv igjen.");
    } finally {
      setPending(false);
    }
  }

  const employeesTooLow = Number.isFinite(asInt(state.employeesCount)) && asInt(state.employeesCount) < 20;
  const selectedTierValues = Object.values(state.weekdayTiers);
  const lunchModel = selectedTierValues.every((tier) => tier === "LUXUS")
    ? "Luxus"
    : selectedTierValues.every((tier) => tier === "BASIS")
      ? "Basis"
      : "Blandet plan";
  const deliveryWindow =
    state.deliveryWindowFrom || state.deliveryWindowTo
      ? `${state.deliveryWindowFrom || "Fra"} - ${state.deliveryWindowTo || "Til"}`
      : "Ikke valgt";
  const termsSummary =
    state.termsBindingMonths || state.termsNoticeMonths
      ? `${state.termsBindingMonths || "0"} mnd binding / ${state.termsNoticeMonths || "0"} mnd oppsigelse`
      : "Ikke valgt";
  const summaryStatus = !validationError ? "Klar til innsending" : "Mangler påkrevd info";
  const sidebarItems = ["Dashboard", "Bestillinger", "Leveranser", "Lunsjplan", "Faktura", "Innstillinger"];
  const steps = ["Avtale", "Bedrift", "Kontakt", "Bekreftelse"];

  return (
    <form onSubmit={onSubmit} className="w-full" aria-busy={pending ? "true" : "false"}>
      <section className="rounded-[2rem] border border-[#eadfce] bg-[#fbf7ef] shadow-[0_30px_90px_rgba(63,47,24,0.12)]">
        <div className="grid min-w-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="border-b border-[#eadfce] bg-[#f5ecdc] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 rounded-2xl bg-white shadow-sm">
                <Image
                  src="/brand/LP-logo-uten-bakgrunn.png"
                  alt="Lunchportalen"
                  fill
                  sizes="48px"
                  className="object-contain p-1.5"
                  priority={false}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#181715]">Lunchportalen</p>
                <p className="text-xs text-[#7a705f]">Onboarding</p>
              </div>
            </div>

            <div className="mt-6 hidden gap-2 lg:grid" aria-label="Visuell onboarding-navigasjon">
              {sidebarItems.map((item) => {
                const active = item === "Innstillinger";
                return (
                  <div
                    key={item}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm transition",
                      active ? "bg-[#181715] font-semibold text-white shadow-sm" : "text-[#6f6657]",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                  >
                    {item}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Visuell onboarding-navigasjon">
              {sidebarItems.map((item) => (
                <span
                  key={item}
                  className={[
                    "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium",
                    item === "Innstillinger"
                      ? "border-[#181715] bg-[#181715] text-white"
                      : "border-[#e3d7c3] bg-white/70 text-[#6f6657]",
                  ].join(" ")}
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-7 rounded-3xl border border-white/70 bg-white/55 p-4 text-sm text-[#6f6657]">
              <p className="font-semibold text-[#25231f]">Rolig start</p>
              <p className="mt-2 leading-6">Vi bruker informasjonen til å klargjøre en trygg bedriftsavtale.</p>
            </div>
          </aside>

          <div className="min-w-0 bg-[#fffdf9] p-4 sm:p-6 xl:p-8">
            <div className="rounded-[1.6rem] bg-white p-4 shadow-[0_18px_60px_rgba(36,28,18,0.08)] sm:p-6 xl:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                <main className="min-w-0 flex-1">
                  <div className="flex flex-col gap-5 border-b border-[#eee5d6] pb-7">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7a32]">Firmaregistrering</p>
                      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#181715] sm:text-3xl">
                        Opprett ny lunsjordning
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#756b5c]">
                        Fyll ut firmainfo og kontaktperson. Registreringen blir lagret når alle felt er gyldige.
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      {steps.map((step, index) => {
                        const active = index === 0;
                        return (
                          <div
                            key={step}
                            className={[
                              "flex items-center gap-3 rounded-2xl border px-3 py-3",
                              active ? "border-[#e0b64d] bg-[#fff7df]" : "border-[#eee5d6] bg-[#fbf8f1]",
                            ].join(" ")}
                            aria-current={active ? "step" : undefined}
                          >
                            <span
                              className={[
                                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                                active ? "bg-[#f1c75b] text-[#181715]" : "bg-white text-[#8d806d]",
                              ].join(" ")}
                            >
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-[#34302a]">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-8 pt-7">
                    <div>
                      <p className={sectionKickerClass}>Avtale</p>
                      <h3 className={sectionTitleClass}>Avtaledetaljer / Lunsjplan</h3>
                      <p className={sectionTextClass}>
                        Lunsjplan (Basis = 3 valg, Luxus = 6 valg). Velg nivå per ukedag og ønsket leveringsvindu.
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {REGISTRATION_WEEKDAYS.map((d) => (
              <label key={d} className={labelClass}>
                {DAY_LABELS[d]} *
                <select
                  className={inputClass}
                  value={state.weekdayTiers[d]}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      weekdayTiers: {
                        ...prev.weekdayTiers,
                        [d]: e.target.value === "LUXUS" ? "LUXUS" : "BASIS",
                      },
                    }))
                  }
                >
                  <option value="BASIS">Basis</option>
                  <option value="LUXUS">Luxus</option>
                </select>
              </label>
            ))}
                      </div>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Levering fra (HH:MM) *
              <input
                className={inputClass}
                placeholder="11:00"
                value={state.deliveryWindowFrom}
                onChange={(e) => setState((prev) => ({ ...prev, deliveryWindowFrom: e.target.value }))}
              />
            </label>
            <label className={labelClass}>
              Levering til (HH:MM) *
              <input
                className={inputClass}
                placeholder="13:00"
                value={state.deliveryWindowTo}
                onChange={(e) => setState((prev) => ({ ...prev, deliveryWindowTo: e.target.value }))}
              />
            </label>
            <label className={labelClass}>
              Binding (måneder) *
              <input
                inputMode="numeric"
                className={inputClass}
                value={state.termsBindingMonths}
                onChange={(e) => setState((prev) => ({ ...prev, termsBindingMonths: onlyDigits(e.target.value) }))}
              />
            </label>
            <label className={labelClass}>
              Oppsigelse (måneder) *
              <input
                inputMode="numeric"
                className={inputClass}
                value={state.termsNoticeMonths}
                onChange={(e) => setState((prev) => ({ ...prev, termsNoticeMonths: onlyDigits(e.target.value) }))}
              />
            </label>
                      </div>
                    </div>

                    <div className={sectionClass}>
                      <p className={sectionKickerClass}>Bedrift</p>
                      <h3 className={sectionTitleClass}>Firmaopplysninger</h3>
                      <p className={sectionTextClass}>Grunnlaget for avtalen og riktig bedriftsidentitet.</p>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Firmanavn *
            <input
              className={inputClass}
              value={state.companyName}
              onChange={(e) => setState((prev) => ({ ...prev, companyName: e.target.value }))}
              autoComplete="organization"
            />
          </label>

          <label className={labelClass}>
            Organisasjonsnummer *
            <input
              className={inputClass}
              inputMode="numeric"
              value={state.orgnr}
              onChange={(e) => setState((prev) => ({ ...prev, orgnr: onlyDigits(e.target.value) }))}
              placeholder="9 siffer"
            />
          </label>

          <label className={labelClass}>
            Antall ansatte *
            <input
              className={inputClass}
              inputMode="numeric"
              value={state.employeesCount}
              onChange={(e) => setState((prev) => ({ ...prev, employeesCount: onlyDigits(e.target.value) }))}
              aria-invalid={employeesTooLow ? "true" : "false"}
            />
            {employeesTooLow ? (
              <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Firmaet må ha minst 20 ansatte for å registrere seg.
              </div>
            ) : null}
          </label>
                      </div>
                    </div>

                    <div className={sectionClass}>
                      <p className={sectionKickerClass}>Kontakt</p>
                      <h3 className={sectionTitleClass}>Kontaktperson</h3>
                      <p className={sectionTextClass}>Personen som bekrefter registreringen på vegne av firmaet.</p>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Kontaktperson *
            <input
              className={inputClass}
              value={state.contactName}
              onChange={(e) => setState((prev) => ({ ...prev, contactName: e.target.value }))}
            />
          </label>

          <label className={labelClass}>
            E-post *
            <input
              type="email"
              className={inputClass}
              value={state.contactEmail}
              onChange={(e) => setState((prev) => ({ ...prev, contactEmail: e.target.value }))}
            />
          </label>

          <label className={labelClass}>
            Telefon *
            <input
              className={inputClass}
              value={state.contactPhone}
              onChange={(e) => setState((prev) => ({ ...prev, contactPhone: onlyDigits(e.target.value) }))}
            />
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            Adresse *
            <input
              className={inputClass}
              value={state.addressLine}
              onChange={(e) => setState((prev) => ({ ...prev, addressLine: e.target.value }))}
            />
          </label>

          <label className={labelClass}>
            Postnummer *
            <input
              className={inputClass}
              inputMode="numeric"
              value={state.postalCode}
              onChange={(e) => setState((prev) => ({ ...prev, postalCode: onlyDigits(e.target.value) }))}
            />
          </label>

          <label className={labelClass}>
            Poststed *
            <input
              className={inputClass}
              value={state.postalCity}
              onChange={(e) => setState((prev) => ({ ...prev, postalCity: e.target.value }))}
            />
          </label>
                      </div>
                    </div>

                    <div className={sectionClass}>
                      <p className={sectionKickerClass}>Bekreftelse</p>
                      <h3 className={sectionTitleClass}>Fullmakt og innsending</h3>
                      <label className="mt-5 flex items-start gap-4 rounded-3xl border border-[#eadfce] bg-[#fbf7ef] p-4 text-sm leading-6 text-[#34302a]">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded border-[#cdbfaa] text-[#d7ad42] accent-[#d7ad42]"
            checked={state.confirmAuthority}
            onChange={(e) => setState((prev) => ({ ...prev, confirmAuthority: e.target.checked }))}
          />
          <span>Jeg bekrefter at jeg registrerer på vegne av firmaet.</span>
        </label>

        {blocked ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {blockedReason || "Registrering er midlertidig blokkert."}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {receipt?.ok ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">
            {receipt.receipt?.message || "Registreringen er mottatt."}</div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 min-h-14 w-full rounded-2xl bg-[#f1c75b] px-5 py-4 text-base font-semibold text-[#181715] shadow-[0_14px_30px_rgba(179,130,24,0.25)] transition hover:bg-[#e8bb44] focus:outline-none focus:ring-4 focus:ring-[#f3d77d]/40 disabled:cursor-not-allowed disabled:bg-[#eadfce] disabled:text-[#8b8170] disabled:shadow-none"
        >
          {pending ? "Sender registrering..." : "Send registrering"}
        </button>
                    </div>
                  </div>
                </main>

                <aside className="w-full shrink-0 rounded-[1.5rem] border border-[#eee5d6] bg-[#fbf7ef] p-5 xl:sticky xl:top-6 xl:w-[300px]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]">Oppsummering</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#181715]">Registrering</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#6f6657]">Utkast</span>
                  </div>

                  <dl className="mt-6 space-y-4">
                    <div className="rounded-2xl bg-white p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Antall ansatte</dt>
                      <dd className="mt-1 text-lg font-semibold text-[#181715]">{state.employeesCount || "Ikke valgt"}</dd>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Lunsjmodell</dt>
                      <dd className="mt-1 text-lg font-semibold text-[#181715]">{lunchModel}</dd>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Leveringstid</dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181715]">{deliveryWindow}</dd>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Binding/oppsigelse</dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181715]">{termsSummary}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-2xl border border-[#e7d7ac] bg-[#fff7df] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a7a32]">Status</p>
                    <p className="mt-2 text-sm font-semibold text-[#181715]">{summaryStatus}</p>
                    <p className="mt-1 text-xs leading-5 text-[#756b5c]">
                      Statusen følger eksisterende validering og endrer ikke innsendingen.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}

