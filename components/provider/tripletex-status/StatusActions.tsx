"use client";

import { useCallback, useState } from "react";

import { rotateWebhookSecretAction } from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";
import {
  disconnectTripletexAction,
  testConnectionAction,
} from "@/app/leverandor/innstillinger/tripletex/status/actions";
import type { TripletexTokenVerificationResult } from "@/lib/integrations/tripletex/onboardingVerify";

type Props = {
  providerId: string;
  connectionState: string;
  onChanged: () => void;
};

type ModalKind = "test" | "rotate" | "disconnect" | null;

function stepLabel(step: TripletexTokenVerificationResult["auth"]): string {
  return step.ok ? "OK" : step.error ?? "Feilet";
}

export default function StatusActions({ providerId, connectionState, onChanged }: Props) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TripletexTokenVerificationResult | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [copySecretMsg, setCopySecretMsg] = useState<string | null>(null);

  const canDisconnect = connectionState === "CONNECTED" || connectionState === "DEGRADED";

  const closeModal = useCallback(() => {
    if (busy) return;
    setModal(null);
    setError(null);
    setTestResult(null);
    setRotatedSecret(null);
    setCopySecretMsg(null);
  }, [busy]);

  const runTest = async () => {
    setBusy(true);
    setError(null);
    setTestResult(null);
    const res = await testConnectionAction({ providerId });
    setBusy(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setTestResult(res.data);
    onChanged();
  };

  const runRotate = async () => {
    setBusy(true);
    setError(null);
    setRotatedSecret(null);
    const res = await rotateWebhookSecretAction({ providerId });
    setBusy(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setRotatedSecret(res.data.webhook_secret);
    onChanged();
  };

  const runDisconnect = async () => {
    setBusy(true);
    setError(null);
    const res = await disconnectTripletexAction({ providerId });
    setBusy(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    closeModal();
    onChanged();
  };

  const copySecret = async () => {
    if (!rotatedSecret) return;
    try {
      await navigator.clipboard.writeText(rotatedSecret);
      setCopySecretMsg("Kopiert");
      window.setTimeout(() => setCopySecretMsg(null), 2000);
    } catch {
      setCopySecretMsg("Kunne ikke kopiere");
    }
  };

  return (
    <section className="ds-surface ds-tripletex-status__actions" aria-labelledby="tpt-actions-title">
      <h2 id="tpt-actions-title" className="ds-h3">
        Handlinger
      </h2>
      <p className="ds-body-sm">Kun provider-admin kan utføre disse handlingene.</p>

      <div className="ds-tripletex-status__action-buttons">
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={() => {
            setModal("test");
            setError(null);
            setTestResult(null);
          }}
        >
          Test tilkobling
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--secondary"
          onClick={() => {
            setModal("rotate");
            setError(null);
            setRotatedSecret(null);
          }}
        >
          Roter webhook-secret
        </button>
        {canDisconnect ? (
          <button
            type="button"
            className="ds-btn ds-btn--secondary ds-tripletex-status__btn-danger"
            onClick={() => {
              setModal("disconnect");
              setError(null);
            }}
          >
            Koble fra Tripletex
          </button>
        ) : null}
      </div>

      {modal ? (
        <div className="ds-tripletex-status__modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="ds-tripletex-status__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tpt-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "test" ? (
              <>
                <h3 id="tpt-modal-title" className="ds-h3">
                  Test tilkobling
                </h3>
                <p className="ds-body-sm">
                  Kjører full 3-stegs verifisering mot Tripletex via lagrede credentials.
                </p>
                {testResult ? (
                  <ul className="ds-tripletex-status__test-steps">
                    <li className="ds-body-sm">Autentisering: {stepLabel(testResult.auth)}</li>
                    <li className="ds-body-sm">Selskap: {stepLabel(testResult.company_match)}</li>
                    <li className="ds-body-sm">Tilgang: {stepLabel(testResult.scope)}</li>
                  </ul>
                ) : null}
              </>
            ) : null}

            {modal === "rotate" ? (
              <>
                <h3 id="tpt-modal-title" className="ds-h3">
                  Roter webhook-secret
                </h3>
                <p className="ds-body-sm">
                  Genererer nytt secret. Oppdater webhook i Tripletex før du lukker dette vinduet.
                </p>
                {rotatedSecret ? (
                  <div className="ds-secret-display">
                    <code className="ds-body-sm">{rotatedSecret}</code>
                    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => void copySecret()}>
                      {copySecretMsg ?? "Kopier"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {modal === "disconnect" ? (
              <>
                <h3 id="tpt-modal-title" className="ds-h3">
                  Koble fra Tripletex
                </h3>
                <p className="ds-body-sm ds-secret-warning">
                  Tilkoblingen settes til frakoblet. Credentials beholdes i 30 dager slik at du kan koble til
                  igjen uten nytt token. Etter det slettes de permanent.
                </p>
              </>
            ) : null}

            {error ? <p className="ds-body-sm ds-tripletex-status__error">{error}</p> : null}

            <div className="ds-tripletex-status__modal-actions">
              <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={closeModal}>
                Lukk
              </button>
              {modal === "test" && !testResult ? (
                <button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={() => void runTest()}>
                  {busy ? "Tester…" : "Kjør test"}
                </button>
              ) : null}
              {modal === "rotate" && !rotatedSecret ? (
                <button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={() => void runRotate()}>
                  {busy ? "Genererer…" : "Generer nytt secret"}
                </button>
              ) : null}
              {modal === "disconnect" ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary ds-tripletex-status__btn-danger"
                  disabled={busy}
                  onClick={() => void runDisconnect()}
                >
                  {busy ? "Kobler fra…" : "Bekreft frakobling"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
