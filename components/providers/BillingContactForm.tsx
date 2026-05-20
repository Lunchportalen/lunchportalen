"use client";

import { useState, useTransition } from "react";

import { updateBillingContact } from "@/app/leverandor/faktura/actions";
import type { ProviderSubscriptionRow } from "@/lib/providers/loadProviderBilling";

export default function BillingContactForm({
  providerId,
  subscription,
}: {
  providerId: string;
  subscription: ProviderSubscriptionRow;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(subscription.billing_email);
  const [orgNumber, setOrgNumber] = useState(subscription.billing_org_number ?? "");
  const [address, setAddress] = useState(subscription.billing_address ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setOpen(true)}>
        Endre fakturakontakt
      </button>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await updateBillingContact(providerId, email, orgNumber, address);
      if (!res.success) {
        setError("error" in res ? res.error : "Kunne ikke lagre.");
        return;
      }
      setMessage("Fakturakontakt oppdatert.");
      setOpen(false);
    });
  }

  return (
    <form className="lp-demo-form ds-provider-billing-contact-form" onSubmit={onSubmit} noValidate>
      <h2 className="ds-h4">Fakturakontakt</h2>
      <label htmlFor="bill-email">
        Faktura e-post
        <input
          id="bill-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label htmlFor="bill-org">
        Org.nr (valgfritt)
        <input
          id="bill-org"
          inputMode="numeric"
          value={orgNumber}
          onChange={(e) => setOrgNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      </label>
      <label htmlFor="bill-address">
        Fakturaadresse (valgfritt)
        <textarea
          id="bill-address"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
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
      <div className="ds-provider-dialog__actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setOpen(false)}>
          Avbryt
        </button>
        <button type="submit" className="ds-btn ds-btn--primary" disabled={pending}>
          {pending ? "Lagrer…" : "Lagre"}
        </button>
      </div>
    </form>
  );
}
