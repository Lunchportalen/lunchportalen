"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { type LeadsCaptureBody } from "@/lib/public/leadsCaptureSchema";
import { buildContinuationPath } from "@/lib/public/geographyParams";

type Props = {
  postalCode: string;
  city: string;
  source: string;
  onBack: () => void;
};

type FormState = {
  email: string;
  company: string;
  consented: boolean;
};

const INITIAL: FormState = {
  email: "",
  company: "",
  consented: false,
};

export default function CoverageWishForm({ postalCode, city, source, onBack }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const demoHref = buildContinuationPath("demo", { postalCode, city, source });

  const update = useCallback((key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
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

      const company = form.company.trim();
      const email = form.email.trim();

      const payload: LeadsCaptureBody & { website?: string } = {
        name: company,
        email,
        company,
        source: `${source}-coverage-wish`.slice(0, 128),
        consented: true,
        postal_code: postalCode,
        city,
        coverage_wish: true,
        lead_type: "customer",
        message: `Dekningsønske for ${postalCode} ${city}.`,
        website: "",
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
    [city, form, postalCode, source],
  );

  if (status === "success") {
    return (
      <div className="lp-start-step" role="status" aria-live="polite">
        <h2 className="lp-start-step__heading">Takk — vi gir beskjed så snart vi er i {city}.</h2>
        <p className="lp-start-secondary-link">
          Vil dere se produktet uansett? <Link href={demoHref}>Book en demo</Link>
        </p>
        <button type="button" className="lp-start-btn-secondary" onClick={onBack}>
          Prøv et annet sted
        </button>
      </div>
    );
  }

  return (
    <div className="lp-start-step">
      <span className="lp-start-location-chip">
        {postalCode} {city}
      </span>

      <h2 className="lp-start-step__heading">Vi er ikke i {city} ennå</h2>
      <p className="lp-start-step__body">
        Vi ruller ut der etterspørselen er størst. Meld interesse, så er dere først i køen når vi kommer til {city}.
      </p>

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
          <label className="lp-start-field__label" htmlFor="coverage-email">
            E-post
          </label>
          <input
            id="coverage-email"
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
          <label className="lp-start-field__label" htmlFor="coverage-company">
            Bedrift
          </label>
          <input
            id="coverage-company"
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
            Jeg samtykker til at Lunchportalen kontakter meg når vi har dekning i området mitt. *
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
          {status === "loading" ? "Sender …" : "Meld interesse"}
        </button>
      </form>

      <p className="lp-start-secondary-link">
        Vil dere se produktet uansett? <Link href={demoHref}>Book en demo</Link>
      </p>
    </div>
  );
}
