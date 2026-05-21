"use client";

import { useCallback, useEffect, useState } from "react";

import {
  finalizeConnectionAction,
  rotateWebhookSecretAction,
} from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";

type Props = {
  providerId: string;
  webhookUrl: string;
  onComplete: () => void;
};

export default function Step3WebhookSecret({ providerId, webhookUrl, onComplete }: Props) {
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyUrlMsg, setCopyUrlMsg] = useState<string | null>(null);
  const [copySecretMsg, setCopySecretMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSecret() {
      setLoadingSecret(true);
      const res = await rotateWebhookSecretAction({ providerId });
      if (cancelled) return;
      if (res.ok === false) {
        setError(res.error);
        setLoadingSecret(false);
        return;
      }
      setWebhookSecret(res.data.webhook_secret);
      setLoadingSecret(false);
    }

    void loadSecret();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const copyText = useCallback(async (text: string, kind: "url" | "secret") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "url") {
        setCopyUrlMsg("Kopiert");
        window.setTimeout(() => setCopyUrlMsg(null), 2000);
      } else {
        setCopySecretMsg("Kopiert");
        window.setTimeout(() => setCopySecretMsg(null), 2000);
      }
    } catch {
      if (kind === "url") setCopyUrlMsg("Kunne ikke kopiere");
      else setCopySecretMsg("Kunne ikke kopiere");
    }
  }, []);

  const handleFinalize = async () => {
    if (!confirmed || submitting || !webhookSecret) return;
    setSubmitting(true);
    setError(null);

    const res = await finalizeConnectionAction({ providerId });
    setSubmitting(false);

    if (res.ok === false) {
      setError(res.error);
      return;
    }

    setWebhookSecret(null);
    onComplete();
  };

  return (
    <section className="ds-surface" aria-labelledby="tpt-step3-title">
      <p className="ds-eyebrow">Steg 4 av 5</p>
      <h2 id="tpt-step3-title" className="ds-h3">
        Registrér webhook i Tripletex
      </h2>
      <p className="ds-body ds-text-limit">
        For at vi skal motta betalingsstatus automatisk, må Tripletex sende webhook-kall til
        Lunchportalen.
      </p>

      <ol className="ds-body ds-text-limit">
        <li>Gå til Tripletex → Innstillinger → Webhook-integrasjoner</li>
        <li>Lim inn webhook-URL nedenfor</li>
        <li>Lim inn webhook-secret i Tripletex (vises kun én gang her)</li>
      </ol>

      <p className="ds-body-sm">Webhook-URL</p>
      <div className="ds-secret-display">
        <span>{webhookUrl}</span>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={() => copyText(webhookUrl, "url")}
          aria-label="Kopier webhook-URL"
        >
          {copyUrlMsg ?? "Kopier"}
        </button>
      </div>

      <p className="ds-body-sm">Webhook-secret</p>
      {loadingSecret ? (
        <p className="ds-body-sm" aria-live="polite">
          Genererer secret…
        </p>
      ) : webhookSecret ? (
        <>
          <div className="ds-secret-display">
            <span>{webhookSecret}</span>
            <button
              type="button"
              className="ds-btn ds-btn--secondary"
              onClick={() => copyText(webhookSecret, "secret")}
              aria-label="Kopier webhook-secret. Vises kun denne ene gangen."
            >
              {copySecretMsg ?? "Kopier"}
            </button>
          </div>
          <div className="ds-secret-warning" role="note">
            Denne secret vises ikke igjen. Lagre den i Tripletex-konfigurasjonen nå.
          </div>
        </>
      ) : (
        <p className="ds-body-sm" role="alert">
          Kunne ikke generere webhook-secret.
        </p>
      )}

      <label className="ds-body">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={!webhookSecret || loadingSecret}
        />{" "}
        Jeg har registrert webhook i Tripletex
      </label>

      {error ? (
        <p className="ds-body-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ds-wizard__actions">
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={handleFinalize}
          disabled={!confirmed || !webhookSecret || submitting || loadingSecret}
        >
          {submitting ? "Fullfører…" : "Fullfør oppsett"}
        </button>
      </div>
    </section>
  );
}
