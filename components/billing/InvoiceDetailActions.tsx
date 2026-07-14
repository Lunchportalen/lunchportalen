"use client";

// FASE 8 — provider-handlinger på fakturadetaljen: utsted, send, registrer
// bankbetaling (idempotent), kreditnota, annuller. Alle kall går til de
// provider-scopede API-ene; ingen Stripe.
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoiceId: string;
  status: string;
  kind: string;
  amountTotal: number;
  amountPaid: number;
};

function newIdemKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function InvoiceDetailActions({ invoiceId, status, kind, amountTotal, amountPaid }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>(Math.max(amountTotal - amountPaid, 0).toFixed(2));
  const [payReference, setPayReference] = useState("");
  const [payIdemKey, setPayIdemKey] = useState<string>(() => newIdemKey());
  const [creditReason, setCreditReason] = useState("");
  const [voidReason, setVoidReason] = useState("");

  async function call(action: string, path: string, body?: Record<string, unknown>) {
    if (busy) return null;
    setError(null);
    setInfo(null);
    setBusy(action);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : { body: "{}" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok !== true) {
        setError(String(json?.message ?? "Handlingen feilet."));
        return null;
      }
      router.refresh();
      return json;
    } catch {
      setError("Uventet feil.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const btn = "min-h-[44px] rounded-full px-4 text-sm font-semibold disabled:opacity-50";
  const canFinalize = status === "DRAFT";
  const canSend = status === "ISSUED";
  const canPay = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(status) && kind === "INVOICE";
  const canCredit = ["ISSUED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(status) && kind === "INVOICE";
  const canVoid = ["DRAFT", "ISSUED"].includes(status) && amountPaid === 0;

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 print:hidden" data-lp-invoice-actions>
      <p className="text-sm font-semibold text-neutral-900">Handlinger</p>
      {error ? <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900" role="alert">{error}</p> : null}
      {info ? <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900" role="status">{info}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {canFinalize ? (
          <button
            type="button"
            name="finalize-invoice"
            disabled={busy !== null}
            onClick={() => void call("finalize", `/api/provider/invoices/${invoiceId}/finalize`)}
            className={`${btn} bg-neutral-950 text-white`}
          >
            {busy === "finalize" ? "Utsteder …" : "Utsted (finaliser)"}
          </button>
        ) : null}
        {canSend ? (
          <button
            type="button"
            name="send-invoice"
            disabled={busy !== null}
            onClick={async () => {
              const r = await call("send", `/api/provider/invoices/${invoiceId}/send`);
              if (r) setInfo(`Sendt til ${String(r?.data?.recipient ?? "fakturamottaker")}.`);
            }}
            className={`${btn} bg-neutral-950 text-white`}
          >
            {busy === "send" ? "Sender …" : "Send til firma"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className={`${btn} border border-neutral-200 bg-white text-neutral-900`}
        >
          Skriv ut / PDF
        </button>
      </div>

      {canPay ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Registrer bankbetaling</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium">
              Beløp
              <input
                className="block min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                name="payment_amount"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium">
              Referanse (KID/melding)
              <input
                className="block min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                name="payment_reference"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
              />
            </label>
            <button
              type="button"
              name="register-payment"
              disabled={busy !== null}
              onClick={async () => {
                const amount = Number(payAmount.replace(",", "."));
                const r = await call("payment", `/api/provider/invoices/${invoiceId}/payments`, {
                  amount,
                  method: "BANK",
                  reference: payReference || null,
                  idempotency_key: payIdemKey,
                });
                if (r) {
                  setInfo(`Betaling registrert — status ${String(r?.data?.status ?? "")}.`);
                  setPayIdemKey(newIdemKey());
                }
              }}
              className={`${btn} bg-emerald-700 text-white`}
            >
              {busy === "payment" ? "Registrerer …" : "Registrer betaling"}
            </button>
          </div>
        </div>
      ) : null}

      {canCredit ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Kreditnota</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="grow text-xs font-medium">
              Begrunnelse
              <input
                className="block w-full min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                name="credit_reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="F.eks. kansellert leveranse, feil pris"
              />
            </label>
            <button
              type="button"
              name="create-credit-note"
              disabled={busy !== null || creditReason.trim().length < 3}
              onClick={async () => {
                const r = await call("credit", `/api/provider/invoices/${invoiceId}/credit-note`, { reason: creditReason });
                const creditId = String(r?.data?.credit_note_id ?? "");
                if (creditId) router.push(`/leverandor/fakturaer/${creditId}`);
              }}
              className={`${btn} border border-neutral-200 bg-white text-neutral-900`}
            >
              {busy === "credit" ? "Oppretter …" : "Opprett kreditnota (full)"}
            </button>
          </div>
        </div>
      ) : null}

      {canVoid ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="grow text-xs font-medium">
            Annulleringsgrunn
            <input
              className="block w-full min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
              name="void_reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            name="void-invoice"
            disabled={busy !== null || voidReason.trim().length < 3}
            onClick={() => void call("void", `/api/provider/invoices/${invoiceId}/void`, { reason: voidReason })}
            className={`${btn} border border-rose-200 bg-white text-rose-700`}
          >
            {busy === "void" ? "Annullerer …" : "Annuller (VOID)"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
