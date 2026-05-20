"use client";

import { useState, useTransition } from "react";

import {
  generateProviderInvoice,
  setProviderSubscription,
} from "@/app/superadmin/providers/actions";
import { PLAN_LABELS, type ProviderBillingBundle } from "@/lib/providers/providerBillingShared";

function currentMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function SubscriptionEditor({
  providerId,
  providerName,
  defaultEmail,
  defaultOrgNumber,
  bundle,
}: {
  providerId: string;
  providerName: string;
  defaultEmail: string;
  defaultOrgNumber: string | null;
  bundle: ProviderBillingBundle;
}) {
  const sub = bundle.activeSubscription;
  const [plan, setPlan] = useState(sub?.plan ?? "SAAS_FIXED");
  const [monthlyAmount, setMonthlyAmount] = useState(
    sub ? String(sub.monthly_amount) : "2990",
  );
  const [billingEmail, setBillingEmail] = useState(sub?.billing_email ?? defaultEmail);
  const [billingOrgNumber, setBillingOrgNumber] = useState(
    sub?.billing_org_number ?? defaultOrgNumber ?? "",
  );
  const [billingAddress, setBillingAddress] = useState(sub?.billing_address ?? "");
  const [notes, setNotes] = useState(sub?.notes ?? "");
  const [invoicePeriod, setInvoicePeriod] = useState(currentMonthIso());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSaveSubscription(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await setProviderSubscription({
        providerId,
        plan,
        monthlyAmount: Number(monthlyAmount),
        billingEmail,
        billingOrgNumber: billingOrgNumber || undefined,
        billingAddress: billingAddress || undefined,
        notes: notes || undefined,
      });
      if (!res.success) {
        setError("error" in res ? res.error : "Kunne ikke lagre.");
        return;
      }
      setMessage("Lisens lagret.");
    });
  }

  function onGenerateInvoice() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await generateProviderInvoice(providerId, invoicePeriod);
      if (!res.success) {
        setError("error" in res ? res.error : "Kunne ikke generere faktura.");
        return;
      }
      setMessage("Faktura generert (eller allerede eksisterte for perioden).");
    });
  }

  return (
    <div className="ds-provider-billing-admin">
      <form className="lp-demo-form ds-card" onSubmit={onSaveSubscription}>
        <h2 className="ds-h3">SaaS-lisens for {providerName}</h2>
        <label htmlFor="sub-plan">
          Plan
          <select id="sub-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="SAAS_FIXED">{PLAN_LABELS.SAAS_FIXED}</option>
            <option value="SAAS_PER_COMPANY">{PLAN_LABELS.SAAS_PER_COMPANY}</option>
            <option value="CUSTOM">{PLAN_LABELS.CUSTOM}</option>
          </select>
        </label>
        <label htmlFor="sub-amount">
          Beløp netto per måned (NOK)
          <input
            id="sub-amount"
            type="number"
            min={0}
            step="0.01"
            required
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
          />
        </label>
        <p className="ds-body">MVA 25% beregnes automatisk ved fakturagenerering.</p>
        <label htmlFor="sub-email">
          Faktura e-post
          <input
            id="sub-email"
            type="email"
            required
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
          />
        </label>
        <label htmlFor="sub-org">
          Org.nr
          <input
            id="sub-org"
            value={billingOrgNumber}
            onChange={(e) => setBillingOrgNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
          />
        </label>
        <label htmlFor="sub-address">
          Fakturaadresse
          <textarea
            id="sub-address"
            rows={2}
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
          />
        </label>
        <label htmlFor="sub-notes">
          Notat (internt)
          <textarea id="sub-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error ? (
          <p className="lp-demo-form__status is-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="lp-demo-form__status is-success" role="status">
            {message}
          </p>
        ) : null}
        <button type="submit" className="ds-btn ds-btn--primary" disabled={pending}>
          {pending ? "Lagrer…" : "Lagre lisens"}
        </button>
      </form>

      <section className="ds-card ds-provider-billing-generate">
        <h2 className="ds-h4">Generer månedsfaktura (manuell)</h2>
        <p className="ds-body">Idempotent: samme måned kan ikke faktureres to ganger.</p>
        <label htmlFor="inv-period">
          Fakturaperiode (første dag i måneden)
          <input
            id="inv-period"
            type="date"
            value={invoicePeriod}
            onChange={(e) => setInvoicePeriod(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          disabled={pending || !sub}
          onClick={onGenerateInvoice}
        >
          Generer faktura
        </button>
      </section>
    </div>
  );
}
