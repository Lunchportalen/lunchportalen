"use client";

import { useState } from "react";

import GeographyGateForm from "@/components/start/GeographyGateForm";
import ProviderIntakeForm from "@/components/start/ProviderIntakeForm";
import { DEFAULT_START_LOCALE, getStartCopy, type StartLocale } from "@/lib/i18n/startCopy";

type Role = "business" | "caterer";

type Props = {
  /** Server-resolved: true for ?intent=demo|register or valid geo params. */
  skipRoleGate: boolean;
  /** Locale for UI copy; defaults to Norwegian until app-wide resolver exists. */
  locale?: StartLocale;
};

export default function StartRoleChooser({
  skipRoleGate,
  locale = DEFAULT_START_LOCALE,
}: Props) {
  const copy = getStartCopy(locale);
  const [role, setRole] = useState<Role | null>(null);
  const activeRole = role ?? (skipRoleGate ? "business" : null);

  if (activeRole === null) {
    return (
      <div
        className="lp-start-gate lp-start-gate--animate lp-start-step"
        aria-labelledby="start-page-title"
      >
        <div className="lp-start-gate__intro lp-start-reveal lp-start-reveal--1">
          <h1 id="start-page-title" className="lp-start-gate__title font-heading">
            {copy.gate.headline}
          </h1>
          <p className="lp-start-gate__lead font-body">{copy.gate.lead}</p>
          <ul className="lp-start-trust" aria-label={copy.gate.trustListLabel}>
            {copy.gate.trustPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div
          className="lp-start-gate__paths"
          role="group"
          aria-label={copy.gate.roleGroupLabel}
        >
          <button
            type="button"
            className="lp-start-path lp-start-path--business lp-start-reveal lp-start-reveal--2"
            onClick={() => setRole("business")}
          >
            <span className="lp-start-path__kicker">{copy.paths.business.title}</span>
            <span className="lp-start-path__subtitle">{copy.paths.business.subtitle}</span>
            <p className="lp-start-path__text">{copy.paths.business.text}</p>
            <span className="lp-start-path__cta">
              {copy.paths.business.cta}
              <span className="lp-start-path__cta-arrow" aria-hidden="true">
                →
              </span>
            </span>
          </button>

          <button
            type="button"
            className="lp-start-path lp-start-path--caterer lp-start-reveal lp-start-reveal--3"
            onClick={() => setRole("caterer")}
          >
            <span className="lp-start-path__kicker">{copy.paths.caterer.title}</span>
            <span className="lp-start-path__subtitle">{copy.paths.caterer.subtitle}</span>
            <p className="lp-start-path__text">{copy.paths.caterer.text}</p>
            <span className="lp-start-path__cta">
              {copy.paths.caterer.cta}
              <span className="lp-start-path__cta-arrow" aria-hidden="true">
                →
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (activeRole === "caterer") {
    return (
      <div className="lp-start-panel lp-start-panel--form lp-start-step">
        <ProviderIntakeForm onBack={skipRoleGate ? undefined : () => setRole(null)} />
      </div>
    );
  }

  return (
    <div className="lp-start-panel lp-start-panel--form lp-start-step">
      <header className="lp-start-panel__header">
        <h1 id="start-page-title" className="lp-start-panel__title font-heading">
          {copy.geography.title}
        </h1>
        <p className="lp-start-panel__lead font-body">{copy.geography.lead}</p>
      </header>

      {!skipRoleGate ? (
        <button type="button" className="lp-start-back" onClick={() => setRole(null)}>
          ← {copy.geography.back}
        </button>
      ) : null}

      <GeographyGateForm />
    </div>
  );
}
