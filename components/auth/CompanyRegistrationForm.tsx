"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

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
  requestId?: string;
  code?: string;
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
  "mt-2 min-h-12 w-full rounded-[1.25rem] border border-[#eadfce] bg-[#fffdf9] px-4 py-3 text-base text-[#1f1f1f] outline-none transition placeholder:text-[#a69a86] focus:border-[#d7ad42] focus:bg-white focus:ring-4 focus:ring-[#f3d77d]/25";

const labelClass = "text-sm font-medium text-[#34302a]";
const sectionClass = "border-t border-[#f0e7d8] pt-9";
const sectionKickerClass = "text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]";
const sectionTitleClass = "mt-2 text-xl font-semibold tracking-[-0.02em] text-[#181715]";
const sectionTextClass = "mt-1 text-sm leading-6 text-[#756b5c]";
const unknownSubmitError =
  "Noe gikk galt under innsendingen. Prøv igjen, eller kontakt oss dersom problemet vedvarer.";
const networkSubmitError =
  "Vi fikk ikke kontakt med registreringstjenesten. Sjekk nettverket og prøv igjen.";

function getRegisterErrorCode(response: RegisterResponse | null) {
  const candidates = [
    response?.code,
    typeof response?.error === "string" ? response.error : response?.error?.code,
  ];
  return candidates.map((value) => value?.trim()).find(Boolean) || "";
}

function isUserSafeRegisterMessage(message: string) {
  if (!message || message.length > 220) return false;
  return !/(stack|trace|exception|postgres|supabase|sql|database|constraint|duplicate key|relation|column|pgrst|errno)/i.test(
    message,
  );
}

function getRegisterErrorMessage(response: RegisterResponse | null) {
  const code = getRegisterErrorCode(response);
  const friendlyMessages: Record<string, string> = {
    CONSENT_REQUIRED: "Du må bekrefte fullmakt før registreringen kan sendes.",
    INVALID_PAYLOAD: "Registreringen mangler gyldig informasjon. Kontroller feltene og prøv igjen.",
    REGISTER_PERSISTENCE_FAILED:
      "Registreringen ble sendt, men kunne ikke lagres korrekt. Dette kan skyldes en midlertidig system- eller databasefeil.",
    SERVER_ERROR: "Registreringen kunne ikke fullføres på grunn av en serverfeil.",
    DATABASE_ERROR: "Registreringen kunne ikke fullføres på grunn av en databasefeil.",
    SUPABASE_ERROR: "Registreringen kunne ikke fullføres mot databasen akkurat nå.",
    UNKNOWN: unknownSubmitError,
  };

  if (friendlyMessages[code]) return friendlyMessages[code];

  const message = typeof response?.message === "string" ? response.message.trim() : "";
  if (isUserSafeRegisterMessage(message)) return message;

  return unknownSubmitError;
}

function isRegisterReference(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== "undefined" && normalized !== "null" && /^[a-z0-9_.:-]{2,120}$/i.test(normalized));
}

function getRegisterErrorReference(response: RegisterResponse | null) {
  const candidates = [
    response?.rid,
    response?.requestId,
    response?.code,
    typeof response?.error === "string" ? response.error : response?.error?.code,
  ];
  return candidates.map((value) => value?.trim()).find((value) => isRegisterReference(value)) || null;
}

export default function CompanyRegistrationForm({ blocked = false, blockedReason = null }: CompanyRegistrationFormProps) {
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
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RegisterResponse | null>(null);

  const validationError = useMemo(() => validateCompanyRegistrationForm(state), [state]);
  const canSubmit = !blocked && !pending && !validationError;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorReference(null);
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
        setError(unknownSubmitError);
        return;
      }

      if (!res.ok || !json.ok || json.persisted !== true) {
        setError(getRegisterErrorMessage(json));
        setErrorReference(getRegisterErrorReference(json));
        return;
      }

      setReceipt(json);
    } catch {
      setError(networkSubmitError);
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
  const formNotice = receipt?.ok && receipt.persisted === true
    ? {
        tone: "success",
        title: "Registreringen er mottatt",
        message: "Vi har lagret firmaregistreringen og går gjennom avtalegrunnlaget før aktivering.",
        detail: receipt.receipt?.message?.trim() || null,
      }
    : error
      ? {
          tone: "error",
          title: "Registreringen kunne ikke sendes",
          message: error,
          detail: errorReference ? `Teknisk referanse: ${errorReference}` : null,
        }
      : blocked
        ? {
            tone: "error",
            title: "Registrering er midlertidig stoppet",
            message: blockedReason || "Registrering er midlertidig blokkert.",
            detail: null,
          }
        : pending
          ? {
              tone: "ready",
              title: "Sender registreringen",
              message: "Vi sender informasjonen sikkert. Dette tar vanligvis bare et øyeblikk.",
              detail: null,
            }
          : validationError
            ? {
                tone: "warning",
                title: "Mangler informasjon",
                message: validationError,
                detail: null,
              }
            : {
                tone: "ready",
                title: "Klar til innsending",
                message: "Alle påkrevde felt er fylt ut. Du kan sende registreringen når du er klar.",
                detail: null,
              };
  const formNoticeClass =
    formNotice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : formNotice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : formNotice.tone === "warning"
          ? "border-[#ecd89c] bg-[#fff8df] text-[#3b3223]"
          : "border-[#eadfce] bg-[#fffaf1] text-[#34302a]";
  const formNoticeRole = formNotice.tone === "error" || formNotice.tone === "warning" ? "alert" : "status";
  const formNoticeLive = formNotice.tone === "error" || formNotice.tone === "warning" ? "assertive" : "polite";
  const steps = ["Avtale", "Bedrift", "Kontakt", "Bekreftelse"];

  return (
    <form onSubmit={onSubmit} className="w-full" aria-busy={pending ? "true" : "false"}>
      <section className="w-full max-w-none rounded-none bg-[linear-gradient(135deg,#fffdf8_0%,#f8efdf_48%,#fffaf1_100%)] p-0 shadow-none">
        <div className="grid min-w-0 rounded-none bg-white/62 backdrop-blur lg:min-h-[calc(100vh-96px)] lg:grid-cols-[216px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="p-4 sm:p-5 lg:p-6 lg:pr-2">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 rounded-2xl bg-white/75">
                <Image
                  src="/brand/lunchportalen-logo.png"
                  alt="Lunchportalen"
                  fill
                  sizes="48px"
                  className="object-contain p-1.5"
                  priority={false}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#181715]">Lunchportalen</p>
                <p className="text-xs text-[#7a705f]">Firmaregistrering</p>
              </div>
            </div>

            <div className="mt-5 max-w-[20rem] text-sm text-[#746a5a] lg:mt-9">
              <p className="text-base font-semibold tracking-[-0.01em] text-[#25231f]">Trygg firmaregistrering</p>
              <p className="mt-2 leading-6">
                Fyll ut avtalegrunnlaget én gang. Superadmin går gjennom registreringen før bedriften aktiveres.
              </p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-[#5f5649]">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7ad42]" aria-hidden="true" />
                  <span>Minimum 20 ansatte</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7ad42]" aria-hidden="true" />
                  <span>Avtale vurderes før aktivering</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7ad42]" aria-hidden="true" />
                  <span>Ingen bestilling før firmaet er godkjent</span>
                </li>
              </ul>
            </div>
          </aside>

          <div className="min-w-0 p-0">
            <div className="bg-white/86 p-5 sm:p-6 lg:px-8 lg:py-7 xl:px-10 xl:py-8">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-stretch">
                <main className="min-w-0 flex-1">
                  <div className="flex flex-col gap-7 pb-8">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7a32]">Firmaregistrering</p>
                      <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-[#181715] sm:text-4xl">
                        Opprett ny lunsjordning
                      </h2>
                      <p className="mt-4 max-w-2xl text-base leading-7 text-[#756b5c]">
                        Fyll ut firmainfo og kontaktperson. Registreringen blir lagret når alle felt er gyldige.
                      </p>
                    </div>

                    <div className="border-t border-[#eee5d6] pt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]">
                        Registreringen består av
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[#34302a]">
                        {steps.map((step) => (
                          <span key={step} className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#d7ad42]" aria-hidden="true" />
                            {step}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-10 pt-2">
                    <div>
                      <p className={sectionKickerClass}>Avtale</p>
                      <h3 className={sectionTitleClass}>Avtaledetaljer / Lunsjplan</h3>
                      <p className={sectionTextClass}>
                        Lunsjplan (Basis = 3 valg, Luxus = 6 valg). Velg nivå per ukedag og ønsket leveringsvindu.
                      </p>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                      <label className="mt-6 flex items-start gap-4 rounded-[1.5rem] bg-[#fbf7ef] p-4 text-sm leading-6 text-[#34302a]">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded border-[#cdbfaa] text-[#d7ad42] accent-[#d7ad42]"
            checked={state.confirmAuthority}
            onChange={(e) => setState((prev) => ({ ...prev, confirmAuthority: e.target.checked }))}
          />
          <span>Jeg bekrefter at jeg registrerer på vegne av firmaet.</span>
        </label>

        <div className={`mt-5 rounded-[1.5rem] border p-4 text-sm ${formNoticeClass}`} role={formNoticeRole} aria-live={formNoticeLive}>
          <p className="font-semibold">{formNotice.title}</p>
          <p className="mt-1 leading-6">{formNotice.message}</p>
          {formNotice.detail ? <p className="mt-2 text-xs leading-5 opacity-80">{formNotice.detail}</p> : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-7 min-h-14 w-full rounded-full bg-[#f1c75b] px-6 py-4 text-base font-semibold text-[#181715] shadow-[0_12px_28px_rgba(179,130,24,0.2)] transition hover:bg-[#e8bb44] focus:outline-none focus:ring-4 focus:ring-[#f3d77d]/40 disabled:cursor-not-allowed disabled:bg-[#eee5d6] disabled:text-[#8b8170] disabled:shadow-none"
        >
          {pending ? "Sender registrering..." : "Send registrering"}
        </button>
                    </div>
                  </div>
                </main>

                <aside className="w-full shrink-0 bg-[#fbf7ef]/85 p-5 xl:sticky xl:top-6 xl:w-[320px] xl:border-l xl:border-[#eadfce] xl:px-6 xl:py-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a32]">Oppsummering</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#181715]">Registrering</h3>
                    </div>
                    <span className="rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-[#6f6657]">Utkast</span>
                  </div>

                  <dl className="mt-6 divide-y divide-[#eadfce]">
                    <div className="py-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Antall ansatte</dt>
                      <dd className="mt-1 text-lg font-semibold text-[#181715]">{state.employeesCount || "Ikke valgt"}</dd>
                    </div>
                    <div className="py-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Lunsjmodell</dt>
                      <dd className="mt-1 text-lg font-semibold text-[#181715]">{lunchModel}</dd>
                    </div>
                    <div className="py-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Leveringstid</dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181715]">{deliveryWindow}</dd>
                    </div>
                    <div className="py-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9d927f]">Binding/oppsigelse</dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181715]">{termsSummary}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-[1.5rem] bg-[#fff7df] p-4">
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

