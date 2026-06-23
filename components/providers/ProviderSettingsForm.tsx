"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { saveProviderSettings, type ProviderSettingsInput } from "@/lib/providers/saveProviderSettings";
import type { Provider } from "@/lib/providers/types";

type FormState = "idle" | "loading" | "success" | "error";

export default function ProviderSettingsForm({ provider }: { provider: Provider }) {
  const t = useTranslations("provider.settings.profile");
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
    };

    setState("loading");
    setMessage(null);

    startTransition(async () => {
      const res = await saveProviderSettings(payload);
      if (res.ok) {
        setState("success");
        setMessage(t("saved"));
        return;
      }
      setState("error");
      setMessage("error" in res ? res.error : t("saveFailed"));
    });
  }

  const statusClass =
    state === "success" ? "is-success" : state === "error" ? "is-error" : state === "loading" ? "" : "";

  return (
    <form className="lp-demo-form" onSubmit={onSubmit} noValidate>
      <p className="ds-lead">{t("leadWithProvider", { providerName: provider.name })}</p>

      <label htmlFor="provider-name">{t("nameLabel")}</label>
      <input id="provider-name" name="name" defaultValue={provider.name} required autoComplete="organization" />

      <label htmlFor="provider-email">{t("emailLabel")}</label>
      <input
        id="provider-email"
        name="contactEmail"
        type="email"
        defaultValue={provider.contactEmail}
        required
        autoComplete="email"
      />

      <label htmlFor="provider-phone">{t("phoneLabel")}</label>
      <input id="provider-phone" name="contactPhone" type="tel" defaultValue={provider.contactPhone ?? ""} />

      {message ? (
        <p className={`lp-demo-form__status ${statusClass}`} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <button type="submit" className="ds-btn ds-btn--primary" disabled={pending || state === "loading"}>
        {pending || state === "loading" ? t("saving") : t("save")}
      </button>
    </form>
  );
}
