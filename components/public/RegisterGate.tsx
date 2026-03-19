"use client";

import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";

type Mode = "company_admin" | "employee";

function makeIdemKey() {
  // browser-only: stable per submit attempt
  // (new key per click is fine; determinism is ensured server-side per key)
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function RegisterGate() {
  const [mode, setMode] = React.useState<Mode>("company_admin");

  const [companyName, setCompanyName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [employeesCount, setEmployeesCount] = React.useState<number>(20);
  const [accept, setAccept] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [receipt, setReceipt] = React.useState<any | null>(null);

  async function submit() {
    setReceipt(null);

    if (mode !== "company_admin") return;
    if (!accept) {
      setReceipt({
        ok: false,
        status: "BLOCKED",
        message: "Du må bekrefte før innsending.",
      });
      return;
    }

    const idem = makeIdemKey();
    setBusy(true);

    try {
      const res = await fetch("/api/public/register-company", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idem,
        },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          phone,
          employeesCount,
          accept,
        }),
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      // Always show a receipt (fail-closed)
      setReceipt(
        json ?? {
          ok: false,
          status: "FAILED",
          message: "Uventet svar fra server (ingen JSON).",
          code: "NO_JSON",
        }
      );
    } catch (e: any) {
      setReceipt({
        ok: false,
        status: "FAILED",
        message: "Nettverksfeil. Prøv igjen.",
        code: "NETWORK_ERROR",
        detail: { message: String(e?.message ?? e) },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <Container className="max-w-3xl py-10">
      <header className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-2xl font-semibold">Registrering</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Dette skjemaet er kun for firma-admin. Ansatte skal ikke registrere seg her.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${
              mode === "company_admin"
                ? "border-transparent bg-[rgb(var(--lp-text))] text-white"
                : "border-[rgb(var(--lp-border))] bg-white"
            }`}
            onClick={() => setMode("company_admin")}
            disabled={busy}
          >
            Jeg er firma-admin
          </button>

          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${
              mode === "employee"
                ? "border-transparent bg-[rgb(var(--lp-text))] text-white"
                : "border-[rgb(var(--lp-border))] bg-white"
            }`}
            onClick={() => setMode("employee")}
            disabled={busy}
          >
            Jeg er ansatt
          </button>
        </div>
      </header>

      {mode === "employee" ? (
        <section className="mt-6 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
          <h2 className="text-lg font-semibold">Ansatt?</h2>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Ansatte opprettes av firma-admin. Gå til innlogging.
          </p>
          <div className="mt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--lp-text))] px-4 py-3 text-sm font-medium text-white"
            >
              Til innlogging
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-6 shadow-[var(--lp-shadow-soft)]">
          <h2 className="text-lg font-semibold">Firma-admin registrering</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Firmanavn *" value={companyName} onChange={setCompanyName} disabled={busy} />
            <Field label="Kontaktperson *" value={contactName} onChange={setContactName} disabled={busy} />
            <Field label="E-post *" value={email} onChange={setEmail} disabled={busy} />
            <Field label="Telefon" value={phone} onChange={setPhone} disabled={busy} />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">Hvor mange ansatte? (min. 20) *</label>
              <input
                type="number"
                min={20}
                value={employeesCount}
                onChange={(e) => setEmployeesCount(Number(e.target.value || 0))}
                disabled={busy}
                className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              disabled={busy}
              className="mt-1"
            />
            <span>
              Jeg bekrefter at jeg registrerer på vegne av firma, og at ansatte skal bruke innlogging (ikke registrering).
            </span>
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--lp-text))] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Sender…" : "Send registrering"}
            </button>

            <Link href="/login" className="text-sm underline">
              Har du allerede tilgang? Logg inn
            </Link>
          </div>

          {/* Receipt (always visible if present) */}
          {receipt ? <ReceiptBox receipt={receipt} /> : null}
        </section>
      )}
      </Container>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}

function ReceiptBox({ receipt }: { receipt: any }) {
  const ok = !!receipt?.ok;
  const rid = receipt?.rid;
  const ts = receipt?.ts;
  const status = receipt?.status;
  const happened = receipt?.happened;
  const msg = receipt?.message;

  return (
    <div
      className="mt-6 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{ok ? "Kvittering" : "Feil"}</div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">
          {rid ? <span className="mr-2">RID: {rid}</span> : null}
          {ts ? <span>Tid: {ts}</span> : null}
        </div>
      </div>

      <div className="mt-2 text-sm">
        <div>
          <span className="font-medium">Status:</span> {String(status ?? "UKJENT")}
        </div>
        {happened ? (
          <div className="mt-1">
            <span className="font-medium">Hva skjedde:</span> {String(happened)}
          </div>
        ) : null}
        {msg ? (
          <div className="mt-1">
            <span className="font-medium">Melding:</span> {String(msg)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
