// components/billing/InvoiceDocument.tsx
// FASE 8 — kanonisk HTML-fakturadokument (print = PDF via nettleser).
// Server-komponent, delt av provider-, company- og superadmin-visningene.
import { formatDateNO } from "@/lib/date/format";
import type { InvoiceHead, InvoiceLine, InvoicePayment } from "@/lib/billing/invoiceLifecycle";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  ISSUED: "Utstedt",
  SENT: "Sendt",
  PARTIALLY_PAID: "Delvis betalt",
  PAID: "Betalt",
  OVERDUE: "Forfalt",
  CREDITED: "Kreditert",
  VOID: "Annullert",
  PENDING_SYNC: "Venter synk",
  SYNC_FAILED: "Synk feilet",
};

export function invoiceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function money(v: number, currency: string) {
  return `${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} ${currency}`;
}

export default function InvoiceDocument({
  head,
  lines,
  payments,
  providerName,
  companyName,
}: {
  head: InvoiceHead;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  providerName: string;
  companyName: string;
}) {
  const kindLabel = head.kind === "CREDIT_NOTE" ? "Kreditnota" : "Faktura";
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-6 print:rounded-none print:border-0" data-lp-invoice-document>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {kindLabel} {head.invoice_number ?? "(utkast)"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {providerName} → {companyName}
          </p>
          <p className="text-sm text-neutral-600">
            Periode: {formatDateNO(head.invoice_period_start)} – {formatDateNO(head.invoice_period_end)}
          </p>
          {head.credit_of_invoice_id ? (
            <p className="text-xs text-neutral-500">Kreditnota for faktura {head.credit_of_invoice_id.slice(0, 8)}…</p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">{invoiceStatusLabel(head.status)}</span>
          </p>
          {head.issued_at ? <p className="mt-2 text-neutral-600">Utstedt: {formatDateNO(head.issued_at.slice(0, 10))}</p> : null}
          {head.due_date && head.kind === "INVOICE" ? (
            <p className="text-neutral-600">
              Forfall: {formatDateNO(head.due_date)} ({head.payment_terms_days} dager)
            </p>
          ) : null}
          {head.recipient_email ? <p className="text-neutral-600">Mottaker: {head.recipient_email}</p> : null}
        </div>
      </header>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-1 pr-3">Beskrivelse</th>
            <th className="py-1 pr-3">Type</th>
            <th className="py-1 pr-3 text-right">Antall</th>
            <th className="py-1 pr-3 text-right">Enhetspris</th>
            <th className="py-1 pr-3 text-right">Netto</th>
            <th className="py-1 pr-3 text-right">MVA</th>
            <th className="py-1 text-right">Brutto</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-neutral-100">
              <td className="py-1.5 pr-3">{l.description ?? "—"}</td>
              <td className="py-1.5 pr-3 text-xs text-neutral-500">{l.source}</td>
              <td className="py-1.5 pr-3 text-right">{l.quantity}</td>
              <td className="py-1.5 pr-3 text-right">{money(l.unit_price, l.currency)}</td>
              <td className="py-1.5 pr-3 text-right">{money(l.line_amount, l.currency)}</td>
              <td className="py-1.5 pr-3 text-right">
                {money(l.vat_amount, l.currency)} ({(l.vat_rate * 100).toFixed(0)}%)
              </td>
              <td className="py-1.5 text-right font-medium">{money(l.line_amount + l.vat_amount, l.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Netto</dt>
            <dd>{money(head.amount_net, head.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">MVA</dt>
            <dd>{money(head.amount_tax, head.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-1 text-base font-semibold">
            <dt>Å betale</dt>
            <dd>{money(head.amount_total, head.currency)}</dd>
          </div>
          {head.amount_paid > 0 ? (
            <div className="flex justify-between text-emerald-700">
              <dt>Betalt</dt>
              <dd>{money(head.amount_paid, head.currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {payments.length > 0 ? (
        <section className="mt-5 border-t border-neutral-200 pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Registrerte betalinger</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {formatDateNO(p.paid_at.slice(0, 10))} · {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="font-medium">{money(p.amount, head.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        Betaling skjer via bankoverføring. Ingen kortbetaling (invoice-only).
      </footer>
    </article>
  );
}
