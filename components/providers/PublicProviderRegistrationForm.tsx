"use client";

import { useActionState, useMemo, useState } from "react";

import { registerCompany, type RegisterCompanyState } from "@/app/registrer/actions";
import { digitsOnlyOrgnr, isValidNorwegianOrgnr } from "@/lib/orgnr/no";
import { isValidNoPhone, normalizeNoPhone } from "@/lib/phone/no";

const initialState: RegisterCompanyState = { ok: true };

type FieldKey =
  | "company_name"
  | "org_number"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "postal_code"
  | "city"
  | "employees_estimate";

function fieldError(key: FieldKey, values: Record<FieldKey, string>): string | null {
  const v = values[key].trim();
  if (key === "company_name" || key === "contact_name" || key === "city") {
    if (!v) return "Påkrevd felt.";
  }
  if (key === "org_number") {
    if (digitsOnlyOrgnr(v).length !== 9) return "9 siffer.";
    if (!isValidNorwegianOrgnr(v)) return "Ugyldig kontrollsiffer.";
  }
  if (key === "contact_email") {
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Ugyldig e-post.";
  }
  if (key === "contact_phone") {
    if (!isValidNoPhone(normalizeNoPhone(v))) return "8 siffer.";
  }
  if (key === "postal_code") {
    if (!/^\d{4}$/.test(v.replace(/\D/g, ""))) return "4 siffer.";
  }
  if (key === "employees_estimate") {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 20) return "Minst 20.";
  }
  return null;
}

export default function PublicProviderRegistrationForm() {
  const [state, formAction, pending] = useActionState(registerCompany, initialState);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [values, setValues] = useState<Record<FieldKey, string>>({
    company_name: "",
    org_number: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    postal_code: "",
    city: "",
    employees_estimate: "20",
  });

  const errors = useMemo(() => {
    const out: Partial<Record<FieldKey, string | null>> = {};
    (Object.keys(values) as FieldKey[]).forEach((k) => {
      out[k] = touched[k] ? fieldError(k, values) : null;
    });
    return out;
  }, [touched, values]);

  function onBlur(key: FieldKey) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function onChange(key: FieldKey, raw: string) {
    if (key === "org_number" || key === "postal_code" || key === "contact_phone") {
      const digits = raw.replace(/\D/g, "");
      const max = key === "org_number" ? 9 : key === "postal_code" ? 4 : 8;
      setValues((prev) => ({ ...prev, [key]: digits.slice(0, max) }));
      return;
    }
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  function inputClass(key: FieldKey) {
    const err = errors[key];
    if (!touched[key]) return "";
    return err ? "is-invalid" : values[key].trim() ? "is-valid" : "";
  }

  return (
    <form className="lp-demo-form lp-registrer-form" action={formAction} noValidate>
      <label htmlFor="reg-company-name">
        Bedriftsnavn
        <input
          id="reg-company-name"
          name="company_name"
          required
          autoComplete="organization"
          className={inputClass("company_name")}
          value={values.company_name}
          onChange={(e) => onChange("company_name", e.target.value)}
          onBlur={() => onBlur("company_name")}
        />
        {errors.company_name ? <span className="lp-demo-form__err">{errors.company_name}</span> : null}
      </label>

      <label htmlFor="reg-orgnr">
        Organisasjonsnummer
        <input
          id="reg-orgnr"
          name="org_number"
          inputMode="numeric"
          required
          className={inputClass("org_number")}
          value={values.org_number}
          onChange={(e) => onChange("org_number", e.target.value)}
          onBlur={() => onBlur("org_number")}
        />
        {errors.org_number ? <span className="lp-demo-form__err">{errors.org_number}</span> : null}
      </label>

      <label htmlFor="reg-contact-name">
        Kontaktperson
        <input
          id="reg-contact-name"
          name="contact_name"
          required
          autoComplete="name"
          className={inputClass("contact_name")}
          value={values.contact_name}
          onChange={(e) => onChange("contact_name", e.target.value)}
          onBlur={() => onBlur("contact_name")}
        />
        {errors.contact_name ? <span className="lp-demo-form__err">{errors.contact_name}</span> : null}
      </label>

      <label htmlFor="reg-contact-email">
        E-post
        <input
          id="reg-contact-email"
          name="contact_email"
          type="email"
          required
          autoComplete="email"
          className={inputClass("contact_email")}
          value={values.contact_email}
          onChange={(e) => onChange("contact_email", e.target.value)}
          onBlur={() => onBlur("contact_email")}
        />
        {errors.contact_email ? <span className="lp-demo-form__err">{errors.contact_email}</span> : null}
      </label>

      <label htmlFor="reg-contact-phone">
        Telefon
        <input
          id="reg-contact-phone"
          name="contact_phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="tel"
          placeholder="8 siffer"
          className={inputClass("contact_phone")}
          value={values.contact_phone}
          onChange={(e) => onChange("contact_phone", e.target.value)}
          onBlur={() => onBlur("contact_phone")}
        />
        {errors.contact_phone ? <span className="lp-demo-form__err">{errors.contact_phone}</span> : null}
      </label>

      <div className="lp-registrer-form__row">
        <label htmlFor="reg-postal">
          Postnummer
          <input
            id="reg-postal"
            name="postal_code"
            inputMode="numeric"
            required
            className={inputClass("postal_code")}
            value={values.postal_code}
            onChange={(e) => onChange("postal_code", e.target.value)}
            onBlur={() => onBlur("postal_code")}
          />
          {errors.postal_code ? <span className="lp-demo-form__err">{errors.postal_code}</span> : null}
        </label>

        <label htmlFor="reg-city">
          Poststed
          <input
            id="reg-city"
            name="city"
            required
            autoComplete="address-level2"
            className={inputClass("city")}
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
            onBlur={() => onBlur("city")}
          />
          {errors.city ? <span className="lp-demo-form__err">{errors.city}</span> : null}
        </label>
      </div>

      <label htmlFor="reg-employees">
        Antall ansatte (ca.)
        <input
          id="reg-employees"
          name="employees_estimate"
          type="number"
          min={20}
          required
          className={inputClass("employees_estimate")}
          value={values.employees_estimate}
          onChange={(e) => onChange("employees_estimate", e.target.value)}
          onBlur={() => onBlur("employees_estimate")}
        />
        {errors.employees_estimate ? (
          <span className="lp-demo-form__err">{errors.employees_estimate}</span>
        ) : null}
      </label>

      <label htmlFor="reg-notes">
        Merknad (valgfritt)
        <textarea id="reg-notes" name="notes" rows={3} maxLength={2000} />
      </label>

      {state.error ? (
        <p className="lp-demo-form__status is-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="ds-btn ds-btn--primary" disabled={pending}>
        {pending ? "Sender…" : "Send registrering"}
      </button>
    </form>
  );
}
