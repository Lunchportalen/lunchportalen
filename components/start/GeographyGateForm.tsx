"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import CoverageWishForm from "@/components/start/CoverageWishForm";
import StartCoverageChecking from "@/components/start/StartCoverageChecking";
import StartCoveredResult from "@/components/start/StartCoveredResult";
import {
  isValidCity,
  isValidPostalCode,
  normalizeCity,
  normalizePostalCode,
  resolveSource,
  resolveStartIntent,
} from "@/lib/public/geographyParams";
import { resolveCityFromPostal } from "@/lib/public/resolveCityFromPostal";
import { DEFAULT_START_LOCALE, getStartCopy, type StartLocale } from "@/lib/i18n/startCopy";

type Step = "entry" | "checking" | "covered" | "uncovered";

type LocationForm = {
  postalCode: string;
  city: string;
};

type Props = {
  /** Locale for UI copy; defaults to Norwegian until app-wide resolver exists. */
  locale?: StartLocale;
};

export default function GeographyGateForm({ locale = DEFAULT_START_LOCALE }: Props) {
  const copy = getStartCopy(locale).geography;
  const searchParams = useSearchParams();

  const intent = useMemo(() => resolveStartIntent(searchParams.get("intent")), [searchParams]);
  const source = useMemo(() => resolveSource(searchParams.get("source")), [searchParams]);

  const [step, setStep] = useState<Step>("entry");
  const [location, setLocation] = useState<LocationForm>({ postalCode: "", city: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const autoCityRef = useRef<string | null>(null);
  const lookupRequestId = useRef(0);

  const updateLocation = useCallback((key: keyof LocationForm, value: string) => {
    setLocation((prev) => ({
      ...prev,
      [key]: key === "postalCode" ? normalizePostalCode(value) : value,
    }));
    if (key === "city") {
      autoCityRef.current = null;
    }
    setFieldError(null);
    setErrorMsg("");
  }, []);

  useEffect(() => {
    const postal = location.postalCode;
    if (!isValidPostalCode(postal)) {
      autoCityRef.current = null;
      return;
    }

    const requestId = ++lookupRequestId.current;
    void resolveCityFromPostal(postal).then((resolved) => {
      if (requestId !== lookupRequestId.current || !resolved) return;
      setLocation((prev) => {
        if (prev.postalCode !== postal) return prev;
        const canReplace = !prev.city.trim() || autoCityRef.current === prev.city;
        if (!canReplace) return prev;
        autoCityRef.current = resolved;
        return { ...prev, city: resolved };
      });
    });
  }, [location.postalCode]);

  const runCoverageCheck = useCallback(
    async (postal_code: string, city: string) => {
      setStep("checking");
      setStatus("loading");
      setErrorMsg("");
      setFieldError(null);

      try {
        const res = await fetch("/api/public/coverage/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postal_code, city }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { covered?: boolean; mvpForward?: boolean };
          detail?: { field?: string };
        };

        if (!res.ok || json.ok === false) {
          setStep("entry");
          setStatus("error");
          setErrorMsg(json.message ?? copy.errorGeneric);
          const field = json.detail?.field;
          if (field === "postal_code") setFieldError("postalCode");
          if (field === "city") setFieldError("city");
          return;
        }

        const covered = json.data?.covered === true;
        setLocation({ postalCode: postal_code, city });
        setStep(covered ? "covered" : "uncovered");
        setStatus("idle");
      } catch {
        setStep("entry");
        setStatus("error");
        setErrorMsg(copy.errorGeneric);
      }
    },
    [copy.errorGeneric],
  );

  const onSubmitEntry = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const postal_code = normalizePostalCode(location.postalCode);
      const city = normalizeCity(location.city);

      if (!isValidPostalCode(postal_code)) {
        setStatus("error");
        setErrorMsg(copy.errorPostal);
        setFieldError("postalCode");
        return;
      }

      if (!isValidCity(city)) {
        setStatus("error");
        setErrorMsg(copy.errorCity);
        setFieldError("city");
        return;
      }

      await runCoverageCheck(postal_code, city);
    },
    [location.city, location.postalCode, runCoverageCheck, copy.errorPostal, copy.errorCity],
  );

  if (step === "checking") {
    return <StartCoverageChecking label={copy.checking} />;
  }

  if (step === "covered") {
    return (
      <StartCoveredResult
        city={location.city}
        postalCode={location.postalCode}
        source={source}
        intent={intent}
        locale={locale}
        onBack={() => {
          setStep("entry");
          setStatus("idle");
          setErrorMsg("");
        }}
      />
    );
  }

  if (step === "uncovered") {
    return (
      <CoverageWishForm
        postalCode={location.postalCode}
        city={location.city}
        source={source}
        onBack={() => {
          setStep("entry");
          setStatus("idle");
          setErrorMsg("");
        }}
      />
    );
  }

  return (
    <div className="lp-start-step">
      <header className="lp-start-intake__header">
        <h1 id="start-page-title" className="lp-start-intake__title font-heading">
          {copy.title}
        </h1>
        <p className="lp-start-intake__lead font-body">{copy.lead}</p>
        <p className="lp-start-intake__note">{copy.reassurance}</p>
      </header>

      <div className="lp-start-flow lp-start-flow--panel" aria-label={copy.matchingLabel}>
        {copy.matchingSteps.map((s, i) => (
          <Fragment key={s}>
            {i > 0 ? <span className="lp-start-flow__rail" aria-hidden="true" /> : null}
            <span className="lp-start-flow__node">
              <span className="lp-start-flow__dot" aria-hidden="true" />
              {s}
            </span>
          </Fragment>
        ))}
      </div>

      <form className="lp-start-form lp-start-intake__form" onSubmit={onSubmitEntry} noValidate>
        <div className="lp-start-intake__grid">
          <div className="lp-start-field">
            <label className="lp-start-field__label" htmlFor="start-postal-code">
              {copy.fields.postalCode}
            </label>
            <input
              id="start-postal-code"
              type="text"
              name="postal_code"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              value={location.postalCode}
              onChange={(e) => updateLocation("postalCode", e.target.value)}
              className={`lp-start-field__input${fieldError === "postalCode" ? " is-invalid" : ""}`}
              maxLength={4}
              aria-describedby="start-postal-hint"
            />
            <p id="start-postal-hint" className="lp-start-field__hint">
              {copy.fields.postalCodeHint}
            </p>
          </div>

          <div className="lp-start-field">
            <label className="lp-start-field__label" htmlFor="start-city">
              {copy.fields.city}
            </label>
            <input
              id="start-city"
              type="text"
              name="city"
              autoComplete="address-level2"
              required
              value={location.city}
              onChange={(e) => updateLocation("city", e.target.value)}
              className={`lp-start-field__input${fieldError === "city" ? " is-invalid" : ""}`}
              maxLength={128}
            />
          </div>
        </div>

        {errorMsg ? (
          <p className="lp-start-form__status" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          className={`ds-btn ds-btn--primary lp-start-btn${status === "loading" ? " is-loading" : ""}`}
          disabled={status === "loading"}
        >
          {copy.cta}
        </button>
      </form>
    </div>
  );
}
