"use client";

import { useTranslations, useLocale } from "next-intl";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { isoWeekNumberFromMondayStart } from "@/lib/date/week";
import { intlLocaleForAppLocale, isAppLocale } from "@/lib/i18n/localeRegistry";
import {
  formatPriceAmount,
  type ProviderMenuPriceView,
} from "@/lib/providers/providerMenuPriceDisplay";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";

type Props = {
  tier: PlanTier;
  weekStart: string;
  prices: Record<PlanTier, ProviderMenuPriceView> | null;
  onTierChange: (tier: PlanTier) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  workspaceView: "week" | "catalog";
  onWorkspaceViewChange: (view: "week" | "catalog") => void;
};

export default function ProviderMenuCommandHeader({
  tier,
  weekStart,
  prices,
  onTierChange,
  onPrevWeek,
  onNextWeek,
  workspaceView,
  onWorkspaceViewChange,
}: Props) {
  const t = useTranslations("provider.menu");
  const locale = useLocale();
  const intlLocale = isAppLocale(locale) ? intlLocaleForAppLocale(locale) : locale;
  const tierPrice = prices?.[tier];
  const week = isoWeekNumberFromMondayStart(weekStart);
  const year = weekStart.slice(0, 4);

  const isCatalogView = workspaceView === "catalog";

  return (
    <header className={`lp-editor-command-header${isCatalogView ? " lp-editor-command-header--catalog" : ""}`}>
      <div className="lp-editor-page-head">
        <div className="lp-editor-page-head__main">
          <p className="lp-editor-page-head__eyebrow">{t("header.eyebrow")}</p>
          {isCatalogView ? (
            <>
              <h1 className="lp-editor-page-head__title">{t("catalogModel.title")}</h1>
              <p className="lp-editor-page-head__lead">{t("catalogModel.lead")}</p>
            </>
          ) : (
            <>
              <h1 className="lp-editor-page-head__title">{t("header.weekTitle", { week, year })}</h1>
              <p className="lp-editor-page-head__lead">{t("header.lead")}</p>
            </>
          )}
        </div>

        {isCatalogView ? null : (
          <div className="lp-editor-page-head__week-nav-pill" aria-label={t("header.weekNavAria")}>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onPrevWeek}>
              {t("header.prevWeek")}
            </button>
            <span className="lp-editor-page-head__week-label">{t("header.weekFrom", { date: weekStart })}</span>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onNextWeek}>
              {t("header.nextWeek")}
            </button>
          </div>
        )}

        <div className="lp-editor-tier-lens" role="tablist" aria-label={t("header.tierTabsAria")}>
          {PLAN_TIERS.map((planTier) => {
            const price = prices?.[planTier];
            const active = tier === planTier;
            return (
              <button
                key={planTier}
                type="button"
                role="tab"
                aria-selected={active}
                className={`lp-editor-tier-lens__btn${active ? " is-active" : ""}`}
                onClick={() => onTierChange(planTier)}
              >
                {getTierDisplayLabel(planTier, locale)}
                <small>{price ? `${price.priceExVatNok} kr` : "—"}</small>
              </button>
            );
          })}
        </div>
      </div>

      {tierPrice && !isCatalogView ? (
        <p className="lp-editor-priceline-compact" aria-label={t("header.priceLineAria")}>
          <strong>{getTierDisplayLabel(tier, locale)}</strong>
          {" · "}
          {formatPriceAmount(tierPrice.priceExVatNok, intlLocale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}{" "}
          {t("price.exVatShort")}
          {" / "}
          {formatPriceAmount(tierPrice.priceIncVatNok, intlLocale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {t("price.incVatShort")}
          {". "}
          {t("header.sharedWarmMealRule")}
        </p>
      ) : null}

      <div className="lp-editor-command-header__views" role="tablist" aria-label={t("header.workspaceAria")}>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "week"}
          className={`lp-editor-command-header__view-tab${workspaceView === "week" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("week")}
        >
          {t("tabs.weekPlan")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "catalog"}
          className={`lp-editor-command-header__view-tab${workspaceView === "catalog" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("catalog")}
        >
          {t("tabs.catalog")}
        </button>
      </div>
    </header>
  );
}
