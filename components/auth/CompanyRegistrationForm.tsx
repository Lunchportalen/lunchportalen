"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RegisterResponse = {
  ok?: boolean;
  rid?: string;
  companyId?: string;
  message?: string;
  receipt?: { message?: string };
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

  return null;
}

export default function CompanyRegistrationForm({ blocked = false, blockedReason = null }: CompanyRegistrationFormProps) {
  const router = useRouter();

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
        }),
      });

      const json = (await res.json().catch(() => null)) as RegisterResponse | null;
      if (!json) {
        setError("Uventet svar fra server.");
        return;
      }

      setReceipt(json);

      if (!res.ok || !json.ok) {
        setError(json.message || "Registreringen feilet.");
        return;
      }

      const companyId = String(json.companyId ?? "").trim();
      const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
      router.push(`/registrering/mottatt${query}`);
    } catch {
      setError("Nettverksfeil. Prøv igjen.");
    } finally {
      setPending(false);
    }
  }

  const employeesTooLow = Number.isFinite(asInt(state.employeesCount)) && asInt(state.employeesCount) < 20;

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-busy={pending ? "true" : "false"}>
      <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
        <h2 className="text-lg font-semibold">Firmaregistrering</h2>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Fyll ut firmainfo og kontaktperson. Registreringen blir lagret når alle felt er gyldige.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Firmanavn *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.companyName}
              onChange={(e) => setState((prev) => ({ ...prev, companyName: e.target.value }))}
              autoComplete="organization"
            />
          </label>

          <label className="text-sm">
            Organisasjonsnummer *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              inputMode="numeric"
              value={state.orgnr}
              onChange={(e) => setState((prev) => ({ ...prev, orgnr: onlyDigits(e.target.value) }))}
              placeholder="9 siffer"
            />
          </label>

          <label className="text-sm">
            Antall ansatte *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              inputMode="numeric"
              value={state.employeesCount}
              onChange={(e) => setState((prev) => ({ ...prev, employeesCount: onlyDigits(e.target.value) }))}
              aria-invalid={employeesTooLow ? "true" : "false"}
            />
            {employeesTooLow ? (
              <div className="mt-1 text-xs text-red-700">Firmaet må ha minst 20 ansatte for å registrere seg.</div>
            ) : null}
          </label>

          <label className="text-sm">
            Kontaktperson *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.contactName}
              onChange={(e) => setState((prev) => ({ ...prev, contactName: e.target.value }))}
            />
          </label>

          <label className="text-sm">
            E-post *
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.contactEmail}
              onChange={(e) => setState((prev) => ({ ...prev, contactEmail: e.target.value }))}
            />
          </label>

          <label className="text-sm">
            Telefon *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.contactPhone}
              onChange={(e) => setState((prev) => ({ ...prev, contactPhone: onlyDigits(e.target.value) }))}
            />
          </label>

          <label className="text-sm md:col-span-2">
            Adresse *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.addressLine}
              onChange={(e) => setState((prev) => ({ ...prev, addressLine: e.target.value }))}
            />
          </label>

          <label className="text-sm">
            Postnummer *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              inputMode="numeric"
              value={state.postalCode}
              onChange={(e) => setState((prev) => ({ ...prev, postalCode: onlyDigits(e.target.value) }))}
            />
          </label>

          <label className="text-sm">
            Poststed *
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[rgba(var(--lp-ring),0.35)]"
              value={state.postalCity}
              onChange={(e) => setState((prev) => ({ ...prev, postalCity: e.target.value }))}
            />
          </label>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={state.confirmAuthority}
            onChange={(e) => setState((prev) => ({ ...prev, confirmAuthority: e.target.checked }))}
          />
          <span>Jeg bekrefter at jeg registrerer på vegne av firmaet.</span>
        </label>

        {blocked ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {blockedReason || "Registrering er midlertidig blokkert."}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {receipt?.ok ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status" aria-live="polite">
            {receipt.receipt?.message || "Registreringen er mottatt."}</div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="lp-btn lp-btn-primary lp-btn-block lp-neon mt-5 min-h-[48px] disabled:opacity-60"
        >
          {pending ? "Sender registrering..." : "Send registrering"}
        </button>
      </section>
    </form>
  );
}

