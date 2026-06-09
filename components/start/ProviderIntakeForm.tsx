"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { type LeadsCaptureBody } from "@/lib/public/leadsCaptureSchema";
import { normalizeCity, normalizePostalCode } from "@/lib/public/geographyParams";

type Props = {
  onBack?: () => void;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  postalCode: string;
  city: string;
  message: string;
  consented: boolean;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  postalCode: "",
  city: "",
  message: "",
  consented: false,
};

const SOURCE = "start-provider-intake";

export default function ProviderIntakeForm({ onBack }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const update = useCallback((key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "postalCode" && typeof value === "string"
          ? normalizePostalCode(value)
          : value,
    }));
    setFieldError(null);
    setErrorMsg("");
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus("loading");
      setErrorMsg("");
      setFieldError(null);

      if (!form.consented) {
        setStatus("error");
        setErrorMsg("Du må samtykke for å sende inn.");
        setFieldError("consented");
        return;
      }

      const name = form.name.trim();
      const email = form.email.trim();
      const company = form.company.trim();
      const phone = form.phone.trim();
      const postal_code = normalizePostalCode(form.postalCode);
      const city = normalizeCity(form.city);
      const message = form.message.trim();

      const payload: LeadsCaptureBody & { website?: string } = {
        name,
        email,
        company,
        source: SOURCE,
        consented: true,
        lead_type: "provider",
        website: "",
        ...(phone ? { phone } : {}),
        ...(postal_code ? { postal_code } : {}),
        ...(city ? { city } : {}),
        ...(message ? { message } : {}),
      };

      try {
        const res = await fetch("/api/public/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          detail?: { field?: string };
        };

        if (res.ok && json.ok !== false) {
          setStatus("success");
          setForm(INITIAL);
          return;
        }

        setStatus("error");
        setErrorMsg(json.message ?? "Noe gikk galt. Prøv igjen om litt.");
        const field = json.detail?.field;
        if (field) setFieldError(field);
      } catch {
        setStatus("error");
        setErrorMsg("Kunne ikke sende skjemaet. Sjekk nettverket og prøv igjen.");
      }
    },
    [form],
  );

  if (status === "success") {
    return (
      <div className="lp-start-step" role="status" aria-live="polite">
        <h2 className="lp-start-step__heading">Takk — vi har mottatt forespørselen.</h2>
        <p className="lp-start-step__body">
          Vi tar kontakt når vi har sett på leverandørprofilen deres. Ingen forpliktelser er opprettet.
        </p>
        <p className="lp-start-secondary-link">
          Allerede leverandør? <Link href="/login?next=/leverandor">Logg inn</Link>
        </p>
        {onBack ? (
          <button type="button" className="lp-start-btn-secondary" onClick={onBack}>
            Tilbake til valg
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="lp-start-step">
      <header className="lp-start-card__header lp-start-card__header--step">
        <h1 id="start-page-title" className="lp-start-card__title font-heading">
          Jeg er caterer
        </h1>
        <p className="lp-start-card__lead font-body">
          Lunchportalen er et driftsystem for caterere som leverer firmalunsj. Fortell oss litt om dere, så tar vi
          kontakt.
        </p>
      </header>

      <form className="lp-start-form" onSubmit={onSubmit} noValidate>
        <input
          type="text"
          name="website"
          className="lp-start-form__honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-name">
            Kontaktperson *
          </label>
          <input
            id="provider-name"
            type="text"
            name="name"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={`lp-start-field__input${fieldError === "name" ? " is-invalid" : ""}`}
            maxLength={200}
          />
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-email">
            E-post *
          </label>
          <input
            id="provider-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={`lp-start-field__input${fieldError === "email" ? " is-invalid" : ""}`}
            maxLength={254}
          />
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-phone">
            Telefon
          </label>
          <input
            id="provider-phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={`lp-start-field__input${fieldError === "phone" ? " is-invalid" : ""}`}
            maxLength={32}
          />
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-company">
            Caterer / firmanavn *
          </label>
          <input
            id="provider-company"
            type="text"
            name="company"
            required
            autoComplete="organization"
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
            className={`lp-start-field__input${fieldError === "company" ? " is-invalid" : ""}`}
            maxLength={300}
          />
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-postal">
            Postnummer
          </label>
          <input
            id="provider-postal"
            type="text"
            name="postal_code"
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.postalCode}
            onChange={(e) => update("postalCode", e.target.value)}
            className={`lp-start-field__input${fieldError === "postal_code" ? " is-invalid" : ""}`}
            maxLength={4}
            aria-describedby="provider-postal-hint"
          />
          <p id="provider-postal-hint" className="lp-start-field__hint">
            Valgfritt — der dere leverer fra
          </p>
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-city">
            Sted
          </label>
          <input
            id="provider-city"
            type="text"
            name="city"
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            className={`lp-start-field__input${fieldError === "city" ? " is-invalid" : ""}`}
            maxLength={128}
          />
        </div>

        <div className="lp-start-field">
          <label className="lp-start-field__label" htmlFor="provider-message">
            Melding
          </label>
          <textarea
            id="provider-message"
            name="message"
            rows={3}
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            className={`lp-start-field__input lp-start-field__textarea${fieldError === "message" ? " is-invalid" : ""}`}
            maxLength={4000}
          />
        </div>

        <label className="lp-start-consent">
          <input
            type="checkbox"
            name="consented"
            checked={form.consented}
            onChange={(e) => update("consented", e.target.checked)}
            className={fieldError === "consented" ? "is-invalid" : undefined}
            required
          />
          <span>
            Jeg samtykker til at Lunchportalen kontakter meg om leverandøravtale og onboarding. *
          </span>
        </label>

        {errorMsg ? (
          <p className="lp-start-form__status" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          className={`ds-btn ds-btn--primary lp-start-btn${status === "loading" ? " is-loading" : ""}`}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sender …" : "Send interesse"}
        </button>

        <p className="lp-start-form__reassurance">Ingen forpliktelser — vi tar kontakt manuelt.</p>
      </form>

      <p className="lp-start-secondary-link">
        Allerede leverandør? <Link href="/login?next=/leverandor">Logg inn</Link>
      </p>

      {onBack ? (
        <button type="button" className="lp-start-btn-secondary" onClick={onBack}>
          Tilbake til valg
        </button>
      ) : null}
    </div>
  );
}
