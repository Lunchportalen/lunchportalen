"use client";

import { useCallback, useState } from "react";

import { type LeadsCaptureBody } from "@/lib/public/leadsCaptureSchema";

type Props = {
  postalCode: string;
  city: string;
  source: string;
  onBack: () => void;
};

type FormState = {
  name: string;
  email: string;
  company: string;
  consented: boolean;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  company: "",
  consented: false,
};

export default function CoverageWishForm({ postalCode, city, source, onBack }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

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

      const payload: LeadsCaptureBody & { website?: string } = {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
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
      <div className="lp-start-form lp-demo-form" role="status" aria-live="polite">
        <h2 className="lp-start-form__subheading">Takk — vi har notert ønsket ditt</h2>
        <p className="lp-demo-form__status is-success">
          Vi har ikke dekning i {postalCode} {city} ennå, men vi har registrert interessen din og tar kontakt når
          området åpnes.
        </p>
        <button type="button" className="ds-btn--secondary" onClick={onBack}>
          Prøv et annet sted
        </button>
      </div>
    );
  }

  return (
    <form className="lp-start-form lp-demo-form" onSubmit={onSubmit} noValidate>
      <h2 className="lp-start-form__subheading">Vi har ikke dekning her ennå</h2>
      <p className="lp-start-form__intro">
        For {postalCode} {city} er Lunchportalen ikke tilgjengelig akkurat nå. Legg igjen kontaktinfo, så gir vi beskjed
        når vi åpner området.
      </p>

      <input
        type="text"
        name="website"
        className="lp-demo-form__honeypot"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <label>
        Navn *
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className={fieldError === "name" ? "is-invalid" : undefined}
          maxLength={200}
        />
      </label>

      <label>
        E-post *
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className={fieldError === "email" ? "is-invalid" : undefined}
          maxLength={254}
        />
      </label>

      <label>
        Bedrift *
        <input
          type="text"
          name="company"
          required
          autoComplete="organization"
          value={form.company}
          onChange={(e) => update("company", e.target.value)}
          className={fieldError === "company" ? "is-invalid" : undefined}
          maxLength={300}
        />
      </label>

      <label className="lp-demo-form__consent">
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

      <p
        className={`lp-demo-form__status${status === "error" ? " is-error" : ""}`}
        role={status === "error" ? "alert" : undefined}
      >
        {errorMsg}
      </p>

      <div className="lp-start-form__actions">
        <button type="button" className="ds-btn--secondary" onClick={onBack} disabled={status === "loading"}>
          Tilbake
        </button>
        <button type="submit" className={status === "loading" ? "is-loading" : undefined} disabled={status === "loading"}>
          {status === "loading" ? (
            <>
              <span className="lp-demo-form__btn-spinner" aria-hidden="true" />
              Sender …
            </>
          ) : (
            "Meld interesse"
          )}
        </button>
      </div>
    </form>
  );
}
