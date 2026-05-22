"use client";

import { useCallback, useEffect, useState } from "react";

import {
  finalizeConnectionAction,
  rotateWebhookSecretAction,
} from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

type Props = {
  providerId: string;
  onComplete: () => void;
};

export default function Step3WebhookSecret({ providerId, onComplete }: Props) {
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
      <p className="ds-eyebrow">Steg 4 av 5</p>
      <h2 id="tpt-step3-title" className="ds-h3">
        Webhook-registrering
      </h2>
      <p className="ds-body ds-text-limit">
        Lunchportalen registrerer webhook-abonnement i Tripletex automatisk. Du trenger ikke lime inn
        URL eller secret manuelt.
      </p>

      {loadingSecret ? (
        <p className="ds-body-sm" aria-live="polite">
          Forbereder webhook-secret…
        </p>
      ) : secretReady ? (
        <p className="ds-body-sm" aria-live="polite">
          Klar. Trykk «Fullfør oppsett» for å registrere webhook og fullføre tilkoblingen.
        </p>
      ) : (
        <p className="ds-body-sm" role="alert">
          Kunne ikke forberede webhook-secret.
        </p>
      )}

      {submitting ? (
        <p className="ds-body-sm" aria-live="polite">
          Registrerer webhook i Tripletex…
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
          {submitting ? "Fullfører…" : "Fullfør oppsett"}
        </button>
      </div>
    </section>
  );
}
