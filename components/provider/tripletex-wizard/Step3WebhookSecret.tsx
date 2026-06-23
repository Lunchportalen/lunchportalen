"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  finalizeConnectionAction,
  rotateWebhookSecretAction,
} from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

type Props = {
  providerId: string;
  onComplete: () => void;
};

export default function Step3WebhookSecret({ providerId, onComplete }: Props) {
  const t = useTranslations("provider.tripletex.wizard.steps.webhook");
  const [secretReady, setSecretReady] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepareSecret() {
      setLoadingSecret(true);
      const res = await rotateWebhookSecretAction({ providerId });
      if (cancelled) return;
      if (res.ok === false) {
        setError(res.error);
        setSecretReady(false);
        setLoadingSecret(false);
        return;
      }
      setSecretReady(true);
      setLoadingSecret(false);
    }

    void prepareSecret();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const handleFinalize = useCallback(async () => {
    if (submitting || !secretReady) return;
    setSubmitting(true);
    setError(null);

    const res = await finalizeConnectionAction({ providerId });
    setSubmitting(false);

    if (res.ok === false) {
      setError(res.error);
      return;
    }

    onComplete();
  }, [onComplete, providerId, secretReady, submitting]);

  return (
    <section className="ds-surface" aria-labelledby="tpt-step3-title">
      <p className="ds-eyebrow">{t("eyebrow")}</p>
      <h2 id="tpt-step3-title" className="ds-h3">
        {t("title")}
      </h2>
      <p className="ds-body ds-text-limit">{t("intro")}</p>

      {loadingSecret ? (
        <p className="ds-body-sm" aria-live="polite">
          {t("preparing")}
        </p>
      ) : secretReady ? (
        <p className="ds-body-sm" aria-live="polite">
          {t("ready")}
        </p>
      ) : (
        <p className="ds-body-sm" role="alert">
          {t("prepareFailed")}
        </p>
      )}

      {submitting ? (
        <p className="ds-body-sm" aria-live="polite">
          {t("registering")}
        </p>
      ) : null}

      {error ? (
        <p className="ds-body-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ds-wizard__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={() => void handleFinalize()}
          disabled={!secretReady || submitting || loadingSecret}
        >
          {submitting ? t("finalizing") : t("finalize")}
        </button>
      </div>
    </section>
  );
}
