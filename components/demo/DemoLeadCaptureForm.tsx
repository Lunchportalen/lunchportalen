"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  DEMO_COMPANY_SIZE_OPTIONS,
  type LeadsCaptureBody,
} from "@/lib/public/leadsCaptureSchema";

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  company_size: string;
  message: string;
  consented: boolean;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  company_size: "",
  message: "",
  consented: false,
};

function resolveSource(searchParams: URLSearchParams): string {
  const source = searchParams.get("source")?.trim();
  if (source) return source.slice(0, 128);
  const src = searchParams.get("src")?.trim();
  if (src) return src.slice(0, 128);
  return "demo-direct";
}

export default function DemoLeadCaptureForm() {
  const searchParams = useSearchParams();
  const source = useMemo(() => resolveSource(searchParams), [searchParams]);
  const geoPostal = useMemo(() => {
    const raw = searchParams.get("postal_code")?.trim() ?? "";
    return /^\d{4}$/.test(raw) ? raw : undefined;
  }, [searchParams]);
  const geoCity = useMemo(() => {
    const raw = searchParams.get("city")?.trim() ?? "";
    return raw.length >= 1 ? raw.slice(0, 128) : undefined;
  }, [searchParams]);

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
        source,
        consented: true,
        phone: form.phone.trim() || undefined,
        company_size: (form.company_size || undefined) as LeadsCaptureBody["company_size"],
        message: form.message.trim() || undefined,
        postal_code: geoPostal,
        city: geoCity,
        lead_type: "customer",
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
          error?: string;
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
    [form, geoCity, geoPostal, source],
  );

  if (status === "success") {
    return (
      <div className="lp-demo-form" role="status" aria-live="polite">
        <p className="lp-demo-form__status is-success">
          Takk! Vi har mottatt forespørselen din og tar kontakt så snart vi kan.
        </p>
        <button
          type="button"
          className="ds-btn--secondary"
          onClick={() => setStatus("idle")}
        >
          Send en ny forespørsel
        </button>
      </div>
    );
  }

  return (
    <form className="lp-demo-form" onSubmit={onSubmit} noValidate>
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

      <label>
        Telefon
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className={fieldError === "phone" ? "is-invalid" : undefined}
          maxLength={32}
        />
      </label>

      <label>
        Antall ansatte
        <select
          name="company_size"
          value={form.company_size}
          onChange={(e) => update("company_size", e.target.value)}
          className={fieldError === "company_size" ? "is-invalid" : undefined}
        >
          <option value="">Velg antall ansatte</option>
          {DEMO_COMPANY_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Melding
        <textarea
          name="message"
          rows={4}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          className={fieldError === "message" ? "is-invalid" : undefined}
          maxLength={4000}
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
          Jeg samtykker til at Lunchportalen kontakter meg om demo og lunsjløsning for bedriften. *
        </span>
      </label>

      <p
        className={`lp-demo-form__status${status === "error" ? " is-error" : ""}`}
        role={status === "error" ? "alert" : undefined}
      >
        {errorMsg}
      </p>

      <button type="submit" className={status === "loading" ? "is-loading" : undefined} disabled={status === "loading"}>
        {status === "loading" ? (
          <>
            <span className="lp-demo-form__btn-spinner" aria-hidden="true" />
            Sender …
          </>
        ) : (
          "Book demo"
        )}
      </button>
    </form>
  );
}
