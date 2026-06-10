"use client";

import Link from "next/link";
import { Fragment } from "react";

import type { StartIntent } from "@/lib/public/geographyParams";
import { buildContinuationPath } from "@/lib/public/geographyParams";
import { DEFAULT_START_LOCALE, getStartCopy, type StartLocale } from "@/lib/i18n/startCopy";

/**
 * Positive coverage result — premium match confirmation.
 *
 * DATA GAP (documented, do not fake):
 * /api/public/coverage/check only returns { covered, hasServiceAreas,
 * postal_code, city, mvpForward }. The matched provider id from
 * lp_match_provider_by_postal_code is NOT exposed, and no provider names,
 * plans, menus or pricing exist in the response. Real supplier cards
 * require provider-match data in the coverage response (explicit API
 * contract change — needs approval).
 */
type Props = {
  city: string;
  postalCode: string;
  source: string;
  intent: StartIntent;
  /** Returns to the entry step so the user can change area. */
  onBack?: () => void;
  /** Locale for UI copy; defaults to Norwegian until app-wide resolver exists. */
  locale?: StartLocale;
};

export default function StartCoveredResult({
  city,
  postalCode,
  source,
  intent,
  onBack,
  locale = DEFAULT_START_LOCALE,
}: Props) {
  const copy = getStartCopy(locale).geography.covered;
  const href = buildContinuationPath(intent, { postalCode, city, source });
  const cta = intent === "register" ? copy.ctaRegister : copy.ctaDemo;

  return (
    <div className="lp-start-covered lp-start-step" role="status" aria-live="polite">
      <span className="lp-start-covered__mark" aria-hidden="true" />
      <h1 className="lp-start-covered__title font-heading">
        {copy.title.replace("{city}", city)}
      </h1>
      <p className="lp-start-covered__lead font-body">{copy.lead}</p>

      <div className="lp-start-flow lp-start-flow--panel lp-start-covered__flow" aria-label={copy.stepsLabel}>
        {copy.steps.map((step, i) => (
          <Fragment key={step}>
            {i > 0 ? <span className="lp-start-flow__rail" aria-hidden="true" /> : null}
            <span className="lp-start-flow__node">
              <span className="lp-start-flow__dot" aria-hidden="true" />
              {step}
            </span>
          </Fragment>
        ))}
      </div>

      <Link href={href} className="ds-btn ds-btn--primary lp-start-btn lp-start-covered__cta">
        {cta}
      </Link>

      {onBack ? (
        <button type="button" className="lp-start-back lp-start-covered__back" onClick={onBack}>
          ← {copy.back}
        </button>
      ) : null}
    </div>
  );
}
