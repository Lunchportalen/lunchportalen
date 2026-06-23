"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { updateBillingContact } from "@/app/leverandor/faktura/actions";
import { resolveProviderBillingActionError } from "@/lib/providers/providerBillingActionErrors";
import type { ProviderSubscriptionRow } from "@/lib/providers/providerBillingShared";

export default function BillingContactForm({
  providerId,
  subscription,
}: {
  providerId: string;
  subscription: ProviderSubscriptionRow;
}) {
  const t = useTranslations("provider.billing.contact");
  const tErrors = useTranslations("provider.billing.errors");
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
        {t("editButton")}
      </button>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await updateBillingContact(providerId, email, orgNumber, address);
      if (res.success === false) {
        setError(resolveProviderBillingActionError((key) => tErrors(key), res, "saveFailed"));
        return;
      }
      setMessage(t("saved"));
      setOpen(false);
    });
  }

  return (
    <form className="lp-demo-form ds-provider-billing-contact-form" onSubmit={onSubmit} noValidate>
      <h2 className="ds-h4">{t("title")}</h2>
      <label htmlFor="bill-email">
        {t("emailLabel")}
        <input
          id="bill-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label htmlFor="bill-org">
        {t("orgLabel")}
        <input
          id="bill-org"
          inputMode="numeric"
          value={orgNumber}
          onChange={(e) => setOrgNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
        />
      </label>
      <label htmlFor="bill-address">
        {t("addressLabel")}
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
          {t("cancel")}
        </button>
        <button type="submit" className="ds-btn ds-btn--primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
