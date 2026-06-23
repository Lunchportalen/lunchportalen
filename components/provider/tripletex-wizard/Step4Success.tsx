"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { resolveTripletexConnectionStateLabel } from "@/lib/integrations/tripletex/tripletexStatusPresentation";

type Props = {
  companyName: string | null;
};

export default function Step4Success({ companyName }: Props) {
  const t = useTranslations("provider.tripletex.wizard.steps.success");
  const tState = useTranslations("provider.tripletex.state");

  return (
    <section className="ds-surface" aria-labelledby="tpt-step4-title">
      <p className="ds-eyebrow">{t("eyebrow")}</p>
      <h2 id="tpt-step4-title" className="ds-h3">
        {t("title")}
      </h2>

      <span className="ds-status-badge ds-status-badge--connected">
        {resolveTripletexConnectionStateLabel((key) => tState(key), "CONNECTED")}
      </span>

      {companyName ? (
        <p className="ds-body ds-text-limit">
          {t("companyPrefix")} {companyName}
        </p>
      ) : null}

      <p className="ds-body ds-text-limit">{t("canNow")}</p>
      <ul className="ds-body ds-text-limit">
        <li>{t("bulletInvoices")}</li>
        <li>{t("bulletPayments")}</li>
        <li>{t("bulletStatus")}</li>
      </ul>

      <div className="ds-wizard__actions">
        <Link className="ds-btn ds-btn--primary" href="/leverandor/faktura">
          {t("viewInvoices")}
        </Link>
        <Link className="ds-btn ds-btn--secondary" href="/leverandor/innstillinger/tripletex/status">
          {t("viewStatus")}
        </Link>
        <Link className="ds-btn ds-btn--secondary" href="/leverandor/innstillinger">
          {t("backToSettings")}
        </Link>
      </div>
    </section>
  );
}
