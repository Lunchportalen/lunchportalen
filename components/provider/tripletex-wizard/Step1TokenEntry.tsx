"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  completeConnectionAction,
  verifyTokenAction,
} from "@/app/leverandor/innstillinger/tripletex/koble-til/actions";
import type { TripletexTokenVerificationResult } from "@/lib/integrations/tripletex/onboardingVerify";

import type { VerifyItemKey, VerifyItemState } from "./types";

type Props = {
  providerId: string;
  onComplete: () => void;
  onVerifyingChange?: (verifying: boolean) => void;
};

type VerifyDisplay = Record<VerifyItemKey, { state: VerifyItemState; message: string }>;

function initialVerifyDisplay(): VerifyDisplay {
  return {
    auth: { state: "idle", message: "" },
    company_match: { state: "idle", message: "" },
    scope: { state: "idle", message: "" },
  };
}

const VERIFY_KEYS: VerifyItemKey[] = ["auth", "company_match", "scope"];

function verifyLabelKey(key: VerifyItemKey): "auth" | "companyMatch" | "scope" {
  if (key === "company_match") return "companyMatch";
  if (key === "scope") return "scope";
  return "auth";
}

function verifySuccessKey(key: VerifyItemKey): "authOk" | "companyOk" | "scopeOk" {
  if (key === "company_match") return "companyOk";
  if (key === "scope") return "scopeOk";
  return "authOk";
}

function staggerApplyResult(
  result: TripletexTokenVerificationResult,
  apply: (key: VerifyItemKey, state: VerifyItemState, message: string) => void,
  labels: {
    success: (key: VerifyItemKey) => string;
    skipped: string;
    failed: string;
  },
): Promise<void> {
  const delays = [0, 120, 240];

  return new Promise((resolve) => {
    VERIFY_KEYS.forEach((key, index) => {
      window.setTimeout(() => {
        const step = result[key];
        const priorFailed = VERIFY_KEYS.slice(0, index).some((priorKey) => !result[priorKey].ok);

        if (step.ok) {
          apply(key, "success", labels.success(key));
        } else if (priorFailed) {
          apply(key, "skipped", labels.skipped);
        } else {
          apply(key, "error", step.error || labels.failed);
        }

        if (index === VERIFY_KEYS.length - 1) resolve();
      }, delays[index]);
    });
  });
}

function VerifyIcon({ state }: { state: VerifyItemState }) {
  if (state === "pending") {
    return (
      <span className="ds-verify-item__icon" aria-hidden="true">
        …
      </span>
    );
  }
  if (state === "success") {
    return (
      <span className="ds-verify-item__icon" aria-hidden="true">
        ✓
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="ds-verify-item__icon" aria-hidden="true">
        ✗
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="ds-verify-item__icon" aria-hidden="true">
        —
      </span>
    );
  }
  return <span className="ds-verify-item__icon" aria-hidden="true" />;
}

export default function Step1TokenEntry({ providerId, onComplete, onVerifyingChange }: Props) {
  const t = useTranslations("provider.tripletex.wizard.steps.token");
  const tVerify = useTranslations("provider.tripletex.wizard.verify");
  const tModals = useTranslations("provider.tripletex.status.modals");

  const [companyId, setCompanyId] = useState("");
  const [companyIdError, setCompanyIdError] = useState<string | null>(null);
  const [verifyDisplay, setVerifyDisplay] = useState<VerifyDisplay>(initialVerifyDisplay);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [tokenLocked, setTokenLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const verifyStatusRef = useRef<HTMLDivElement>(null);

  const applyVerifyItem = useCallback((key: VerifyItemKey, state: VerifyItemState, message: string) => {
    setVerifyDisplay((prev) => ({
      ...prev,
      [key]: { state, message },
    }));
  }, []);

  const handleVerify = async () => {
    setFormError(null);
    setCompanyIdError(null);
    setVerified(false);
    setTokenLocked(false);

    const token = safeTrim(tokenRef.current?.value ?? "");
    const digits = companyId.replace(/\s+/g, "");

    if (!/^\d{6,12}$/.test(digits)) {
      setCompanyIdError(t("companyIdInvalid"));
      return;
    }
    if (!token) {
      setFormError(t("tokenMissing"));
      return;
    }

    setVerifying(true);
    onVerifyingChange?.(true);
    setVerifyDisplay({
      auth: { state: "pending", message: tVerify("auth") },
      company_match: { state: "pending", message: tVerify("companyMatch") },
      scope: { state: "pending", message: tVerify("scope") },
    });

    const res = await verifyTokenAction({
      providerId,
      tripletexCompanyId: digits,
      employeeToken: token,
    });

    if (res.ok === false) {
      setVerifying(false);
      onVerifyingChange?.(false);
      setVerifyDisplay(initialVerifyDisplay());
      setFormError(res.error);
      return;
    }

    await staggerApplyResult(res.data, applyVerifyItem, {
      success: (key) => tVerify(verifySuccessKey(key)),
      skipped: t("notRun"),
      failed: tModals("failed"),
    });
    setVerifying(false);
    onVerifyingChange?.(false);

    if (res.data.all_passed) {
      setVerified(true);
      setTokenLocked(true);
    } else {
      setFormError(t("checksFailed"));
    }

    verifyStatusRef.current?.focus();
  };

  const handleContinue = async () => {
    if (!verified || submitting) return;

    const token = safeTrim(tokenRef.current?.value ?? "");
    const digits = companyId.replace(/\s+/g, "");

    if (!token) {
      setFormError(t("tokenMissingOnContinue"));
      setVerified(false);
      setTokenLocked(false);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const res = await completeConnectionAction({
      providerId,
      tripletexCompanyId: digits,
      employeeToken: token,
    });

    setSubmitting(false);

    if (res.ok === false) {
      setFormError(res.error);
      return;
    }

    if (tokenRef.current) tokenRef.current.value = "";
    setTokenLocked(false);
    onComplete();
  };

  const handleRetry = () => {
    setVerified(false);
    setTokenLocked(false);
    setVerifyDisplay(initialVerifyDisplay());
    setFormError(null);
    if (tokenRef.current) tokenRef.current.value = "";
    tokenRef.current?.focus();
  };

  const allSuccess =
    verified &&
    verifyDisplay.auth.state === "success" &&
    verifyDisplay.company_match.state === "success" &&
    verifyDisplay.scope.state === "success";

  const hasVerifyError = Object.values(verifyDisplay).some((v) => v.state === "error");

  return (
    <section className="ds-surface" aria-labelledby="tpt-step1-title">
      <p className="ds-eyebrow">{t("eyebrow")}</p>
      <h2 id="tpt-step1-title" className="ds-h3">
        {t("title")}
      </h2>
      <p className="ds-body ds-text-limit">{t("intro")}</p>

      <form className="lp-demo-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <label htmlFor="tpt-company-id">{t("companyIdLabel")}</label>
        <input
          id="tpt-company-id"
          inputMode="numeric"
          autoComplete="off"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          aria-invalid={companyIdError ? true : undefined}
          aria-describedby={companyIdError ? "tpt-company-id-hint" : "tpt-company-id-help"}
          disabled={verifying || submitting || tokenLocked}
        />
        {companyIdError ? (
          <p id="tpt-company-id-hint" className="ds-body-sm" role="alert">
            {companyIdError}
          </p>
        ) : (
          <p id="tpt-company-id-help" className="ds-body-sm">
            {t("companyIdHelp")}
          </p>
        )}

        <label htmlFor="tpt-employee-token">{t("tokenLabel")}</label>
        <input
          ref={tokenRef}
          id="tpt-employee-token"
          type="password"
          autoComplete="off"
          aria-describedby="tpt-token-hint tpt-verify-status"
          disabled={verifying || submitting || tokenLocked}
        />
        <p id="tpt-token-hint" className="ds-body-sm">
          {tokenLocked ? t("tokenHintVerified") : t("tokenHintPending")}
        </p>

        {!allSuccess ? (
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={handleVerify}
            disabled={verifying || submitting}
          >
            {verifying ? t("verifying") : t("verify")}
          </button>
        ) : null}
      </form>

      {(verifying || verified || hasVerifyError) && (
        <div
          id="tpt-verify-status"
          ref={verifyStatusRef}
          tabIndex={-1}
          aria-live="polite"
          aria-atomic="true"
        >
          <ul className="ds-verify-list">
            {VERIFY_KEYS.map((key) => {
              const item = verifyDisplay[key];
              if (item.state === "idle") return null;
              const modifier =
                item.state === "pending"
                  ? "ds-verify-item--pending"
                  : item.state === "success"
                    ? "ds-verify-item--success"
                    : item.state === "skipped"
                      ? "ds-verify-item--skipped"
                      : "ds-verify-item--error";
              return (
                <li key={key} className={`ds-verify-item ${modifier}`}>
                  <VerifyIcon state={item.state} />
                  <span className="ds-body-sm">
                    {item.state === "pending"
                      ? tVerify(verifyLabelKey(key))
                      : item.message}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {formError ? (
        <p className="ds-body-sm" role="alert">
          {formError}
        </p>
      ) : null}

      {allSuccess ? (
        <div className="ds-wizard__actions">
          <button type="button" className="ds-btn ds-btn--secondary" onClick={handleRetry}>
            {t("retry")}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={handleContinue}
            disabled={submitting}
          >
            {submitting ? t("connecting") : t("continue")}
          </button>
        </div>
      ) : hasVerifyError ? (
        <div className="ds-wizard__actions">
          <button type="button" className="ds-btn ds-btn--secondary" onClick={handleRetry}>
            {t("retry")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function safeTrim(value: string): string {
  return String(value ?? "").trim();
}
