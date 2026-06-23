"use client";

import { useTranslations } from "next-intl";

import type { WizardScreen } from "./types";
import { WIZARD_PROGRESS_KEYS, progressIndexForScreen } from "./types";

type Props = {
  screen: WizardScreen;
  verifying: boolean;
};

export default function WizardProgress({ screen, verifying }: Props) {
  const t = useTranslations("provider.tripletex.wizard.progress");
  const labels = WIZARD_PROGRESS_KEYS.map((key) => t(key));
  const current = progressIndexForScreen(screen, verifying);

  return (
    <div
      className="ds-wizard__progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={labels.length - 1}
      aria-valuenow={current}
      aria-label={t("ariaLabel", {
        current: current + 1,
        total: labels.length,
        label: labels[current],
      })}
    >
      {labels.map((label, index) => {
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
            key={WIZARD_PROGRESS_KEYS[index]}
            className={className}
            aria-current={isCurrent ? "step" : undefined}
            title={label}
          />
        );
      })}
    </div>
  );
}
