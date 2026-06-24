"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  ENTERPRISE_UPGRADE_TYPES,
  type EnterpriseUpgradeType,
  type EnterpriseValidationWarning,
  type MarginEstimate,
} from "@/lib/providers/providerMenuPackageSurface";
import { formatPriceAmount, formatPriceExVatLabel } from "@/lib/providers/providerMenuPriceDisplay";
import type { EditorContext, EditorFocus } from "@/lib/provider-menu/providerMenuWorkspace";
import {
  ENTERPRISE_UPGRADE_QUICK_CHOICES,
  applyEnterpriseUpgradePreset,
  enterpriseUpgradeHasContent,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { formatDateNO } from "@/lib/date/format";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";
import { intlLocaleForAppLocale, isAppLocale } from "@/lib/i18n/localeRegistry";

const TIER_SOURCE_LABELS: Record<PlanTier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

const LUXUS_PRICE_EX_VAT = 130;
const ENTERPRISE_PRICE_EX_VAT = 170;

type Props = {
  open: boolean;
  context: EditorContext | null;
  form: ResolvedProviderMenuSlot | null;
  categoryVariantLabels?: string[];
  categoryOnly?: boolean;
  layoutMode?: "inspector" | "panel";
  onFormChange: (next: ResolvedProviderMenuSlot) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onCopyFromBasis: () => void;
  onCopyFromLuxus: () => void;
  pending: boolean;
  margin: MarginEstimate | null;
  enterpriseWarnings: EnterpriseValidationWarning[];
  confirmWarnings: boolean;
  onConfirmWarningsChange: (v: boolean) => void;
  catalogVariantAllergens?: string[];
  imageUrl?: string | null;
  tier: PlanTier;
  editorFocus?: EditorFocus;
  sharedVarmrettTitle?: string | null;
  varmrettProviderOverride?: boolean;
  varmrettAutoFilled?: boolean;
  varmrettHasGeneratedBaseline?: boolean;
  varmrettOrderLocked?: boolean;
  varmrettOrderCount?: number;
  onResetToGenerated?: () => void;
};

function slotStatusClass(status: ResolvedProviderMenuSlot["status"]): string {
  if (status === "published") return "is-published";
  if (status === "draft") return "is-draft";
  return "is-neutral";
}

export default function ProviderMenuEditorPanel({
  open,
  context,
  form,
  categoryVariantLabels,
  categoryOnly,
  layoutMode = "inspector",
  onFormChange,
  onClose,
  onSaveDraft,
  onPublish,
  onCopyFromBasis,
  onCopyFromLuxus,
  pending,
  margin,
  enterpriseWarnings,
  confirmWarnings,
  onConfirmWarningsChange,
  catalogVariantAllergens,
  imageUrl,
  tier,
  editorFocus,
  sharedVarmrettTitle,
  varmrettProviderOverride,
  varmrettAutoFilled,
  varmrettHasGeneratedBaseline,
  varmrettOrderLocked,
  varmrettOrderCount = 0,
  onResetToGenerated,
}: Props) {
  const t = useTranslations("provider.menu");
  const locale = useLocale();
  const intlLocale = isAppLocale(locale) ? intlLocaleForAppLocale(locale) : locale;
  const priceExVatSuffix = t("price.exVatSuffix");
  const [showManualEditing, setShowManualEditing] = useState(false);

  function slotStatusBadge(status: ResolvedProviderMenuSlot["status"]): string {
    if (status === "published") return t("editor.status.published");
    if (status === "draft") return t("editor.status.draft");
    return t("editor.status.notPublished");
  }

  useEffect(() => {
    if (!open || !form || !context) return;
    const isEnterprise = (editorFocus ?? context.editorFocus) === "enterprise-upgrade";
    if (isEnterprise) {
      setShowManualEditing(enterpriseUpgradeHasContent(form));
    }
  }, [open, context?.date, context?.editorFocus, editorFocus, form?.upgradeType, form?.upgradeNote]);

  if (!open || !form || !context) {
    if (layoutMode === "panel") {
      return (
        <div className="lp-editor-panel__idle" role="status">
          <p className="lp-editor-panel__idle-title">{t("editor.idle.title")}</p>
          <p className="lp-editor-panel__idle-lead">{t("editor.idle.leadPanel")}</p>
        </div>
      );
    }
    return (
      <aside className="lp-editor-inspector lp-editor-inspector--idle" aria-label={t("editor.ariaLabel")} data-state="closed">
        <div className="lp-editor-inspector__empty">
          <p className="lp-editor-inspector__empty-title">{t("editor.idle.title")}</p>
          <p className="lp-editor-inspector__empty-lead">{t("editor.idle.leadInspector")}</p>
        </div>
      </aside>
    );
  }

  const focus = editorFocus ?? context.editorFocus;
  const isEnterpriseUpgradeMode = focus === "enterprise-upgrade";
  const isVarmrettMode = isSanityDrivenCategory(form.category) && !isEnterpriseUpgradeMode;
  const isCatalogMode = !isVarmrettMode && !isEnterpriseUpgradeMode && (context.mode === "catalog" || categoryOnly);

  const isFriday = context.weekdayKey === "fri";

  const enterpriseDelta = ENTERPRISE_PRICE_EX_VAT - LUXUS_PRICE_EX_VAT;
  const luxusMargin =
    margin?.estimatedCostNok != null
      ? Math.round((LUXUS_PRICE_EX_VAT - margin.estimatedCostNok) * 100) / 100
      : null;
  const extraMargin =
    margin?.grossMarginNok != null && luxusMargin != null
      ? Math.round((margin.grossMarginNok - luxusMargin) * 100) / 100
      : null;

  const headerSecondary = isEnterpriseUpgradeMode
    ? t("editor.inspector.headerEnterpriseUpgrade")
    : isVarmrettMode
      ? t("editor.inspector.headerSharedWarmMeal")
      : context.categoryLabel;

  const applyDefaultSuggestion = () => {
    onFormChange(
      applyEnterpriseUpgradePreset(form, {
        upgradeType: "PREMIUM_PROTEIN",
        upgradeNote: t("enterprise.defaultSuggestion.note"),
        sourcePackage: "LUXUS",
      }),
    );
  };

  const applyQuickChoice = (choice: (typeof ENTERPRISE_UPGRADE_QUICK_CHOICES)[number]) => {
    onFormChange(
      applyEnterpriseUpgradePreset(form, {
        upgradeType: choice.upgradeType,
        upgradeNote: t(`enterprise.quickChoices.${choice.id}.note`),
        sourcePackage: "LUXUS",
      }),
    );
  };

  const hasUpgradeContent = enterpriseUpgradeHasContent(form);
  const showSuggestionCard = isEnterpriseUpgradeMode && !showManualEditing && !hasUpgradeContent;
  const varmrettSaveBlocked = isVarmrettMode && varmrettOrderLocked;

  const commissionNok =
    margin?.priceExVatNok != null ? Math.round(margin.priceExVatNok * 0.05 * 100) / 100 : null;
  const marginAfterCommission =
    margin?.estimatedCostNok != null && commissionNok != null
      ? Math.round((margin.priceExVatNok - margin.estimatedCostNok - commissionNok) * 100) / 100
      : null;

  if (layoutMode === "panel" && isVarmrettMode) {
    const dateLabel = `${context.weekdayLabel} ${formatDateNO(context.date)}`;

    return (
      <section className="lp-editor-panel-varmrett" aria-label={t("editor.varmrett.ariaLabel")}>
        <header className="lp-editor-panel__head lp-editor-panel__head--varmrett">
          <div className="lp-editor-panel__head-main">
            <h3 className="lp-editor-panel__title">{t("editor.varmrett.title", { dateLabel })}</h3>
            <p className="lp-editor-panel__scope">{t("editor.varmrett.scope")}</p>
          </div>
          <span className="lp-editor-panel__shared-badge">{t("editor.varmrett.sharedBadge")}</span>
        </header>

        {varmrettAutoFilled && !varmrettProviderOverride && !varmrettOrderLocked ? (
          <p className="lp-editor-genstamp lp-editor-genstamp--warm" role="status">
            <span aria-hidden="true">✨</span>
            {t("editor.varmrett.generatedStamp")}
          </p>
        ) : null}

        {varmrettOrderLocked ? (
          <div className="lp-editor-day__lockbar lp-editor-panel__lockbar" role="status">
            <span aria-hidden="true">🔒</span>
            {varmrettOrderCount > 0
              ? t("week.orderLock.hasOrderWithPortions", { count: varmrettOrderCount })
              : t("editor.inspector.orderLock")}
          </div>
        ) : null}

        <label className="lp-editor-panel__field">
          <span className="lp-editor-panel__label">{t("editor.varmrett.meal")}</span>
          <input
            className="lp-editor-panel__input"
            value={form.mealTitle}
            disabled={varmrettOrderLocked}
            onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
            maxLength={120}
          />
        </label>

        <label className="lp-editor-panel__field">
          <span className="lp-editor-panel__label">{t("editor.varmrett.description")}</span>
          <textarea
            className="lp-editor-panel__input lp-editor-panel__textarea"
            rows={3}
            value={form.description}
            disabled={varmrettOrderLocked}
            onChange={(e) => onFormChange({ ...form, description: e.target.value })}
            maxLength={4000}
          />
        </label>

        <label className="lp-editor-panel__field">
          <span className="lp-editor-panel__label">{t("editor.varmrett.allergens")}</span>
          <input
            className="lp-editor-panel__input"
            value={form.allergensText}
            disabled={varmrettOrderLocked}
            onChange={(e) => onFormChange({ ...form, allergensText: e.target.value })}
            placeholder={t("editor.varmrett.allergensPlaceholder")}
          />
        </label>

        <label className="lp-editor-panel__field">
          <span className="lp-editor-panel__label">{t("editor.varmrett.rawCost")}</span>
          <input
            className="lp-editor-panel__input"
            type="number"
            min={0}
            max={200}
            step={0.5}
            disabled={varmrettOrderLocked}
            value={form.estimatedCostPerPortion ?? ""}
            onChange={(e) =>
              onFormChange({
                ...form,
                estimatedCostPerPortion: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>

        <div className="lp-editor-panel__actions lp-editor-panel__actions--varmrett">
          {varmrettHasGeneratedBaseline && onResetToGenerated && !varmrettOrderLocked ? (
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              disabled={pending}
              onClick={onResetToGenerated}
            >
              {t("editor.varmrett.resetGenerated")}
            </button>
          ) : null}
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onClose}>
            {t("editor.varmrett.cancel")}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary lp-editor-panel__save-warm"
            disabled={pending || varmrettSaveBlocked}
            onClick={onSaveDraft}
          >
            {pending ? t("editor.varmrett.saving") : t("editor.varmrett.save")}
          </button>
        </div>

        {margin ? (
          <div className="lp-editor-econ" aria-label={t("editor.economy.ariaLabel")}>
            <div className="lp-editor-econ__row">
              <span className="lp-editor-econ__lbl">
                {t("editor.economy.tierPrice", { tier: TIER_SOURCE_LABELS[tier] })}
              </span>
              <span>{formatPriceExVatLabel(margin.priceExVatNok, priceExVatSuffix, intlLocale)}</span>
            </div>
            {margin.estimatedCostNok != null ? (
              <>
                <div className="lp-editor-econ__row">
                  <span className="lp-editor-econ__lbl">{t("editor.economy.rawCost")}</span>
                  <span>{formatPriceAmount(margin.estimatedCostNok, intlLocale)} kr</span>
                </div>
                {commissionNok != null ? (
                  <div className="lp-editor-econ__row">
                    <span className="lp-editor-econ__lbl">{t("editor.economy.commission")}</span>
                    <span>{formatPriceAmount(commissionNok, intlLocale)} kr</span>
                  </div>
                ) : null}
                <div className="lp-editor-econ__row lp-editor-econ__row--tot">
                  <span>{t("editor.economy.marginPerPortion")}</span>
                  <span className="lp-editor-econ__margin">
                    {marginAfterCommission != null
                      ? `${formatPriceAmount(marginAfterCommission, intlLocale)} kr`
                      : "—"}
                  </span>
                </div>
              </>
            ) : (
              <p className="lp-editor-panel__note">{t("editor.economy.enterRawCostHint")}</p>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <aside className="lp-editor-inspector is-open" aria-label={t("editor.ariaLabel")}>
      <header className="lp-editor-inspector__head">
        <div>
          <h3 className="lp-editor-inspector__context">
            {t("editor.inspector.editDay", { weekday: context.weekdayLabel })}
          </h3>
          <p className="lp-editor-inspector__subtitle">{headerSecondary}</p>
          <span className={`lp-editor-inspector__status-badge ${slotStatusClass(form.status)}`}>
            {slotStatusBadge(form.status)}
          </span>
          {varmrettAutoFilled && !varmrettProviderOverride && !varmrettOrderLocked ? (
            <span className={`lp-editor-badge${isFriday ? " is-friday" : " is-generated"}`}>
              {isFriday ? t("week.badges.fridayTreat") : t("week.badges.generated")}
            </span>
          ) : null}
          {varmrettProviderOverride && !varmrettOrderLocked ? (
            <span className="lp-editor-badge is-overridden">{t("week.badges.overridden")}</span>
          ) : null}
        </div>
        <button type="button" className="ds-btn ds-btn--ghost lp-editor-inspector__close" onClick={onClose}>
          {t("editor.inspector.close")}
        </button>
      </header>

      {isCatalogMode && categoryOnly && categoryVariantLabels && categoryVariantLabels.length > 0 ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">{t("editor.inspector.fixedChoices")}</h4>
          <p className="lp-editor-inspector__note">{t("editor.inspector.fixedChoicesNote")}</p>
          <ul className="lp-editor-inspector__variant-list">
            {categoryVariantLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          {catalogVariantAllergens && catalogVariantAllergens.length > 0 ? (
            <p className="lp-editor-inspector__meta">
              {t("editor.inspector.allergensPrefix", { list: catalogVariantAllergens.join(", ") })}
            </p>
          ) : null}
        </section>
      ) : null}

      {isVarmrettMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--varmrett">
          {varmrettOrderLocked ? (
            <div className="lp-editor-inspector__order-lock-wrap" role="status">
              <p className="lp-editor-order-lock lp-editor-inspector__order-lock">
                <span className="lp-editor-order-lock__icon" aria-hidden="true">🔒</span>
                <span className="lp-editor-order-lock__text">{t("editor.inspector.orderLock")}</span>
              </p>
              {varmrettOrderCount > 0 ? (
                <p className="lp-editor-inspector__order-count">
                  {t("editor.inspector.employeesOrdered", { count: varmrettOrderCount })}
                </p>
              ) : null}
              <p className="lp-editor-inspector__lock-hint">{t("editor.inspector.opensAfterServingDay")}</p>
            </div>
          ) : null}
          <div className="lp-editor-inspector__varmrett-hero">
            <span className="lp-editor-inspector__varmrett-hero-label">{t("editor.varmrett.todayHotMeal")}</span>
            <p className="lp-editor-inspector__varmrett-hero-title">
              {form.mealTitle.trim() || t("editor.inspector.mealNamePlaceholder")}
            </p>
            <p className="lp-editor-inspector__shared-lead">{t("editor.inspector.sharedKitchenLead")}</p>
          </div>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.mealName")}
            <input
              value={form.mealTitle}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.description")}
            <textarea
              rows={3}
              value={form.description}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              maxLength={4000}
            />
          </label>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.allergens")}
            <input
              value={form.allergensText}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, allergensText: e.target.value })}
              placeholder={t("editor.varmrett.allergensPlaceholder")}
            />
          </label>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.estimatedRawCost")}
            <input
              type="number"
              min={0}
              max={200}
              step={0.5}
              disabled={varmrettOrderLocked}
              value={form.estimatedCostPerPortion ?? ""}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  estimatedCostPerPortion: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {varmrettHasGeneratedBaseline && onResetToGenerated && !varmrettOrderLocked ? (
            <button
              type="button"
              className="ds-btn ds-btn--ghost lp-editor-inspector__reset-baseline"
              disabled={pending}
              onClick={onResetToGenerated}
            >
              {t("editor.varmrett.resetGenerated")}
            </button>
          ) : null}
        </section>
      ) : null}

      {isCatalogMode && !categoryOnly && context.variantLabel ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">{t("editor.inspector.singleChoice")}</h4>
          <p className="lp-editor-inspector__readonly-value">{context.variantLabel}</p>
          <p className="lp-editor-inspector__note">{t("editor.inspector.singleChoiceNote")}</p>
        </section>
      ) : null}

      {!isVarmrettMode && !isCatalogMode && !isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">{t("editor.inspector.content")}</h4>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.mealName")}
            <input
              value={form.mealTitle}
              onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="lp-editor-inspector__field">
            {t("editor.varmrett.description")}
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              maxLength={4000}
            />
          </label>
        </section>
      ) : null}

      {imageUrl ? <img src={imageUrl} alt="" className="lp-editor-inspector__thumb" /> : null}

      {margin && !isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--economy">
          <h4 className="lp-editor-inspector__section-title">{t("editor.economy.title")}</h4>
          <div className="lp-editor-inspector__economy-grid">
            <div className="lp-editor-inspector__kpi">
              <span className="lp-editor-inspector__kpi-label">{t("editor.economy.priceExVat")}</span>
              <span className="lp-editor-inspector__kpi-value">
                {formatPriceExVatLabel(margin.priceExVatNok, priceExVatSuffix, intlLocale)}
              </span>
            </div>
            {margin.estimatedCostNok != null ? (
              <>
                <div className="lp-editor-inspector__kpi">
                  <span className="lp-editor-inspector__kpi-label">{t("editor.economy.estimatedCost")}</span>
                  <span className="lp-editor-inspector__kpi-value">
                    {formatPriceAmount(margin.estimatedCostNok, intlLocale)} kr
                  </span>
                </div>
                <div className="lp-editor-inspector__kpi">
                  <span className="lp-editor-inspector__kpi-label">{t("editor.economy.contribution")}</span>
                  <span className="lp-editor-inspector__kpi-value">
                    {margin.grossMarginNok != null
                      ? `${formatPriceAmount(margin.grossMarginNok, intlLocale)} kr`
                      : "—"}
                    {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
                  </span>
                </div>
              </>
            ) : (
              <p className="lp-editor-inspector__note">{t("editor.economy.enterRawCostHint")}</p>
            )}
          </div>
        </section>
      ) : null}

      {isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--enterprise lp-editor-enterprise">
          <div className="lp-editor-inspector__enterprise-header">
            <h4 className="lp-editor-inspector__section-title">{t("editor.enterprise.title")}</h4>
            <p className="lp-editor-inspector__enterprise-lead">{t("editor.enterprise.lead")}</p>
          </div>

          <div className="lp-editor-inspector__enterprise-varmrett-card">
            <span className="lp-editor-inspector__enterprise-base-label">{t("editor.enterprise.todayWarmMeal")}</span>
            {sharedVarmrettTitle ? (
              <p className="lp-editor-inspector__enterprise-base-title">{sharedVarmrettTitle}</p>
            ) : (
              <p className="lp-editor-inspector__warn">{t("editor.enterprise.warmMealMissing")}</p>
            )}
            <p className="lp-editor-inspector__enterprise-varmrett-note">{t("editor.enterprise.sameWarmMealNote")}</p>
          </div>

          <div className="lp-editor-inspector__enterprise-kpis">
            <div className="lp-editor-inspector__kpi">
              <span className="lp-editor-inspector__kpi-label">{t("editor.enterprise.surcharge")}</span>
              <span className="lp-editor-inspector__kpi-value">+{enterpriseDelta} kr</span>
            </div>
            {margin?.estimatedCostNok != null ? (
              <div className="lp-editor-inspector__kpi">
                <span className="lp-editor-inspector__kpi-label">{t("editor.enterprise.estimatedRawCost")}</span>
                <span className="lp-editor-inspector__kpi-value">{margin.estimatedCostNok} kr</span>
              </div>
            ) : null}
            {extraMargin != null ? (
              <div className="lp-editor-inspector__kpi">
                <span className="lp-editor-inspector__kpi-label">{t("editor.enterprise.extraContribution")}</span>
                <span className="lp-editor-inspector__kpi-value">{extraMargin} kr</span>
              </div>
            ) : null}
          </div>

          {showSuggestionCard ? (
            <div className="lp-editor-inspector__enterprise-suggestion">
              <span className="lp-editor-inspector__enterprise-suggestion-label">
                {t("editor.enterprise.suggestedTitle")}
              </span>
              <p className="lp-editor-inspector__enterprise-suggestion-title">
                {t("enterprise.defaultSuggestion.title")}
              </p>
              <p className="lp-editor-inspector__enterprise-suggestion-lead">
                {t("enterprise.defaultSuggestion.explanation")}
              </p>
              <div className="lp-editor-inspector__enterprise-suggestion-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--primary"
                  onClick={applyDefaultSuggestion}
                >
                  {t("editor.enterprise.useSuggestion")}
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost"
                  onClick={() => setShowManualEditing(true)}
                >
                  {t("editor.enterprise.chooseOther")}
                </button>
              </div>
            </div>
          ) : null}

          {hasUpgradeContent && !showManualEditing ? (
            <div className="lp-editor-inspector__enterprise-applied">
              <span className="lp-editor-inspector__enterprise-applied-label">
                {t("editor.enterprise.selectedUpgrade")}
              </span>
              <p className="lp-editor-inspector__enterprise-applied-value">
                {form.upgradeNote.trim() ||
                  (form.upgradeType
                    ? t(`enterprise.upgradeTypes.${form.upgradeType}`)
                    : t("editor.enterprise.upgradeSelected"))}
              </p>
            </div>
          ) : null}

          <div className="lp-editor-inspector__enterprise-quick">
            <h5 className="lp-editor-inspector__enterprise-quick-title">{t("editor.enterprise.quickChoicesTitle")}</h5>
            <p className="lp-editor-inspector__enterprise-quick-lead">{t("editor.enterprise.quickChoicesLead")}</p>
            <div
              className="lp-editor-inspector__enterprise-chips"
              role="group"
              aria-label={t("editor.enterprise.quickChoicesAria")}
            >
              {ENTERPRISE_UPGRADE_QUICK_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`lp-editor-inspector__enterprise-chip${
                    form.upgradeType === choice.upgradeType &&
                    form.upgradeNote.trim() === t(`enterprise.quickChoices.${choice.id}.note`)
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => applyQuickChoice(choice)}
                >
                  {t(`enterprise.quickChoices.${choice.id}.label`)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="lp-editor-inspector__enterprise-manual-toggle"
            aria-expanded={showManualEditing}
            onClick={() => setShowManualEditing((v) => !v)}
          >
            {showManualEditing ? t("editor.enterprise.hideManual") : t("editor.enterprise.editManual")}
          </button>

          {showManualEditing ? (
            <div className="lp-editor-inspector__enterprise-manual">
              <p className="lp-editor-inspector__enterprise-manual-lead">{t("editor.enterprise.manualLead")}</p>
              <div className="lp-editor-inspector__copy-actions">
                <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromLuxus}>
                  {t("editor.enterprise.buildFromLuxus")}
                </button>
                <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromBasis}>
                  {t("editor.enterprise.buildFromTier", { tier: TIER_SOURCE_LABELS.BASIS })}
                </button>
              </div>

              <div className="lp-editor-inspector__enterprise-fields">
                <label className="lp-editor-inspector__field">
                  {t("editor.enterprise.basedOn")}
                  <select
                    value={form.sourcePackage ?? ""}
                    onChange={(e) =>
                      onFormChange({
                        ...form,
                        sourcePackage: (e.target.value as PlanTier) || null,
                      })
                    }
                  >
                    <option value="">{t("editor.enterprise.none")}</option>
                    <option value="BASIS">{TIER_SOURCE_LABELS.BASIS}</option>
                    <option value="LUXUS">{TIER_SOURCE_LABELS.LUXUS}</option>
                  </select>
                </label>
                <label className="lp-editor-inspector__field">
                  {t("editor.enterprise.upgradeType")}
                  <select
                    value={form.upgradeType ?? ""}
                    onChange={(e) =>
                      onFormChange({
                        ...form,
                        upgradeType: (e.target.value as EnterpriseUpgradeType) || null,
                      })
                    }
                  >
                    <option value="">{t("editor.enterprise.chooseType")}</option>
                    {ENTERPRISE_UPGRADE_TYPES.map((upgradeType) => (
                      <option key={upgradeType} value={upgradeType}>
                        {t(`enterprise.upgradeTypes.${upgradeType}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lp-editor-inspector__field">
                  {t("editor.enterprise.customerExtra")}
                  <textarea
                    rows={3}
                    value={form.upgradeNote}
                    onChange={(e) => onFormChange({ ...form, upgradeNote: e.target.value })}
                    maxLength={500}
                    placeholder={t("editor.enterprise.customerExtraPlaceholder")}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {enterpriseWarnings.map((w) => (
            <p
              key={w.code}
              className={w.blocking ? "lp-editor-inspector__error" : "lp-editor-inspector__warn"}
              role="status"
            >
              {t(`validation.enterprise.${w.messageKey}`)}
            </p>
          ))}
        </section>
      ) : null}

      {enterpriseWarnings.some((w) => !w.blocking) ? (
        <label className="lp-editor-inspector__confirm">
          <input
            type="checkbox"
            checked={confirmWarnings}
            onChange={(e) => onConfirmWarningsChange(e.target.checked)}
          />
          {t("editor.enterprise.confirmPublishDespiteWarning")}
        </label>
      ) : null}

      <footer className="lp-editor-inspector__actions">
        <button type="button" className="ds-btn" disabled={pending || varmrettSaveBlocked} onClick={onSaveDraft}>
          {pending ? t("editor.actions.saving") : t("editor.actions.saveDraft")}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={pending || varmrettSaveBlocked}
          onClick={onPublish}
        >
          {pending ? t("editor.actions.publishing") : t("editor.actions.publishDay")}
        </button>
      </footer>
    </aside>
  );
}
