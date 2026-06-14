import Link from "next/link";

import type { OnboardingChecklistStep } from "@/lib/admin/dashboardOnboarding";
import { INVITE_EMPLOYEES_HREF } from "@/lib/admin/dashboardOnboarding";

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="ds-admin-onboard__check-icon">
      <path d="M4 10.2 8.1 14.3 16 6.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function stepClass(state: OnboardingChecklistStep["state"]) {
  if (state === "completed") return "ds-admin-onboard__step is-done";
  if (state === "current") return "ds-admin-onboard__step is-current";
  if (state === "info") return "ds-admin-onboard__step is-info";
  return "ds-admin-onboard__step";
}

export default function OnboardingActionPanel({ steps }: { steps: OnboardingChecklistStep[] }) {
  return (
    <section className="ds-admin-onboard ds-admin-onboard--panel" aria-label="Kom i gang">
      <div className="ds-admin-onboard__head">
        <div>
          <h2 className="ds-admin-onboard__title">Kom i gang med første bestilling</h2>
          <p className="ds-admin-onboard__sub">
            Når første ansatte er lagt til, vises bestillinger og adopsjon automatisk her.
          </p>
        </div>
      </div>

      <ol className="ds-admin-onboard__list">
        {steps.map((step) => (
          <li key={step.label} className={stepClass(step.state)}>
            <span className="ds-admin-onboard__marker" aria-hidden="true">
              {step.state === "completed" ? (
                <CheckIcon />
              ) : step.state === "current" ? (
                "●"
              ) : step.state === "info" ? (
                "i"
              ) : (
                "○"
              )}
            </span>
            <div className="ds-admin-onboard__copy">
              <span className="ds-admin-onboard__label">{step.label}</span>
              <span className="ds-admin-onboard__detail">{step.detail}</span>
            </div>
            {step.state === "current" ? <span className="ds-admin-onboard__badge">Nå</span> : null}
          </li>
        ))}
      </ol>

      <div className="ds-admin-onboard__actions">
        <Link href={INVITE_EMPLOYEES_HREF} className="ds-btn ds-admin-onboard__cta">
          Inviter ansatte
        </Link>
      </div>
    </section>
  );
}
