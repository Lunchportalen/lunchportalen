"use client";

import { Fragment, useState } from "react";

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
      <div className="lp-start-stage">
        <div className="lp-start-stage__view lp-start-stage__view--gate" aria-labelledby="start-page-title">
          <div className="lp-start-gate">
            <div className="lp-start-gate__intro">
              <h1 id="start-page-title" className="lp-start-gate__title font-heading">
                <span className="lp-start-enter lp-start-enter--headline-1">
                  {copy.gate.headlineLines[0]}
                </span>
                <span className="lp-start-enter lp-start-enter--headline-2 lp-start-gate__title-line--accent">
                  {copy.gate.headlineLines[1]}
                </span>
              </h1>
              <p className="lp-start-gate__lead font-body lp-start-enter lp-start-enter--lead">
                {copy.gate.lead}
              </p>
              <div
                className="lp-start-flow lp-start-enter lp-start-enter--flow"
                aria-label={copy.gate.flowLabel}
              >
                {copy.gate.flowSteps.map((step, i) => (
                  <Fragment key={step}>
                    {i > 0 ? <span className="lp-start-flow__rail" aria-hidden="true" /> : null}
                    <span className="lp-start-flow__node">
                      <span className="lp-start-flow__dot" aria-hidden="true" />
                      {step}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>

            <div
              className="lp-start-gate__paths"
              role="group"
              aria-label={copy.gate.roleGroupLabel}
            >
              <button
                type="button"
                className="lp-start-path lp-start-path--business lp-start-enter lp-start-enter--panel-1"
                onClick={() => setRole("business")}
              >
                <div className="lp-start-path__body">
                  <span className="lp-start-path__kicker">{copy.paths.business.title}</span>
                  <span className="lp-start-path__subtitle">{copy.paths.business.subtitle}</span>
                  <p className="lp-start-path__text">{copy.paths.business.text}</p>
                </div>
                <span className="lp-start-path__cta">
                  <span className="lp-start-path__cta-label">{copy.paths.business.cta}</span>
                  <span className="lp-start-path__cta-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="lp-start-path lp-start-path--caterer lp-start-enter lp-start-enter--panel-2"
                onClick={() => setRole("caterer")}
              >
                <div className="lp-start-path__body">
                  <span className="lp-start-path__kicker">{copy.paths.caterer.title}</span>
                  <span className="lp-start-path__subtitle">{copy.paths.caterer.subtitle}</span>
                  <p className="lp-start-path__text">{copy.paths.caterer.text}</p>
                </div>
                <span className="lp-start-path__cta">
                  <span className="lp-start-path__cta-label">{copy.paths.caterer.cta}</span>
                  <span className="lp-start-path__cta-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeRole === "caterer") {
    return (
      <div className="lp-start-stage">
        <div className="lp-start-stage__view lp-start-stage__view--form">
          <div className="lp-start-panel lp-start-panel--form lp-start-panel--intake">
            <ProviderIntakeForm
              locale={locale}
              onBack={skipRoleGate ? undefined : () => setRole(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-start-stage">
      <div className="lp-start-stage__view lp-start-stage__view--form">
        <div className="lp-start-panel lp-start-panel--form lp-start-panel--geo">
          <div className="lp-start-intake">
            {!skipRoleGate ? (
              <button type="button" className="lp-start-back" onClick={() => setRole(null)}>
                ← {copy.geography.back}
              </button>
            ) : null}

            <GeographyGateForm locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
