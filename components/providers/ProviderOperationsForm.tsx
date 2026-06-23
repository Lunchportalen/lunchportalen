"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  PROVIDER_LOCALE_OPTIONS,
  type ProviderOperationalSettings,
} from "@/lib/providers/operationalSettingsShared";
import {
  saveProviderOperationalSettings,
  type ProviderOperationalSettingsInput,
} from "@/lib/providers/saveProviderOperationalSettings";

type FormState = "idle" | "loading" | "success" | "error";

export default function ProviderOperationsForm({
  providerId,
  initial,
}: {
  providerId: string;
  initial: ProviderOperationalSettings;
}) {
  const t = useTranslations("provider.settings.operations");
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload: ProviderOperationalSettingsInput = {
      providerId,
      operationsEmail: String(fd.get("operationsEmail") ?? "") || null,
      kitchenEmail: String(fd.get("kitchenEmail") ?? "") || null,
      deliveryEmail: String(fd.get("deliveryEmail") ?? "") || null,
      locale: String(fd.get("locale") ?? initial.locale),
    };

    setState("loading");
    setMessage(null);

    startTransition(async () => {
      const res = await saveProviderOperationalSettings(payload);
      if (res.ok) {
        setState("success");
        setMessage(t("saved"));
        return;
      }
      setState("error");
      setMessage("error" in res ? res.error : t("saveFailed"));
    });
  }

  const statusClass = state === "success" ? "is-success" : state === "error" ? "is-error" : "";

  return (
    <form className="lp-demo-form ds-provider-ops" onSubmit={onSubmit} noValidate>
      <div className="ds-provider-ops__grid">
        <div className="ds-provider-ops__field">
          <label htmlFor="ops-operations-email">{t("operationsEmailLabel")}</label>
          <input
            id="ops-operations-email"
            name="operationsEmail"
            type="email"
            defaultValue={initial.operationsEmail ?? ""}
            autoComplete="off"
            inputMode="email"
          />
          <p className="ds-provider-ops__hint">{t("operationsEmailHint")}</p>
        </div>

        <div className="ds-provider-ops__field">
          <label htmlFor="ops-kitchen-email">{t("kitchenEmailLabel")}</label>
          <input
            id="ops-kitchen-email"
            name="kitchenEmail"
            type="email"
            defaultValue={initial.kitchenEmail ?? ""}
            autoComplete="off"
            inputMode="email"
          />
          <p className="ds-provider-ops__hint">{t("kitchenEmailHint")}</p>
        </div>

        <div className="ds-provider-ops__field">
          <label htmlFor="ops-delivery-email">{t("deliveryEmailLabel")}</label>
          <input
            id="ops-delivery-email"
            name="deliveryEmail"
            type="email"
            defaultValue={initial.deliveryEmail ?? ""}
            autoComplete="off"
            inputMode="email"
          />
          <p className="ds-provider-ops__hint">{t("deliveryEmailHint")}</p>
        </div>

        <div className="ds-provider-ops__field">
          <label htmlFor="ops-locale">{t("localeLabel")}</label>
          <select id="ops-locale" name="locale" defaultValue={initial.locale}>
            {PROVIDER_LOCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`locales.${o.value}`)}
              </option>
            ))}
          </select>
          <p className="ds-provider-ops__hint">{t("localeHint")}</p>
        </div>
      </div>

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
