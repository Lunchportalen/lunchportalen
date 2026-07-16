"use client";

// components/billing/CommissionControlClient.tsx — FASE 9 superadmin-handlinger.
// Norsk kontrollflate for plattformprovisjon: dry-run, lukk+utsted+lever,
// registrer bankbetaling, kreditfaktura, re-send, forfalls-oppdatering.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ProviderOption = { id: string; name: string };

async function callApi(body: Record<string, unknown>) {
  const res = await fetch("/api/superadmin/commission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(String(json?.message ?? json?.error ?? `Feil (${res.status})`));
  }
  return json;
}

function previousMonthDefaults() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default function CommissionControlClient({ providers }: { providers: ProviderOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaults = previousMonthDefaults();

  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  // Fail-closed: valuta må angis eksplisitt (ingen hardkodet default).
  const [currency, setCurrency] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");

  const [creditInvoiceId, setCreditInvoiceId] = useState("");
  const [creditReason, setCreditReason] = useState("");

  function run(fn: () => Promise<string>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const msg = await fn();
        setMessage(msg);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const input = "min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 text-sm";
  const btn = "inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-semibold disabled:opacity-50";

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Handlinger</h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Leverandør" className={input} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input aria-label="Periodestart" type="date" className={input} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        <input aria-label="Periodeslutt" type="date" className={input} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        <input aria-label="Valuta" placeholder="Valuta (3 bokstaver)" className={input} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          disabled={pending || !providerId || currency.length !== 3}
          onClick={() =>
            run(async () => {
              const res = await callApi({ action: "dry_run", providerId, periodStart, periodEnd, currency });
              const d = res?.data?.dryRun ?? {};
              return `Dry-run: ${d.ledger_rows_count ?? 0} posteringer, provisjon ${((d.rounded_commission_amount_minor ?? 0) / 100).toFixed(2)} ${currency}. ${d.can_close ? "Kan lukkes." : `Mangler: ${(d.missing_requirements ?? []).join(", ")}`}`;
            })
          }
        >
          Dry-run
        </button>
        <button
          type="button"
          className={btn}
          disabled={pending || !providerId || currency.length !== 3}
          onClick={() =>
            run(async () => {
              const res = await callApi({ action: "close", providerId, periodStart, periodEnd, currency });
              const d = res?.data ?? {};
              return `Periode lukket og fakturert. Faktura ${d.invoiceId}. Levering: ${d.delivered?.recipients ? d.delivered.recipients.join(", ") : d.delivered?.error ?? "ukjent"}.`;
            })
          }
        >
          Lukk periode + fakturer + send
        </button>
        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await callApi({ action: "refresh_overdue" });
              return `Forfalls-oppdatering: ${res?.data?.marked_overdue ?? 0} fakturaer markert forfalt.`;
            })
          }
        >
          Oppdater forfalt
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-100 p-3">
          <h3 className="text-sm font-semibold">Registrer bankbetaling</h3>
          <div className="mt-2 grid gap-2">
            <input aria-label="Faktura-ID" className={input} placeholder="Faktura-ID" value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} />
            <input aria-label="Beløp i øre" className={input} placeholder="Beløp i øre (minor units)" inputMode="numeric" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <input aria-label="Referanse" className={input} placeholder="Bankreferanse" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
            <button
              type="button"
              className={btn}
              disabled={pending || !payInvoiceId || !payAmount}
              onClick={() =>
                run(async () => {
                  const res = await callApi({
                    action: "payment",
                    invoiceId: payInvoiceId.trim(),
                    amountMinor: Number(payAmount),
                    reference: payReference.trim() || null,
                  });
                  return `Betaling registrert. Status: ${res?.data?.payment_status ?? "ukjent"} (betalt ${((res?.data?.amount_paid_minor ?? 0) / 100).toFixed(2)}).`;
                })
              }
            >
              Registrer betaling
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 p-3">
          <h3 className="text-sm font-semibold">Kreditfaktura</h3>
          <div className="mt-2 grid gap-2">
            <input aria-label="Faktura-ID for kreditering" className={input} placeholder="Faktura-ID" value={creditInvoiceId} onChange={(e) => setCreditInvoiceId(e.target.value)} />
            <input aria-label="Begrunnelse" className={input} placeholder="Begrunnelse (påkrevd)" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
            <button
              type="button"
              className={btn}
              disabled={pending || !creditInvoiceId || !creditReason}
              onClick={() =>
                run(async () => {
                  const res = await callApi({ action: "credit", invoiceId: creditInvoiceId.trim(), reason: creditReason.trim() });
                  return `Kreditfaktura ${res?.data?.credit_number ?? ""} opprettet.`;
                })
              }
            >
              Opprett kreditfaktura
            </button>
          </div>
        </div>
      </div>

      {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
    </section>
  );
}
