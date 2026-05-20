"use client";

import { useState, useTransition } from "react";

import { saveProviderSettings, type ProviderSettingsInput } from "@/lib/providers/saveProviderSettings";
import type { Provider } from "@/lib/providers/types";

type FormState = "idle" | "loading" | "success" | "error";

export default function ProviderSettingsForm({ provider }: { provider: Provider }) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload: ProviderSettingsInput = {
      providerId: provider.id,
      name: String(fd.get("name") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      contactPhone: String(fd.get("contactPhone") ?? "") || null,
      primaryColor: String(fd.get("primaryColor") ?? "") || null,
    };

    setState("loading");
    setMessage(null);

    startTransition(async () => {
      const res = await saveProviderSettings(payload);
      if (res.ok) {
        setState("success");
        setMessage("Innstillinger lagret.");
        return;
      }
      setState("error");
      setMessage("error" in res ? res.error : "Kunne ikke lagre.");
    });
  }

  const statusClass =
    state === "success" ? "is-success" : state === "error" ? "is-error" : state === "loading" ? "" : "";

  return (
    <form className="lp-demo-form" onSubmit={onSubmit} noValidate>
      <p className="ds-lead">Profil for {provider.name}</p>
      <p className="ds-body">
        Slug: <strong>{provider.slug}</strong> (kan ikke endres her)
      </p>

      <label htmlFor="provider-name">Navn</label>
      <input id="provider-name" name="name" defaultValue={provider.name} required autoComplete="organization" />

      <label htmlFor="provider-email">Kontakt e-post</label>
      <input
        id="provider-email"
        name="contactEmail"
        type="email"
        defaultValue={provider.contactEmail}
        required
        autoComplete="email"
      />

      <label htmlFor="provider-phone">Kontakt telefon</label>
      <input id="provider-phone" name="contactPhone" type="tel" defaultValue={provider.contactPhone ?? ""} />

      <label htmlFor="provider-color">Primærfarge (hex)</label>
      <input id="provider-color" name="primaryColor" defaultValue={provider.primaryColor ?? ""} placeholder="#f5c518" />

      {provider.logoUrl ? (
        <p className="ds-body">
          Logo-URL: {provider.logoUrl} (opplasting kommer i senere patch)
        </p>
      ) : null}

      {message ? (
        <p className={`lp-demo-form__status ${statusClass}`} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <button type="submit" className="ds-btn ds-btn--primary" disabled={pending || state === "loading"}>
        {pending || state === "loading" ? "Lagrer…" : "Lagre innstillinger"}
      </button>
    </form>
  );
}
