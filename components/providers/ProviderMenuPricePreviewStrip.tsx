"use client";

import { useTranslations, useLocale } from "next-intl";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { intlLocaleForAppLocale, isAppLocale } from "@/lib/i18n/localeRegistry";
import {
  formatPreviewTaxBasisLabel,
  previewAggregateSourceLabelKey,
  type ProviderMenuPricePreviewDisplayPayload,
} from "@/lib/providers/providerMenuPricePreviewDisplay";
import { formatPriceAmount } from "@/lib/providers/providerMenuPriceDisplay";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";

type Props = {
  tier: PlanTier;
  pricePreview: ProviderMenuPricePreviewDisplayPayload | null;
};

export default function ProviderMenuPricePreviewStrip({ tier, pricePreview }: Props) {
  const t = useTranslations("provider.menu.preview");
  const locale = useLocale();
  const intlLocale = isAppLocale(locale) ? intlLocaleForAppLocale(locale) : locale;

  if (!pricePreview?.preview) return null;

  const tierPreview = pricePreview.tiers[tier];
  if (!tierPreview) return null;

  const taxBasisKey = formatPreviewTaxBasisLabel(tierPreview.taxBasis);
  const taxBasisLabel =
    taxBasisKey === "ex_tax"
      ? t("taxEx")
      : taxBasisKey === "inc_tax"
        ? t("taxInc")
        : tierPreview.taxBasis;

  const metadataParts = [
    pricePreview.marketCode,
    tierPreview.currency,
    taxBasisLabel,
    tierPreview.rowSource,
  ].filter((part): part is string => Boolean(part && String(part).trim()));

  const sourceLabelKey = previewAggregateSourceLabelKey(pricePreview.aggregateSource);

  return (
    <section
      className="lp-editor-preview-strip"
      aria-label={t("ariaLabel")}
      data-preview-tier={tier}
    >
      <div className="lp-editor-preview-strip__main">
        <p className="lp-editor-preview-strip__title">{t("title")}</p>
        <p className="lp-editor-preview-strip__subtitle">{t("subtitle")}</p>
        <p className="lp-editor-preview-strip__meta">
          <span className="lp-editor-preview-strip__tier">{getTierDisplayLabel(tier, locale)}</span>
          {" · "}
          {formatPriceAmount(tierPreview.amountExVat, intlLocale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}{" "}
          {t("amountExSuffix")}
          {" / "}
          {formatPriceAmount(tierPreview.priceIncVatNok, intlLocale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {t("amountIncSuffix")}
        </p>
        {metadataParts.length > 0 ? (
          <p className="lp-editor-preview-strip__metadata">{metadataParts.join(" · ")}</p>
        ) : null}
      </div>
      <div className="lp-editor-preview-strip__aside">
        <span className="lp-editor-preview-strip__source">{t(sourceLabelKey)}</span>
        {tierPreview.differsFromProduction ? (
          <span className="lp-editor-preview-strip__differs" role="status">
            {t("differs")}
          </span>
        ) : null}
      </div>
    </section>
  );
}
