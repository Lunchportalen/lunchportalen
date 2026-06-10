"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { type LeadsCaptureBody } from "@/lib/public/leadsCaptureSchema";
import { normalizeCity, normalizePostalCode } from "@/lib/public/geographyParams";
import { DEFAULT_START_LOCALE, getStartCopy, type StartLocale } from "@/lib/i18n/startCopy";

type Props = {
  onBack?: () => void;
  /** Locale for UI copy; defaults to Norwegian until app-wide resolver exists. */
  locale?: StartLocale;
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

export default function ProviderIntakeForm({ onBack, locale = DEFAULT_START_LOCALE }: Props) {
  const copy = getStartCopy(locale).provider;
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
        setErrorMsg(copy.consentError);
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
        setErrorMsg(json.message ?? copy.errorGeneric);
        const field = json.detail?.field;
        if (field) setFieldError(field);
      } catch {
        setStatus("error");
        setErrorMsg(copy.errorGeneric);
      }
    },
    [form, copy],
  );

  if (status === "success") {
    return (
      <div className="lp-start-intake lp-start-step" role="status" aria-live="polite">
        <div className="lp-start-intake__success">
          <span className="lp-start-intake__success-mark" aria-hidden="true" />
          <h2 className="lp-start-step__heading">{copy.successTitle}</h2>
          <p className="lp-start-step__body">{copy.successText}</p>
          {onBack ? (
            <button type="button" className="lp-start-btn-secondary" onClick={onBack}>
              {copy.back}
            </button>
          ) : null}
          <p className="lp-start-secondary-link">
            {copy.loginPrompt} <Link href="/login?next=/leverandor">{copy.loginLinkLabel}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-start-intake lp-start-step">
      {onBack ? (
        <button type="button" className="lp-start-back" onClick={onBack}>
          ← {copy.back}
        </button>
      ) : null}

      <header className="lp-start-intake__header">
        <h1 id="start-page-title" className="lp-start-intake__title font-heading">
          {copy.title}
        </h1>
        <p className="lp-start-intake__lead font-body">{copy.lead}</p>
        <p className="lp-start-intake__note">{copy.reassurance}</p>
      </header>

      <form className="lp-start-form lp-start-intake__form" onSubmit={onSubmit} noValidate>
        <input
          type="text"
          name="website"
          className="lp-start-form__honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="lp-start-intake__grid">
          <div className="lp-start-field">
            <label className="lp-start-field__label" htmlFor="provider-name">
              {copy.fields.name} *
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
              {copy.fields.email} *
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
              {copy.fields.phone}
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
              {copy.fields.company} *
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
              {copy.fields.postalCode}
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
              {copy.fields.postalCodeHint}
            </p>
          </div>

          <div className="lp-start-field">
            <label className="lp-start-field__label" htmlFor="provider-city">
              {copy.fields.city}
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

          <div className="lp-start-field lp-start-intake__field--full">
            <label className="lp-start-field__label" htmlFor="provider-message">
              {copy.fields.message}
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
          <span>{copy.consent} *</span>
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
          {status === "loading" ? copy.ctaLoading : copy.cta}
        </button>
      </form>

      <p className="lp-start-secondary-link">
        {copy.loginPrompt} <Link href="/login?next=/leverandor">{copy.loginLinkLabel}</Link>
      </p>
    </div>
  );
}
