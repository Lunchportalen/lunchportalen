"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { rotateWebhookSecretAction } from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";
import {
  disconnectTripletexAction,
  testConnectionAction,
} from "@/app/leverandor/innstillinger/tripletex/status/actions";
import type { TripletexTokenVerificationResult } from "@/lib/integrations/tripletex/onboardingVerify";
import { resolveTripletexActionError } from "@/lib/integrations/tripletex/tripletexActionErrors";

type Props = {
  providerId: string;
  connectionState: string;
  onChanged: () => void;
};

type ModalKind = "test" | "rotate" | "disconnect" | null;

function stepLabel(
  step: TripletexTokenVerificationResult["auth"],
  tOk: string,
  tFailed: string,
): string {
  return step.ok ? tOk : step.error ?? tFailed;
}

export default function StatusActions({ providerId, connectionState, onChanged }: Props) {
  const tActions = useTranslations("provider.tripletex.status.actions");
  const tModals = useTranslations("provider.tripletex.status.modals");
  const tErrors = useTranslations("provider.tripletex.errors");
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
      setError(resolveTripletexActionError((key) => tErrors(key), res, "connectionTestFailed"));
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
      setError(resolveTripletexActionError((key) => tErrors(key), res, "rotateFailed"));
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
      setError(resolveTripletexActionError((key) => tErrors(key), res, "disconnectFailed"));
      return;
    }
    closeModal();
    onChanged();
  };

  const copySecret = async () => {
    if (!rotatedSecret) return;
    try {
      await navigator.clipboard.writeText(rotatedSecret);
      setCopySecretMsg(tModals("copied"));
      window.setTimeout(() => setCopySecretMsg(null), 2000);
    } catch {
      setCopySecretMsg(tModals("copyFailed"));
    }
  };

  return (
    <div className="ds-tripletex-status__actions">
      <p className="ds-body-sm ds-tripletex-status__text-soft">{tActions("adminNote")}</p>

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
          {tActions("testConnection")}
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
          {tActions("rotateSecret")}
        </button>
        {canDisconnect ? (
          <button
            type="button"
            className="ds-tripletex-status__destructive-link"
            onClick={() => {
              setModal("disconnect");
              setError(null);
            }}
          >
            {tActions("disconnect")}
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
                  {tModals("test.title")}
                </h3>
                <p className="ds-body-sm">{tModals("test.body")}</p>
                {testResult ? (
                  <ul className="ds-tripletex-status__test-steps">
                    <li className="ds-body-sm">
                      {tModals("test.stepAuth")}:{" "}
                      {stepLabel(testResult.auth, tModals("ok"), tModals("failed"))}
                    </li>
                    <li className="ds-body-sm">
                      {tModals("test.stepCompany")}:{" "}
                      {stepLabel(testResult.company_match, tModals("ok"), tModals("failed"))}
                    </li>
                    <li className="ds-body-sm">
                      {tModals("test.stepScope")}:{" "}
                      {stepLabel(testResult.scope, tModals("ok"), tModals("failed"))}
                    </li>
                  </ul>
                ) : null}
              </>
            ) : null}

            {modal === "rotate" ? (
              <>
                <h3 id="tpt-modal-title" className="ds-h3">
                  {tModals("rotate.title")}
                </h3>
                <p className="ds-body-sm">{tModals("rotate.body")}</p>
                {rotatedSecret ? (
                  <div className="ds-tripletex-status__copy-field">
                    <code className="ds-tripletex-status__copy-field-value">{rotatedSecret}</code>
                    <button type="button" className="ds-tripletex-status__copy-field-btn" onClick={() => void copySecret()}>
                      {copySecretMsg ?? tModals("copy")}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {modal === "disconnect" ? (
              <>
                <h3 id="tpt-modal-title" className="ds-h3">
                  {tModals("disconnect.title")}
                </h3>
                <p className="ds-body-sm ds-secret-warning">{tModals("disconnect.body")}</p>
              </>
            ) : null}

            {error ? <p className="ds-body-sm ds-tripletex-status__error">{error}</p> : null}

            <div className="ds-tripletex-status__modal-actions">
              <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={closeModal}>
                {tModals("close")}
              </button>
              {modal === "test" && !testResult ? (
                <button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={() => void runTest()}>
                  {busy ? tModals("test.running") : tModals("test.run")}
                </button>
              ) : null}
              {modal === "rotate" && !rotatedSecret ? (
                <button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={() => void runRotate()}>
                  {busy ? tModals("rotate.generating") : tModals("rotate.generate")}
                </button>
              ) : null}
              {modal === "disconnect" ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary ds-tripletex-status__btn-danger"
                  disabled={busy}
                  onClick={() => void runDisconnect()}
                >
                  {busy ? tModals("disconnect.confirming") : tModals("disconnect.confirm")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
