"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import Step1TokenEntry from "./Step1TokenEntry";
import Step2Provisioning from "./Step2Provisioning";
import Step3WebhookSecret from "./Step3WebhookSecret";
import Step4Success from "./Step4Success";
import type { WizardScreen } from "./types";
import WizardProgress from "./WizardProgress";

type Props = {
  providerId: string;
  providerName: string;
  webhookUrl: string;
  initialStep: WizardScreen;
  initialCompanyName?: string | null;
};

export default function DirectWizard({
  providerId,
  providerName,
  webhookUrl,
  initialStep,
  initialCompanyName = null,
}: Props) {
  const t = useTranslations("provider.tripletex.wizard");
  const [screen, setScreen] = useState<WizardScreen>(initialStep);
  const [verifying, setVerifying] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(initialCompanyName);

  const goProvisioning = useCallback(() => {
    setVerifying(false);
    setScreen("provisioning");
  }, []);

  const goWebhook = useCallback(() => {
    setScreen("webhook");
  }, []);

  const goSuccess = useCallback(() => {
    setScreen("success");
  }, []);

  return (
    <div className="ds-wizard">
      <header className="ds-section">
        <p className="ds-eyebrow">{t("eyebrow")}</p>
        <h1 className="ds-h2">{t("heading")}</h1>
        <p className="ds-lead">{t("leadForProvider", { providerName })}</p>
      </header>

      <WizardProgress screen={screen} verifying={verifying} />

      {screen === "token" ? (
        <Step1TokenEntry
          providerId={providerId}
          onComplete={goProvisioning}
          onVerifyingChange={setVerifying}
        />
      ) : null}

      {screen === "provisioning" ? (
        <Step2Provisioning providerId={providerId} onComplete={goWebhook} />
      ) : null}

      {screen === "webhook" ? (
        <Step3WebhookSecret providerId={providerId} onComplete={goSuccess} />
      ) : null}

      {screen === "success" ? <Step4Success companyName={companyName} /> : null}
    </div>
  );
}
