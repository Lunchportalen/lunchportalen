// components/billing/InvoiceDocument.tsx
// FASE 8 — kanonisk HTML-fakturadokument (print = PDF via nettleser).
// FASE 11 — fakturaen bruker COMPANY BILLING LANGUAGE (kjøpers språk) og
// markedets Intl-locale for tall-/datoformat. Beløp, valutakoder,
// fakturanummer og kanoniske statuser oversettes aldri.
// Server-komponent, delt av provider-, company- og superadmin-visningene.
import type { InvoiceHead, InvoiceLegalContext, InvoiceLine, InvoicePayment } from "@/lib/billing/invoiceLifecycle";
import { invoiceCopyForLanguage } from "@/lib/billing/invoiceCopy";

const NB_STATUS_LABELS = invoiceCopyForLanguage("nb").statusLabels;

/** Norsk statusetikett (brukes i norske liste-/supportflater). */
export function invoiceStatusLabel(status: string): string {
  return NB_STATUS_LABELS[status] ?? status;
}

export default function InvoiceDocument({
  head,
  lines,
  payments,
  providerName,
  companyName,
  legal,
}: {
  head: InvoiceHead;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  providerName: string;
  companyName: string;
  /** FASE 10/11 — lovpålagte felter + fakturaspråk/Intl-locale per marked. */
  legal?: InvoiceLegalContext;
}) {
  const copy = invoiceCopyForLanguage(legal?.invoiceLanguage);
  const intlLocale = legal?.intlLocale || "nb-NO";
  const taxLabel = legal?.taxLabel ?? "MVA";

  const money = (v: number, currency: string) =>
    `${new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} ${currency}`;
  const date = (iso: string) => new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(iso.slice(0, 10)));

  const kindLabel = head.kind === "CREDIT_NOTE" ? copy.creditNote : copy.invoice;
  const statusLabel = copy.statusLabels[head.status] ?? head.status;

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-6 print:rounded-none print:border-0" data-lp-invoice-document>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {kindLabel} {head.invoice_number ?? `(${copy.statusLabels.DRAFT ?? "DRAFT"})`}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {providerName} → {companyName}
          </p>
          {legal?.sellerTaxId ? (
            <p className="text-xs text-neutral-500" data-lp-legal="seller_tax_id">
              {copy.sellerTaxId}: {legal.sellerTaxId}
              {legal.marketCountry === "NO" ? " MVA" : ""}
            </p>
          ) : null}
          {legal?.buyerTaxId ? (
            <p className="text-xs text-neutral-500" data-lp-legal="buyer_tax_id">
              {copy.buyerTaxId}: {legal.buyerTaxId}
            </p>
          ) : null}
          {legal?.buyerAddress ? (
            <p className="text-xs text-neutral-500" data-lp-legal="buyer_address">
              {copy.buyerAddress}: {legal.buyerAddress}
              {legal.buyerStateProvince ? `, ${legal.buyerStateProvince}` : ""}
            </p>
          ) : null}
          <p className="text-sm text-neutral-600">
            {copy.period}: {date(head.invoice_period_start)} – {date(head.invoice_period_end)}
          </p>
          {head.credit_of_invoice_id ? (
            <p className="text-xs text-neutral-500">
              {copy.creditNoteFor} {head.credit_of_invoice_id.slice(0, 8)}…
            </p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">{statusLabel}</span>
          </p>
          {head.issued_at ? (
            <p className="mt-2 text-neutral-600">
              {copy.issued}: {date(head.issued_at)}
            </p>
          ) : null}
          {head.due_date && head.kind === "INVOICE" ? (
            <p className="text-neutral-600">
              {copy.due}: {date(head.due_date)} ({head.payment_terms_days} {copy.days})
            </p>
          ) : null}
          {head.recipient_email ? (
            <p className="text-neutral-600">
              {copy.recipient}: {head.recipient_email}
            </p>
          ) : null}
        </div>
      </header>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-1 pr-3">{copy.colDescription}</th>
            <th className="py-1 pr-3">{copy.colType}</th>
            <th className="py-1 pr-3 text-right">{copy.colQuantity}</th>
            <th className="py-1 pr-3 text-right">{copy.colUnitPrice}</th>
            <th className="py-1 pr-3 text-right">{copy.colNet}</th>
            <th className="py-1 pr-3 text-right">{taxLabel}</th>
            <th className="py-1 text-right">{copy.colGross}</th>
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
            <dt className="text-neutral-600">{copy.totalNet}</dt>
            <dd>{money(head.amount_net, head.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">{taxLabel}</dt>
            <dd>{money(head.amount_tax, head.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-1 text-base font-semibold">
            <dt>{copy.totalToPay}</dt>
            <dd>{money(head.amount_total, head.currency)}</dd>
          </div>
          {head.amount_paid > 0 ? (
            <div className="flex justify-between text-emerald-700">
              <dt>{copy.totalPaid}</dt>
              <dd>{money(head.amount_paid, head.currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {payments.length > 0 ? (
        <section className="mt-5 border-t border-neutral-200 pt-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{copy.paymentsTitle}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {date(p.paid_at)} · {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="font-medium">{money(p.amount, head.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        {legal?.reverseChargeNote ? (
          <p className="mb-1 font-semibold" data-lp-legal="reverse_charge_note">
            {legal.reverseChargeNote}
          </p>
        ) : null}
        {legal?.taxExemptNote ? (
          <p className="mb-1 font-semibold" data-lp-legal="tax_exempt_note">
            {legal.taxExemptNote}
          </p>
        ) : null}
        {copy.footer}
      </footer>
    </article>
  );
}
