"use client";

import type { WizardScreen } from "./types";
import { WIZARD_PROGRESS_LABELS, progressIndexForScreen } from "./types";

type Props = {
  screen: WizardScreen;
  verifying: boolean;
};

export default function WizardProgress({ screen, verifying }: Props) {
  const current = progressIndexForScreen(screen, verifying);

  return (
    <div
      className="ds-wizard__progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={WIZARD_PROGRESS_LABELS.length - 1}
      aria-valuenow={current}
      aria-label={`Steg ${current + 1} av ${WIZARD_PROGRESS_LABELS.length}: ${WIZARD_PROGRESS_LABELS[current]}`}
    >
      {WIZARD_PROGRESS_LABELS.map((label, index) => {
        const complete = index < current;
        const isCurrent = index === current;
        const className = [
          "ds-wizard__progress-step",
          complete ? "ds-wizard__progress-step--complete" : "",
          isCurrent ? "ds-wizard__progress-step--current" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span
            key={label}
            className={className}
            aria-current={isCurrent ? "step" : undefined}
            title={label}
          />
        );
      })}
    </div>
  );
}
